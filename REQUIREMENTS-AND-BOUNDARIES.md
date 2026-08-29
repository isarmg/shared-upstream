# Union 插件平台：需求、边界与完成定义

本文是 v0.5+ 架构的规范入口。关键词 `MUST`、`MUST NOT`、`SHOULD` 表示强制、禁止和建议；
目标要求与已通过验收的事实必须在文档中分开表述。

## 1. 产品目标

系统 MUST 达成：

- 源码可统一治理，模块边界严格隔离；
- Core/Web Shell 不编译业务逻辑；Builder 决定发行包含集合，运行时按需启停；
- 早期保持 Modular Monolith 的开发和运维成本；
- 重型模块不改变业务接口即可独立进程、容器或服务部署；
- 模块版本逻辑独立，兼容关系机器可读、可拒绝、可审计；新代码随不可变发行交付；
- 单模块故障或前端加载错误不拖垮平台和其他模块。

本规范中的“服务器发行”包含一个 Union Core/Web 和所选私有 Worker。官方 `full` 必须恰好包含
Sunshine、Host Monitoring、Sentinel Monitor、Photo Backup、Dufs 五个 Worker；远端
`host-m-agent` 是 Host Monitoring companion，不属于服务器模块集合，只能经 Union 入口访问系统。

### 1.1 支持平台

- 服务器 distribution MUST 只支持 `linux/amd64` 与 `linux/arm64`，分别对应 Rust
  `x86_64-unknown-linux-gnu` 与 `aarch64-unknown-linux-gnu`。Union/Builder MUST NOT 发布
  Windows、macOS、Android、iOS 或 iPadOS 服务器包。
- 发行清单 MUST 记录规范化的 `platform` 与 `architecture`；Builder MUST 拒绝其他组合，Core
  MUST 在加载/启动前拒绝与当前运行主机不一致的制品。文件名、artifact 名称与校验输出 MUST
  能唯一识别两个 Linux 目标，不能依靠下载者猜测架构。
- `stage` MAY 为其他受支持 Linux 架构预置包；`install` 与 `rollback` MUST 在修改活动发行指针前
  复验当前宿主目标。正式 GNU 包以 Ubuntu 24.04 原生 runner 的 glibc/系统 ABI 为当前兼容基线；
  未在更旧发行版验证前 MUST NOT 宣称“任意 Linux”兼容。
- 桌面 `host-m-agent` MUST 支持 Linux、Windows 与 macOS，并继续作为 Host Monitoring 的远端
  companion；其安装介质和生命周期 MUST 与服务器 distribution 分离，并 MUST 由
  Union Builder Release 从锁定 Host revision 集中发布。
- Android Agent 核心 MUST 至少验证 `aarch64-linux-android`；Apple 移动 Agent 核心 MUST 验证
  `aarch64-apple-ios` device 与 `aarch64-apple-ios-sim` simulator。iOS 与 iPadOS 使用相同 Rust
  目标，MUST 由宿主应用提供不可混淆的产品身份。
- Android/iOS/iPadOS 的“支持”在本阶段是可嵌入、无 daemon 假设的 Rust 核心库，而不是虚构的
  常驻服务。宿主应用 MUST 持有调度/后台生命周期、平台权限、安全凭据存储、TLS 客户端和用户
  同意；库只能处理应用沙箱可见的数据。没有经过签名和真机验证的宿主应用时，MUST NOT 声称已
  交付 APK/IPA 或具备桌面 Agent 等价的全系统采集能力。

本阶段不追求：任意第三方不受信代码市场、跨地域分布式事务、热替换任意 native ABI、自动删除
模块数据、任意容器编排器控制，或把所有数据库强行合并。

## 2. Core Platform 边界

Core MUST 仅实现以下平台能力：身份认证、RBAC、配置中心、审计日志、任务调度、通知、模块注册、
生命周期、API Gateway、服务发现和 Event Bus。每项能力须以版本化 Platform API/SDK 暴露，并按
调用模块限定命名空间和权限。

Core MUST NOT：

- 包含 Sunshine、Host、Sentinel、Photo、Dufs 的业务 handler、业务 repository 或业务 SQL；
- 直接读取/写入模块业务 schema；
- 以某一模块的例外扩展公共 API，却没有第二个通用消费者和兼容策略；
- 把浏览器会话 cookie、数据库管理员凭据或完整 Core state 交给模块；
- 依赖编译期 Cargo feature 才能识别标准兼容模块。

