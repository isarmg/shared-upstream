# Sarmg 混合插件平台架构

## 1. 架构决策

系统采用以下组合，而不是在“单体”与“微服务”之间二选一。这里的“模块化单体”描述控制面
的开发与治理方式，不表示把五个业务模块链接进同一进程：

1. **Modular Monolith**：Core 控制面、Web Shell、SDK 与公共平台能力共享一个易于开发和运维的
   平台基线；业务模块保持独立 worker。
2. **Plugin Architecture**：业务能力通过有版本的模块包在运行时发现、注册、启停和监管。
3. **Service-oriented Deployment**：高资源、高风险或需独立扩缩容的模块可成为独立进程、容器或
   服务，接口和数据边界保持不变。

这个选择与五个现有业务域相匹配：全面微服务化会过早引入网络、发布编排、可观测性和分布式
一致性成本；继续把所有功能编译进 Union，又会使功能选择、升级和故障域绑在一次整站重构中。
运行时插件模型保留早期单体效率，同时为重型模块提供渐进式拆分路径。

## 2. 逻辑组成

### Core Platform

Core 只拥有平台级能力：

- 身份认证、会话与 RBAC；
- 配置中心与秘密字段边界；
- 日志审计；
- 任务注册、调度、触发与状态；
- 通知发布、查询与确认；
- 模块注册表、发现、依赖解析、兼容校验和生命周期管理；
- API Gateway、服务发现、健康检查与受监管进程；
- Event Bus 的主题注册、发布与订阅边界。

Sunshine 主机管理、设备监控、相册、摄像头和文件服务等业务逻辑不得进入 Core。Core 可以提供
通用抽象，但不能通过“公共能力”名义保存某个业务域的 DTO、SQL 或流程分支。
因此 `union-rust` 只拥有 Core/Web 及平台运行时；Sunshine 源码归 `sunshine-worker`，Host Worker、
远端 `unionc-agent` 和两端线协议共同归 `host-monitoring`。协议与领域客户端同仓不会使它们成为
Core 的平台公共能力。

### Plugin Runtime

Builder 决定一个发行版包含哪些模块包；运行时只从该不可变发行的受信任模块根目录发现
`manifest.json`，执行以下流程：

```text
Builder stages package into release
    │
    ▼
validate manifest + paths + checksums
    │
    ▼
core/platform/plugin API compatibility
    │
    ▼
dependency graph + cycle/conflict check
    │
    ▼
permissions/config/migrations/routes/assets registration
    │
    ▼
start execution adapter → readiness gate → activate version
```

失败必须使该模块保持未启用且不影响其他模块；禁用先停止新流量，再停止任务/订阅/进程并撤销
动态注册。发行来源、制品摘要、操作者、启停和失败原因进入审计日志。新增模块/版本通过新的
Union 发行引入，运行时不得从公网任意下载安装代码。

Manifest 的 liveness/readiness path 是 Core supervisor 到 loopback worker 的私有控制通道，不是
`/api/modules/<id>` 公网路由。模块健康通过受保护的 platform catalog 呈现；Gateway/validator 必须
拒绝显式或 wildcard 业务路由覆盖 health path。当前 Dufs catch-all 尚不满足最后一项，按实施状态
作为有期限缺口跟踪，不能把旧 `/modules/.../health` 探针继续登记成“公开合规”。

### Platform SDK

SDK 是模块与平台之间的唯一编程边界，提供：

- Manifest 类型、校验器和兼容范围；
- 模块生命周期与健康接口；
- 限定命名空间的配置、权限、任务、通知和事件客户端；
- Gateway 请求身份与服务发现；
- 数据 migration 元数据与执行上下文；
- Web Module Host SDK。

SDK 不提供跨模块数据库访问，也不把 Core 的私有 `AppState` 暴露给插件。

### Event Bus

Event Bus 用于不要求同步返回的解耦交互。主题必须由 Manifest 声明并受模块命名空间约束；事件带
schema/version、producer、event id、timestamp 和 trace context。进程内实现可先使用内存总线，
跨进程/服务再接入持久队列；两者遵守相同事件契约。需要强一致写入时使用模块自身事务和 outbox，
不能假设内存广播提供持久交付。

### Web Shell

Shell 只提供布局、认证状态、导航、权限门、错误边界和动态加载器。模块 Manifest 声明 Route、
Menu、Component、样式与 API base，ES module 入口通过 `activate(hostSdk)` 提供组件实现。

模块入口不得自行注册未声明路由/权限、导入 Core 私有源码、捆绑第二份 React，或要求取得原始
认证秘密。单个入口加载或渲染失败只使该模块降级，不能破坏登录、导航和其他模块。

