# 运行时模块、包格式与部署架构

## 1. 从编译期功能切换到运行时模块

v0.4 的 `module-*` Cargo feature 和静态 catalog 只保留为历史兼容证据。v0.5+ 将“包含”和
“运行”分为两个明确阶段：Core/Web Shell 构建一次，Builder 在发行构建阶段选择并组装独立、
可验证的模块包；Union 在运行阶段发现并启停本发行已包含的模块。业务实现不再通过 Core Cargo
feature 编译进去。

```text
Core source ───────────────▶ union-core package ──────┐
Web Shell source ──────────▶ web-shell assets ────────┤
                                                       ├─▶ distribution
Module A source ───────────▶ module-a package ────────┤
Module B source ───────────▶ module-b package ────────┘

Builder: choose included packages → verify → assemble immutable release
Runtime: discover → validate → resolve → migrate → register → start → ready → enable
```

Builder profile 描述当前发行**包含的模块包集合**，不改变 Core 二进制能够理解的通用插件协议。
`minimal`、`storage`、`monitoring`、`full` 可继续作为官方发行集合。管理员可在运行时启用或禁用
其中模块；加入未包含模块或升级模块代码必须生成并切换到新的 Union 发行，运行中不从公网任意
拉取可执行代码。

官方 `full` 是**服务器发行图**：只包含 Sunshine、Host Monitoring、Sentinel Monitor、Photo Backup
和 Dufs 五个私有 Worker。`host-monitoring` 仓库中的远端 `host-m-agent` 与 Host Worker 共用协议和
版本治理，但不复制进该服务器 distribution；它在被监控主机独立安装，只通过 Union 公网网关
通信。Builder 的模块 profile 不应把 companion 客户端误算为第六个 Module 或受监管本地进程。
Agent 与 Photo 客户端的源码仍由所属模块仓库维护，但官方产物由 Builder Release
从完整不可变 revision 集中构建、生成统一摘要并发布。这不会把 companion 纳入 Server
distribution，也不会把 Builder 变成客户端源码所有者。

## 2. 标准模块包

模块包根目录必须自包含、不可在运行时回读源码仓库：

```text
<module-id>/
├── manifest.json
├── permissions.json
├── config/
│   └── schema.json
├── version.json
├── backend/
│   └── <executable-or-adapter>
├── frontend/
│   ├── entry.js
│   └── *.css
└── migrations/
    └── ...
```

`manifest.json` 是发现入口；其他文件必须通过其相对路径声明。模块可以显式没有 Web 贡献，但不得
省略版本、权限、配置和 migration 元数据。Dufs 以 `embedded` migration runner 声明其 SQLite
升级，不伪造 SQL 目录。

包校验至少包括：

- 模块 ID、语义版本、Manifest schema 和 API 兼容范围；
- 所有路径相对、归一化、无符号链接逃逸、无重复/未知关键声明；
- Backend、Frontend、权限、配置、migration 和版本元数据完整；
- 文件清单、长度、SHA-256 和可执行位与包索引一致；
- 路由/权限/事件均位于模块命名空间；
- 依赖存在、版本满足且图无环；
- 执行适配器属于 Core 管理员允许的类型。

生产发行还应增加发布签名或可信透明日志。摘要能发现损坏，但不单独证明发布者身份。

## 3. Manifest v1

Manifest 至少描述：

- `manifest_version`、`id`、`version`、显示信息和版本元数据；
- Core、Platform API、Plugin API 兼容范围；
- 可选模块依赖及其版本范围；
- `in_process`、`process`、`container` 或 `service` 执行方式；
- Backend API base、路由、方法、权限和服务发现信息；
- Frontend entry、styles、components、routes、menu 和 API base；
- 权限定义；
- migration engine、目录/schema 或 embedded runner；
- JSON Schema 配置入口、schema 版本和 secret 字段；
- 健康检查、生命周期超时、服务、发布/订阅事件。

固定公开命名空间：

| 类型 | 规则 |
|---|---|
| Backend API | `/api/modules/<module-id>` |
| Web route | `/modules/<module-id>` 及其子路径 |
| Web assets | `/modules/<module-id>/assets/<relative-path>` |
| Permission | `<module-id>.<resource>.<action>` 或模块声明的等价命名空间 |
| Event topic | `<module-id>.<domain>.<event>` |

Manifest 不能携带任意 shell 命令、生产秘密或无约束的远程 URL。服务目标由可信的
管理员配置和物理机 systemd 服务解析，不能由上传包任意选择容器运行时、Kubernetes context
或公网回源。

Health path 不属于上述 Backend API 命名空间：它只由 supervisor 使用内部 service endpoint 探测。
validator 必须对 route pattern 做重叠判断，不能只比较字符串；`/{*path}` 覆盖 health path 时必须
拒绝或在完成修复前留下显式豁免，不能把 health 暴露成普通业务 API。

## 4. 发行组装、切换、启用和禁用

### 发行组装与首次注册