## 3. 标准 Module 要求

每个 Module MUST 作为独立版本单元，提供：

1. Backend 实现或明确的无后端声明；
2. Frontend ESM 入口或明确的无前端声明；
3. `manifest.json`；
4. permission definitions；
5. 自有 database migration 或 embedded migration 元数据；
6. JSON configuration schema 及 secret 字段；
7. version metadata。

Manifest MUST 声明 Core/Platform API/Plugin API 兼容范围、依赖、执行模式、路由、健康和生命周期。
包内文件路径 MUST 是归一化相对路径；未知 schema major、无效 SemVer、缺失依赖、循环依赖、重复
权限、越界路径或命名空间冲突 MUST 被拒绝。

模块 MUST 可被 Builder 独立构建为包，但正式交付由 Union distribution 统一承载。Builder profile
决定发行包含哪些包，不将业务重新编译进 Core。模块不能从公网动态下载安装，也不能以独立公共
入口绕过 Union 的 TLS、认证、RBAC 和网关策略。

远端 companion 不等同于 Module：它不提供 Manifest Web/Backend 包、不受 Core 当作 loopback
进程监管，也不得计入 profile 的 Worker 数量。其源码可以与所属模块同仓统一协议版本，但安装资产、
升级节奏和兼容矩阵必须与服务器 distribution 明确区分。官方 companion 资产 MUST 由
Builder Release 集中产出，模块仓库 MUST NOT 发布竞争的独立官方 Release。

## 4. 运行时管理要求

Plugin Runtime MUST：

- 只从当前 active、不可变 Union distribution 内由 Builder inventory 固定并校验摘要的模块根发现
  版本化模块包；管理员不得在运行时把任意目录改成新的代码来源；
- 校验包、Manifest、API 兼容、依赖图和命名空间；
- 注册/撤销权限、配置、migration、后端路由、前端资源、任务、服务和事件；
- 提供 discover/rescan、enable、disable 与查询 API，并执行 RBAC/CSRF/审计；rescan 只重读当前
  Builder inventory，不得扩大包含集合，只有发行切换负责增加、升级或移除模块包；
- 并发串行化同一模块的生命周期操作；
- 在 readiness 成功后才暴露流量；故障升级保留旧活动版本；
- Manifest health path 只供 supervisor 访问私有 worker；validator/Gateway MUST 拒绝任何公开
  GET/HEAD route（含 wildcard）覆盖 liveness/readiness path，模块状态通过受保护 platform catalog
  呈现；
- 监管 process，或通过受信任 adapter 管理 container/service；
- 对 crash 使用有上限的指数退避并暴露健康原因；
- 关闭时先拒绝新工作、排空在途请求，再停止模块。

运行时 MUST NOT 从 Manifest 执行 shell、从公网下载模块、连接任意未经管理员授权的 URL，或在
模块从发行移除时隐式清除业务数据。代码/资源回滚与数据库回滚必须作为两个不同概念呈现。

## 5. Web Shell 要求

Web Shell MUST 只实现基础布局、认证状态、导航、权限控制、动态模块加载与错误边界。启用模块的
Manifest 是 Route/Menu/API 的唯一事实源；ESM entry 只能提供已声明 component 的实现。

动态模块 MUST：

- 通过 `activate(hostSdk)` 使用 Shell 提供的 React/runtime；
- 不捆绑另一份 React，不导入 Core 私有源代码；
- 以 `/api/modules/<id>` 下的同源 API client 作为唯一受支持接口；
- 在路由和菜单呈现前通过权限检查；
- 使用模块 ID + 精确版本作为资源缓存/诊断身份；
- 加载、激活或渲染失败时被单独隔离并可卸载样式。

启用或禁用发行内 Web 模块 MUST NOT 要求重新构建整个 Web Console。新增或升级模块可随新 Union
发行替换模块资源，而无需把业务页面重新编译进 Shell；只有 Shell SDK major 或 Core 自身升级
可以要求重建 Shell。

动态 ESM MUST 被视为 Builder 验证的受信任发行代码，而不是浏览器沙箱。API base、前端权限过滤和
component 白名单 MUST NOT 被表述为授权边界；Core MUST 对脚本发出的每次请求重新执行会话、RBAC、
CSRF、Manifest 路由和 Gateway 检查。允许第三方低信任前端前必须另行设计隔离 origin/iframe
sandbox、严格 CSP 与最小消息协议。

