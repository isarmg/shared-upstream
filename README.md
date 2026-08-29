# Sarmg Platform Upstream

本仓库定义 Sarmg/Union 插件平台的稳定契约、设计制品、合规测试和架构治理。当前架构基线是：

> **Modular Monolith 作为基础，Plugin Architecture 作为扩展机制，
> Service-oriented Deployment 作为演进方向。**

Union 是 Core Platform 和统一 Web Shell。Sunshine、Host Monitoring、Sentinel Monitor、
Photo Backup、Dufs 是由 Builder 作为独立包纳入发行、由 Core 在运行时启停的业务 Module，
而不是编译进 Core 的业务特性。
现有五个业务模块全部以受监管的本地私有进程运行；当前发行不把任何业务逻辑链接进 Core。
主机侧 `host-m-agent` 是 Host Monitoring 的远端配套客户端：源码、线协议与 Host Worker 一并归属
`host-monitoring` 仓库，但它不是第六个服务器 Module，也不进入 Builder `full` 的五 Worker
服务器 distribution；Agent 只经 Union 公网入口发起出站配对与遥测请求，不能直连私有 Worker。
`in_process` 只保留为未来受信任平台扩展的协议能力，`container`/`service` 则是需要资源隔离、
独立扩缩容或远程故障域时的演进方向，三者都不是当前五模块的交付方式。

```text
                           browser / client
                                  │ TLS
                                  ▼
              ┌─────────────────────────────────────┐
              │ Union Core + Web Shell + API Gateway │  唯一公网入口
              │ auth / RBAC / config / audit /       │
              │ registry / supervision / lifecycle   │
              └──────────────────┬───────────────────┘
                                 │ loopback + module contract
            ┌────────────┬───────┴───────┬────────────┬───────────┐
            ▼            ▼               ▼            ▼           ▼
        Sunshine       Host          Sentinel       Photo        Dufs
         worker       worker          worker        worker       worker
            │            │               │            │           │
         own DB       own DB          own DB       own DB      SQLite + FS

Builder: at release build time chooses which worker packages are included
Core:    at runtime discovers and enables/disables only those included packages
Agent:   remote host companion; outbound TLS to Union only; not in the five-worker server bundle
```

## 支持平台与交付边界

- Union Core/Web 与五个服务器 Worker 只发布 `linux/amd64` 和 `linux/arm64` 两种 distribution；
  不发布 Windows、macOS、Android、iOS 或 iPadOS 服务器制品。发行清单必须记录平台和架构，Core
  启动时必须拒绝与当前 Linux 主机不匹配的制品。
- Builder 可为另一台机器 stage 已验证包，但 install/rollback 在活动指针切换前必须匹配宿主目标。
  正式 GNU 包由 Ubuntu 24.04 原生 runner 链接，当前兼容基线受该 runner 的 glibc/系统 ABI 约束，
  “支持 Linux amd64/arm64”不自动表示兼容任意更旧的 Linux 发行版。
- Host Monitoring 的桌面 Agent 支持 Linux、Windows 与 macOS，作为远端 companion 独立安装；
  它不是服务器 Worker，也不进入 Union 的五模块 distribution。Agent 源码属于
  Host 仓库，官方产物由 Union Builder Release 从锁定 revision 集中构建和发布。
- Android、iOS 与 iPadOS 支持采用宿主应用嵌入的 Rust Agent 核心库。移动操作系统不提供普通
  常驻 daemon 语义：宿主应用负责后台执行窗口、平台权限、Keychain/Keystore 凭据和 HTTPS 调用，
  Agent 核心只生成受限、可验证的共享遥测报告。iOS 与 iPadOS 共用 Apple device/simulator 编译
  目标，由宿主传入产品身份进行区分。
- 移动库通过目标编译不等于已经交付可安装 APK/IPA；只有真实宿主应用、签名、权限、后台策略和
  设备验收全部完成后，才可以宣称相应移动端应用已经可用。
- Photo Backup 客户端源码属于 Photo 仓库，官方产物同样由 Union Builder Release
  集中发布。当前 Android arm64 未签名 APK 和 iOS/iPadOS 未签名 device `.app`
  归档是可验证的后续签名输入，不是已上架或生产信任链完成的制品。