1. Builder 将所选包复制到非活动发行 staging 目录并验证摘要、Manifest 和路径。
2. 在当前 registry 快照上检查兼容范围、依赖和冲突。
3. 注册权限/配置和 migration 元数据；进程模块在受监管启动阶段执行其唯一 migration ledger，
   其他执行模式由明确注册的可信 runner 编排。
4. 启动执行单元并通过 liveness/readiness；只有 readiness 成功才视为 migration 完成并开放流量。
5. Union 切换到该发行后，对启用模块发布路由、菜单、任务、服务和事件订阅。
6. 写入审计事件并通知 Web Shell 刷新 catalog。

### 发行升级

新旧 Union 发行使用独立不可变目录，模块新版本由 Builder 随新发行纳入。新版本未 ready 前旧发行
继续服务；切换失败恢复旧 registry 和流量。
数据库 migration 通常不可逆，因此升级前必须备份并执行模块定义的兼容门禁。Core 不能声称二进制
回切等于数据回滚。

### 禁用

禁用按反向依赖顺序执行：停止接收新请求和任务、撤销菜单/路由/订阅、等待在途工作、停止执行
单元、标记 disabled。被其他启用模块硬依赖时拒绝禁用，除非先禁用依赖方。

### 从后续发行移除

模块应先在当前发行中 disabled，再由后续 Builder 配置从发行集合移除。切换后旧不可变发行仍可
用于文件回滚；配置、审计与业务数据默认保留。数据清理是单独、明确且可审计的管理员操作。

## 5. 执行适配器

### In-process

只允许随 Core 信任根注册的工厂，不从上传包直接 `dlopen` 任意动态库。插件获得按模块限定的 SDK
handle；panic/error 受隔离，但进程崩溃风险无法完全消除。升级通常需要重新启动 Core，因此它是
性能优化，不是默认模式。

### Process

当前五个模块的默认模式。Manifest 声明包内相对 executable 和结构化参数；Core 生成短期 gateway
身份、限定环境、工作目录和 loopback endpoint，监管启动、健康、优雅退出与退避重启。禁止
`sh -c` 和任意脚本拼接。

### Container

Manifest 只引用经过策略允许的 image/artifact identity；可信 adapter 负责资源限制、只读根、
网络、secret mount 和健康。Core 不直接暴露容器守护进程能力给模块。

### Service

管理员将逻辑 service name 绑定到经过验证的 endpoint；Service 使用 mTLS/workload identity，
网关应用超时、取消、重试预算和熔断。涉及非幂等写入时不得透明重试，除非请求携带稳定幂等键。

## 6. Web 动态装载

Shell 请求运行时 catalog，对每个 enabled 模块重新检查兼容范围和权限，再按版本化 URL加载 CSS
及 ESM entry。入口 default export 提供模块 ID、精确版本、Plugin API 版本和
`activate(hostSdk)`；返回值只能实现 Manifest 已声明的 component。

Host SDK 提供 Shell 自己的 React、默认以模块 API base 为前缀的 request、导航与权限查询。
Route/Menu 来自已验证 Manifest，而不是由可执行 JavaScript临时扩大。样式按模块命名空间隔离；
加载失败、版本不符或渲染异常进入单模块错误边界。

同源 ESM 是 Builder 纳入不可变发行的受信任代码，不是 JavaScript 沙箱。Host SDK、API base 和
前端 permission 只定义支持接口与界面行为；它们不能阻止脚本直接调用同源 API。Core 必须对每次
请求执行真实的会话、RBAC、CSRF、Manifest route 与 Gateway 门禁。

若模块只提供已有完整 Web 应用，可先由动态组件呈现同源 gateway frame/入口；应逐步迁移到原生
Shell 组件，但不能因此让 Core 复制业务 UI。

## 7. 数据 migration

- 每个 PostgreSQL 模块使用专用 database/role 和独立 migration ledger；可在自己的 database 内
  使用命名 schema。migration 文件随包版本发布。
- Core 只编排、门禁和记录 migration，不拥有业务 SQL，也不在跨模块事务中升级多个 schema。
  当前进程模块由模块自身 SQLx ledger 执行包内 migration，Core 不重复执行同一 SQL；未来若改用
  Core runner，Manifest 必须显式声明唯一 executor，禁止双账本。
- 同一模块升级必须串行、持有 advisory/lease lock，并记录 applied version/checksum。
- migration 在启用路由前完成；失败时模块保持不可用，其他模块不受影响。
- Dufs 使用它自己的 embedded SQLite migration 与 rooted filesystem 恢复协议。
- 每个持久文件树通过配置 Schema 的 `x-union-resource: storage_tree` 声明；Core 只接受非根、词法
  规范化绝对路径，并拒绝同模块内或跨模块相同/父子重叠的声明。伴随进程的目录同样归其模块申报。
- 删除表、不可逆重写和大规模 backfill 必须采用 expand/migrate/contract，多版本兼容后再清理。

## 8. Builder 与 CI/CD