## 6. 模块通信要求

模块原则上 MUST NOT 直接依赖其他模块。确需依赖时，只能使用：

- 有版本的 Platform API 或公开 Plugin API；
- 声明式 service discovery + REST/gRPC；
- Manifest 声明的 Event Bus topic。

同步调用 SHOULD 避免 A→B→C 的长调用链，并必须设置 deadline、取消和可观察错误。事件消费者
MUST 假设重复和乱序，使用 event id/业务幂等键。需要可靠跨进程交付的事件 MUST 使用持久 transport
或 outbox；内存广播不能宣称 durable。

## 7. 数据要求

- Core 控制面和每个模块的数据 MUST 有明确所有者。
- Core MUST 使用独立 SQLite database 和独立 migration ledger 保存身份、RBAC、配置、审计、任务、
  通知、模块 registry/lifecycle 等平台状态，并独立执行备份与恢复；模块 MUST NOT 读写该 database，
  Core 也 MUST NOT 把模块业务表并入其中。
- Sunshine、Host、Sentinel、Photo MUST 各自使用专用 PostgreSQL database/role 和 migration
  ledger，只授予自有 database 内对象权限。
- migration MUST 随模块包版本发布、带校验和、串行执行并记录结果。
- 模块 MUST NOT 修改、外键引用或运行时 join 其他模块表。
- 需要跨域读取时通过 API/事件建立本地投影，并定义延迟与修复语义。
- 后续发行移除模块包时默认 MUST 保留数据；清除数据须二次明确操作、备份门禁和审计。
- Dufs MAY 保留 rooted filesystem + SQLite 一致性边界；设备端离线数据库不属于服务器 PostgreSQL
  统一范围。
- 模块或其受管伴随进程使用的每个持久目录 MUST 在配置 Schema 中声明
  `x-union-resource: storage_tree`；值 MUST 是非根、词法规范化的绝对路径。
- Core 的实际 data root 及另行配置的 plugin-state 等 Core 持久根 MUST 作为保留 storage tree 加入
  同一冲突域。Core MUST 拒绝模块声明与任一 Core 保留根、同一模块其他声明或其他模块声明相同，
  也 MUST 拒绝任何方向的父子重叠。未声明目录不得被文档称为已受平台资源隔离；数据库型模块若
  确实没有持久文件树，可以不伪造空目录声明。

数据隔离是未来独立服务化的前提，不是“数据库统一”的反面。多个专用 database 可以共用一个
PostgreSQL cluster 以降低运维成本，但不能共用 database、表所有权、运行时 role、超级用户凭据、
事务或备份恢复单元。

## 8. 安全要求

- 外部请求 MUST 经 Union TLS；HSTS/安全头按 HTTP v1 契约执行。
- 进程模块 MUST 默认只绑定 loopback；Service 使用受认证的 workload identity/mTLS。
- Gateway MUST 重新执行用户认证和 RBAC，并覆盖而非转发不可信身份头。
- `platform` 路由 MUST 由 Core 注入唯一、规范、1–128 字节 UTF-8 `X-Union-Principal`；worker
  MUST 通过共享 Gateway SDK 解析并记录真实操作者，不得接受本地 Cookie/Bearer 回退。
- `module` 路由仅用于 Manifest/Builder 显式允许的 Agent、Photo 设备或 Sentinel 短期媒体能力；
  模块 MUST 执行自己的领域凭据校验。Dufs 与所有浏览器管理写操作 MUST 使用 `platform` 认证。
- Host Monitoring Agent MUST 只向 Union 的公开 TLS/Gateway 发起出站连接，不得发现或直连 Host
  Worker 的 loopback endpoint，也不得获得 Core→Worker 的进程凭据。
- 配置 secret 不进入 Manifest、前端、日志、构建 profile 或 release metadata。
- Runtime MUST NOT 提供上传、安装、升级或卸载模块代码的 API；Builder 在受信构建环境中组装包时
  MUST 限制文件数、总大小、路径、符号链接和来源，防止 path/symlink escape 与供应链替换。