这些 ESM 与 worker 都是 Builder 校验后纳入不可变发行的受信任代码；同源动态加载不是 JavaScript
沙箱。Host SDK 的 API base、前端权限过滤和 Manifest component 白名单是稳定接口/界面约束，不能
阻止恶意脚本直接 `fetch` 同源 API 或读取非 HttpOnly CSRF token。真正的安全边界在服务端：Core
对每次请求执行会话、RBAC、CSRF、Manifest 路由和 Gateway 校验。低信任前端必须先采用独立 origin/
iframe sandbox 与消息协议，不能直接进入当前 Shell 信任域。

## 3. 部署模型

| 模式 | 适用场景 | 隔离与升级 | 约束 |
|---|---|---|---|
| `in_process` | 低资源、低风险、高频平台调用 | 最低开销；Core 进程内 | 仅可信、SDK ABI/工厂注册；故障会影响 Core |
| `process` | 默认业务模块、长任务、原生二进制 | OS 进程隔离；可独立重启 | loopback、受监管命令、健康门禁 |
| `container` | 资源限制、依赖隔离、GPU/媒体 | 容器级资源和发布 | 仅允许管理员配置的可信 runtime adapter |
| `service` | 独立扩缩容、远程故障域、多副本 | 完全独立部署 | mTLS/服务身份、发现、超时、重试与熔断 |

同一模块从 process 迁到 service 时，公开 API、权限、事件和数据所有权不改变。执行模式是部署
元数据，不是业务代码调用另一套 Core 私有接口的许可。

现有 Sunshine、Host Monitoring、Sentinel Monitor、Photo Backup、Dufs 全部使用 `process`；
这不是临时的编译过渡状态，而是当前产品拓扑：Core 是唯一公网入口，五个 worker 由 Core 监管并
仅绑定本地私有端点。当前发行不把任一业务模块以 `in_process` 方式链接进 Core。

当前 Builder v2 只接受这五类标准模块的 `process` 交付；表中的其他模式是 Platform 契约保留的
演进方向，不是当前发行已经提供的部署能力。进程边界保证代码组织、崩溃、数据所有权和生命周期
相互独立，但同一 OS 身份下的进程**不是对抗恶意模块的保密沙箱**。当前发行只接收受信任、固定
revision、经过发行清单和摘要校验的官方模块。若要运行第三方或低信任代码，必须先使用独立 OS
身份与目录、独立 cgroup/namespace 或 container/service，并把 loopback token 升级为可验证的
workload identity；不能把“独立 PID”宣传成完整安全隔离。

`unionc-agent` 不属于上述五个私有 Worker。它安装在被监控主机上，是 Host Monitoring 的远端
companion：只向 Union 的唯一公网 TLS/Gateway 发起出站请求，不发现、不监管也不直连 Host Worker。
Builder `full` 的服务器 distribution 固定并包含五个 Worker，但明确不包含 Agent；Agent 的原生
安装介质是独立逻辑资产，必须与兼容的 Host 协议/Union 版本建立可审计关系，不能成为第二个公网
服务或绕过 Union 的交付入口。

服务器运行面有意收窄为 Linux：官方发行只生成 `linux/amd64` 与 `linux/arm64`，发行清单携带目标
元数据，Core 在注册或启动前将其与实际 OS/architecture 对照。Windows、macOS 与移动平台均不属于
Server 运行矩阵；Windows、macOS 还可作为 Agent 客户端和 Builder CLI 宿主，但不能据此扩张
Union Server 的支持面。
Builder 允许跨机 staging，但 install/rollback 在修改活动指针前拒绝目标不匹配；正式 GNU 包以
Ubuntu 24.04 runner 的 glibc/系统 ABI 为当前兼容基线，不泛化为任意旧 Linux 发行版。

Agent 在 Linux、Windows、macOS 上使用桌面 service/daemon 与原生安装生命周期；在 Android、
iOS/iPadOS 上则是由宿主应用驱动的 Rust 核心库。移动端不能假设无限后台时间、任意系统遥测或
普通文件凭据：宿主负责平台权限、Keychain/Keystore、调度和 HTTPS，核心库只构造共享协议报告。
iOS 与 iPadOS 共用 Apple device/simulator Rust 目标，但在协议身份中保持独立产品名称。该编译
边界本身不构成已发布的 APK/IPA，也不等同于桌面 Agent 的全系统可见性。

## 4. 模块边界

每个发行内模块包必须包含：Backend、Frontend（可为空但必须显式声明）、Manifest、Permission
Definition、Database Migration、Configuration Schema 和 Version Metadata。后端只在
`/api/modules/<id>` 下公开；前端路由只在 `/modules/<id>` 下注册。

禁止：

- 直接依赖另一模块的内部 crate、源文件、数据库表或前端组件；
- 跨模块外键、运行时 SQL join、共享业务 migration 或循环依赖；
- 由 Manifest 执行任意 shell、绝对路径、目录跳转或任意公网 upstream；
- 通过环境变量或复制一个二进制绕过 Builder 组包、校验和发行审计；
- 在禁用模块后继续保留其路由、任务或事件订阅。