`union-builder` 是本地和 GitHub Actions 共用的构建/验证 CLI。v2 的职责是：

- 固定源码 revision 和工具链；
- 单独构建 Core/Web Shell；
- 单独构建每个模块 Backend/Frontend 并生成标准包；
- 调用 Platform Manifest validator；
- 生成文件索引、SHA-256、SBOM/provenance 扩展位和总 distribution；
- 验证已存在的模块包或 distribution；
- staging/activate/rollback 不把数据回滚与文件回滚混为一谈；
- 发行 profile 精确记录包含/不包含哪些模块包，未选模块不得出现在制品中。

GitHub Actions 只准备环境并调用 CLI，不复制构建逻辑。模块可以独立生成模块包和版本，但 Union
发布包含所选模块包的单一 Union 发行。模块包版本与 Core 版本逻辑解耦，由兼容范围决定能否纳入
并启用，但模块不绕过 Union 单独成为公网产品。

当前源码输入是协调式多仓库：`union-rust` 提供 Core/Web，`sunshine-worker` 提供 Sunshine 包，
`host-monitoring/host-monitoring-worker` 提供 Host 包，另外三个模块由各自仓库根提供。Builder 必须
分别固定这些仓库的完整 commit。`host-monitoring/agent` 与 `host-monitoring/protocol` 属于 Host
业务域的源码和兼容性测试输入，但只有 Worker 目录进入服务器模块包白名单。

### 8.1 服务器目标与制品命名

Builder v2 的服务器目标是封闭枚举，不接受任意 Cargo target：

| `--server-target` | 发行清单 | Rust target | 原生构建 runner |
|---|---|---|---|
| `linux-amd64` | `platform=linux`, `architecture=amd64` | `x86_64-unknown-linux-gnu` | Linux x86_64 |
| `linux-arm64` | `platform=linux`, `architecture=arm64` | `aarch64-unknown-linux-gnu` | Linux aarch64 |

Reusable workflow 必须显式接收 `server-target`，在构建前用实际 kernel/machine 验证 runner，并将
目标同时写入 `union-release.json`。上传 artifact 使用
`<prefix>-<server-target>`，其中模式保留 tar 为 `union-distribution-<server-target>.tar`，tar 内根
目录继续固定为 `union-distribution/`。Union 正式 Release 再把这两个经过验证的输入分别封装为
`union-<version>-full-linux-amd64.tar.gz` 与 `union-<version>-full-linux-arm64.tar.gz`，并生成一个
同时覆盖两者的外层 `SHA256SUMS`。

Core 在读取发行 inventory 时再次比较 `distribution.platform/architecture` 与当前进程，避免把
正确校验但目标错误的包激活。Builder CLI 自身可以为了开发者便利发布 Linux、Windows、macOS
可执行文件；那只是构建工具的宿主矩阵，不扩大 Union Server 的 Linux amd64/arm64 支持范围。
Builder 的 staging 保持跨机能力，但 install/rollback 在切换活动指针前再次执行宿主目标匹配。
服务器 GNU 二进制由 Ubuntu 24.04 原生 runner 链接，因此当前实际兼容基线包含该环境的 glibc/
系统 ABI；若需支持更旧 Linux，必须显式采用并验证更旧 sysroot 或新的 musl 构建契约。

Host Monitoring companion 使用另一条客户端矩阵：桌面 Agent 是 Linux/Windows/macOS 原生程序；
Android arm64 与 iOS/iPadOS device/simulator 只编译无桌面默认 feature 的嵌入核心库。移动宿主
负责生命周期、权限、安全凭据、HTTPS 和平台打包，Agent 库或服务器发行均不产生 APK/IPA。
Photo 客户端当前产出 Android arm64 未签名 release APK 和 iOS/iPadOS 未签名 device
`.app` 归档。Builder 必须将这些标记为后续签名输入，不得声称完成商店上架。

## 9. 官方验收矩阵

| 层级 | 必测内容 |
|---|---|
| Manifest | schema、恶意路径、命名空间、SemVer、未知字段、循环/冲突依赖 |
| Runtime | 发现、迁移、注册、启停、健康、崩溃退避、并发生命周期、审计 |
| Upgrade | 新版 ready 后原子切换；失败保留旧版；依赖方兼容 |
| Web | 动态入口、权限过滤、路由/菜单、缓存版本、样式清理、错误隔离 |
| Gateway | auth/RBAC、流式 body、SSE、Range、取消、限额、服务身份 |
| Data | database/role 隔离、migration 锁、备份/恢复、无跨模块写入 |
| Deploy | process/container/service adapter 策略与故障隔离 |
| Supply chain | checksum、签名策略、固定 revision、SBOM/provenance |
| Platform matrix | 两个 Linux server 原生 runner、目标清单/拒绝门禁；三桌面 Agent 与 Android/Apple 移动库编译边界 |

源码单元测试通过只能证明实现基线；真实 PostgreSQL、文件系统、媒体、故障注入和版本升级演练仍是
生产发布门禁。