## 仓库分工

- `upstream`：架构规范、HTTP/blob 契约、设计令牌、合规与治理；不承载业务实现。
- `platform`：Manifest v1、Platform SDK、Plugin API、Event Bus 抽象以及共享网关/数据库薄层。
- `union-rust`：只维护 Core Platform、Plugin Runtime、Web Shell、API Gateway 和内置平台能力，
  不再承载 Sunshine、Host Worker、Agent 或领域协议源码。
- `union-builder`：构建 Core 与独立模块包、校验 Manifest/制品、生成可安装分发包的 CLI；
  其 GitHub Release 同时是模块 Agent/客户端的集中官方产物发布面。
- `sunshine-worker`：Sunshine 的独立 Backend/Frontend/Manifest 与数据迁移。
- `host-monitoring`：Host Worker、远端 `host-m-agent` 和两端共享的 `unionc-protocol`；Builder 只把
  Worker 模块包纳入服务器 distribution，另在 Builder Release 构建 Agent 产物。
- `sentinel-monitor`、`photo-backup`、`dufs-ram`：其余三个独立业务模块仓库。

每个业务模块仓库拥有自己的 Backend、Frontend、Manifest、Permission Definition、Migration、
Configuration Schema 和 Version Metadata；配套客户端可以和所属业务域同仓，但必须与服务器模块包
的内容清单和生命周期分开。

源码当前采用协调式多仓库管理；这仍满足“统一工程治理、逻辑产物独立”。未来若切换 Monorepo，
必须保留同一 Manifest、SDK、数据边界和独立模块包，目录合并不能成为跨模块耦合的理由。

## 核心约束

- Core 只实现平台公共能力，不包含具体业务逻辑。
- 模块通过稳定的 Platform API、Plugin API 或事件通信，不引用其他模块内部实现。
- 模块包含集合由 Builder 在发行构建阶段确定；启停和前端装载不得要求重新构建 Core/Web Shell。
- 未包含的新模块或新版本通过新的、不可变 Union 发行引入，不允许运行中从公网任意拉取代码。
- Web 模块使用 Shell 提供的 React/runtime、全局设计 token 与基础样式，自有 CSS 按模块命名空间
  隔离，不捆绑第二份框架运行时。模块 ESM 是 Builder 验证的受信任代码而非安全沙箱；真正的
  路由和权限边界由 Core 在服务端执行。
- 四个 PostgreSQL 模块独占自己的 database/role 与 migration；Dufs 的 rooted filesystem + SQLite
  提交日志是经过明确记录的例外。任何模块不得直接修改其他模块的数据结构。
- 模块/伴随进程的持久目录必须声明为非根、规范绝对 `storage_tree`；同模块内或模块之间均不能
  相同或父子重叠。当前 Sentinel/MediaMTX 录像目录声明仍是明确的未完成项。
- 只有 Union 暴露公共 TLS 入口；进程型模块默认只监听 loopback。平台管理路由使用 Core
  会话/RBAC/CSRF 和规范 Principal；只有 Manifest 明确列出的设备/媒体路由执行模块领域授权。
- Photo 与 Dufs 只要求传输过程加密；服务器保存的是可由服务直接读取的原始明文字节。

## 权威文档

- [总体架构与决策](ARCHITECTURE.md)
- [运行时模块、包格式与部署模型](BUILD-AND-MODULE-ARCHITECTURE.md)
- [需求、边界与完成定义](REQUIREMENTS-AND-BOUNDARIES.md)
- [当前实施状态](IMPLEMENTATION-STATUS.md)
- [Dufs/Photo 能力上移评估](DUFS-PHOTO-CAPABILITY-ASSESSMENT.md)
- [v0.5 当前与 v0.4 历史发行证据](RELEASE-EVIDENCE.md)

## 本仓库验证

```bash
npm run check
npm run conformance:blob
npm run conformance:inventory
npm run test:design
```

阶段 0–2 的设计系统、HTTP v1 与基线工作继续有效；v0.4 的编译期组合证据只作为历史记录，
不再定义 v0.5+ 的目标架构。

## 许可证

本仓库第一方代码、文档、测试和生成制品采用 [Apache License 2.0](LICENSE)。第三方依赖保持其
原许可证。