需要同步交互时使用版本化 Platform/Plugin API；需要松耦合通知时使用事件。确需模块依赖时必须
在 Manifest 写语义版本范围，由运行时拓扑排序并拒绝缺失、冲突和循环。

Manifest 路由明确区分 `platform` 与 `module` 认证。前者由 Core 完成会话与 RBAC，并覆盖写入唯一、
规范、1–128 字节的 UTF-8 `X-Union-Principal`，worker 使用共享 Gateway SDK 解析并把真实操作者写入
领域审计；不得回退到本地 Cookie/Bearer。后者只用于 Agent、Photo 设备或 Sentinel 短时媒体等
明确 capability 协议，仍须经过 Union Gateway。Dufs 与所有浏览器管理操作全部使用 `platform`
认证；内部 per-process token 只证明 Core→worker，不是用户/设备身份。

## 5. 数据边界

统一的是 PostgreSQL 运维基线、命名、migration、备份、readiness 和访问控制，不是把所有表
放进一个共享 database 或 schema。Sunshine、Host Monitoring、Sentinel 和 Photo 各自拥有专用
database、role 与 migration ledger；命名 schema 只能存在于该模块自己的 database 内。Core
使用独立 SQLite database 和 migration/备份/恢复生命周期，只保存身份、RBAC、配置、审计、任务、
通知与模块 registry/lifecycle 等平台状态；Core 不直接查询业务表，模块也不能修改 Core 或其他
模块的数据结构。多个业务 database 可以由同一 PostgreSQL cluster 托管，但不得共享 owner、
连接凭据、事务或备份恢复单元。

Dufs 是有意保留的例外：其 rooted filesystem 操作和 SQLite 提交日志处于同一一致性边界。
在没有多节点 fencing 与分区语义前，强制迁到 PostgreSQL 会降低正确性。Dufs、Union Core、
设备端离线数据库以及桌面 Host Monitoring Agent 的文件型本地状态/spool 均归各自数据所有者，
不属于服务端 PostgreSQL 统一范围；移动嵌入核心本身不拥有持久数据库、队列或凭据存储。

任何模块或受管伴随进程使用的持久文件树都必须在配置 Schema 中以
`x-union-resource: storage_tree` 声明。路径必须是词法规范化的绝对路径、不能是文件系统根；Core
把实际 data root 及另行配置的 plugin-state 根作为 Core 保留资源，同时拒绝模块声明与 Core 根、
同模块其他声明或跨模块声明相同及任一方向的父子包含。该门禁表达文件所有权与误配置隔离，不表示
同一 OS 身份下已经形成对抗恶意进程的保密沙箱。当前 Photo 内容目录以及 Dufs serve/state 目录
已有声明；Sentinel 的 MediaMTX 录像目录尚未纳入该声明和冲突校验，因此只能称领域所有权已经
确定，不能称持久目录隔离已经完成。

## 6. 版本与兼容

- Core、Platform API、Plugin API 和模块均使用 Semantic Versioning。
- Manifest v1 独立版本化；未知主版本必须拒绝。
- 模块声明 `core`、`platform_api`、`plugin_api` 兼容范围及依赖模块版本范围。
- 破坏性 API 变化发布新 major，并在迁移窗口内并行支持旧 major。
- Web 入口版本必须与 Manifest 一致；缓存键包含模块 ID 和精确版本。
- 数据 migration 只前进且由模块拥有；应用升级失败不能自动执行破坏性回滚 SQL。

## 7. 代码组织与维护性

当前采用多个 Git 仓库与统一 SDK/Builder/CI 契约，便于保持已有历史和独立模块版本。其中
`union-rust` 只维护 Core/Web，`sunshine-worker` 维护 Sunshine，`host-monitoring` 将 Host Worker、
Agent 与共享 wire protocol 作为同一业务域统一版本化；其余模块继续各自独立。Monorepo 是可选的
工程管理优化，不是运行时架构要求。无论何种代码布局，服务器 Worker 包、远端客户端、模块版本、
测试和部署单元都保持逻辑独立。

该方案综合可行性约 **8/10**、长期意义约 **9/10**、当前迁移成本约 **7/10**。维护收益来自严格
边界、按模块升级和故障隔离；新增成本主要是 Manifest/SDK 兼容、动态前端安全、包供应链、
生命周期并发和多部署模式测试。通过单一 schema/validator、少量官方执行适配器、契约测试和
限制跨模块依赖，可将维护性稳定在 **8/10**。若允许任意脚本、共享数据库或模块互相调用内部
实现，维护性会迅速退化，必须作为架构门禁拒绝。