- 可执行模块默认视为高信任代码；开放第三方生态前 MUST 增加签名信任根、沙箱、供应链证明和
  撤销机制。
- 独立 process MUST 被表述为代码、故障、数据所有权和生命周期边界；若多个 worker 仍使用同一
  OS 身份，它不是针对被攻陷模块的凭据保密边界。低信任模块 MUST 使用独立身份/目录与资源控制，
  并采用 Unix peer credential、mTLS 或等价 workload identity，不能只依赖 loopback 和环境 token。

Photo/Dufs 的明确边界是“传输加密、服务器端明文”：TLS 终止后服务端可读取并按原始字节保存。
这不是端到端加密或应用层静态加密；透明磁盘加密是可选运维层，不改变此产品语义。

## 9. 版本要求

- Core、模块和 SDK MUST 使用 SemVer；Manifest schema 与 API version 单独版本化。
- Manifest MUST 声明兼容范围，Runtime 与 Web Shell MUST 分别校验。
- 破坏性 Platform/Plugin API 变更 MUST 增加 major；安全修复不得借兼容范围静默绕过验证。
- 模块依赖 MUST 使用稳定 ID + SemVer range；optional dependency 不得在缺失时产生未声明路由。
- registry MUST 保存精确发行版本、包摘要、Builder 来源，以及运行期启停状态和时间。

## 10. 构建与仓库边界

源码 MAY 使用 Monorepo，也 MAY 使用统一治理的多仓库。无论布局：

- Core、Web、SDK、共享库与模块依赖版本由自动化检查协调；
- Core 和每个模块包必须是逻辑独立构建产物；
- CI 必须调用同一 Builder/validator，不复制一套打包规则；
- 固定源码 revision 和 lockfile，不从浮动 branch 生成正式制品；
- 跨仓库契约修改先发布兼容 SDK，再迁移消费者，最后移除旧 API。

当前权威归属为：`union-rust` 只维护 Core/Web；`sunshine-worker` 维护 Sunshine；
`host-monitoring` 维护 Host Worker、`host-m-agent` 与 `unionc-protocol`；Sentinel、Photo、Dufs 继续
由各自仓库维护。Builder 的服务器包白名单只能从 Host 仓库取 `host-monitoring-worker`，不能把
`agent` 或整个源码仓库递归装入发行。

## 11. 完成定义

只有以下全部通过，才可称 v0.5 运行时插件架构完成：

- Platform Manifest/SDK/Event API 有 schema、文档、恶意输入与兼容测试；
- Core 在无业务编译 feature 下启动并提供所有平台能力；
- 五个模块均能由 Builder 选择为标准包，并被 Core 独立发现、迁移、启用、访问和禁用；
- profile 的包含/排除证据准确；模块代码不进入 Core/Web Shell，动态前端真实加载成功；
- RBAC、审计、任务、通知、事件和 service discovery 有端到端证据；
- process 故障不会拖垮 Core，新发行中的模块升级失败能保留旧发行/旧模块版本；
- 单模块启停不得重启无关模块；单模块配置、数据库或 readiness 失败不得阻止 Core 管理界面启动；
- 四个专用 PostgreSQL database/role 与 Dufs SQLite 例外边界通过真实存储测试；
- Photo、Dufs 以及 Sentinel/MediaMTX 等所有实际持久文件树均有 `storage_tree` 声明，绝对路径、根
  路径、词法非规范路径及同/跨模块父子重叠负测试通过；
- Builder 可独立构建/验证模块包和组合 distribution；
- `full` 服务器制品恰含五个 Worker 且不含 `host-m-agent`；Agent 只经 Union 完成真实配对和遥测，
  与 Worker 的协议兼容关系可复验；
- Linux amd64/arm64 两个服务器制品均由各自原生 CI runner 构建并通过目标清单、校验和、五 Worker
  正负集合和启动前架构门禁；Agent 的 Linux/Windows/macOS 桌面构建以及 Android/iOS/iPadOS
  嵌入库目标均通过独立 CI，且移动制品不被误装入服务器 distribution；
- 流式上传、Range、SSE/媒体、取消、TLS 与领域授权在网关后仍正确；
- 文档、仓库示例、CI 和发行元数据均不再宣称编译期模块是目标架构。

在真实数据库、文件系统、媒体和故障注入未通过前，只能称“源码实现基线通过”，不能称生产迁移
完成。
