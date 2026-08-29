# Changelog

本项目遵循语义版本。设计制品和 HTTP 契约分别在 manifest/report 中声明自己的契约版本。

## Unreleased

- 用 v0.5 运行时插件架构取代 v0.4 的编译期模块目标：Core Platform 仅保留认证、RBAC、配置、
  审计、任务、通知、注册/生命周期、Gateway、服务发现和 Event Bus 等平台能力。
- 定义 Manifest v1、Platform/Plugin API 兼容范围、独立模块包、发行内运行时发现/依赖/迁移/注册/
  启停，以及 `in_process`、`process`、`container`、`service` 四种执行适配器。
- Web Console 改为 Shell + Dynamic Module Loading；Route、Menu、Component、权限和 API base 由
  Manifest 注册，ESM 入口通过 `activate(hostSdk)` 复用 Shell React 并由单模块错误边界隔离。
- 明确 `minimal/storage/monitoring/full` 决定发行包含的模块包，不再决定 Core 的编译期能力；模块
  构建产物逻辑独立，运行时启停和页面加载不重新构建 Core/Web Shell，新增版本随新发行交付。
- 确立模块数据独占、migration 独立、禁止跨模块表访问，以及渐进 process→container/service 的
  演进路径；Dufs SQLite + rooted filesystem 继续作为记录在案的一致性例外。
- 更新实施状态：Union v0.5.0 / Builder v2.0.0 的最终 SHA、干净发行流水线、正式 Release
  和重新下载复验已完成；真实数据库/文件系统/媒体、公开 TLS、故障注入和跨模块
  E2E 仍是 production-ready 验收门禁。
- 将 HTTP inventory 改为一个 Union 公网入口加五个私有模块；`/modules/<id>` 仅表示 Web 页面，
  `/api/modules/<id>` 才是受保护 Gateway，health 只由 supervisor 探测并检查 wildcard 路由重叠。
- 明确持久 `storage_tree` 必须是模块独占、非根、规范绝对路径并拒绝父子重叠；Sentinel/MediaMTX
  录像目录声明和 Dufs health wildcard 隔离继续作为显式未完成项。
- 将 Sunshine 从 `union-rust` 拆至 `sunshine-worker`，并将 Host Worker、远端 `host-m-agent` 与共享
  `unionc-protocol` 统一归入 `host-monitoring`；`union-rust` 仅维护 Core/Web 与平台运行时。
- 将 Host Monitoring 的远端 Agent、Cargo package、可执行文件、安装服务与 Builder Release 资产
  统一命名为 `host-m-agent`；稳定网关协议路径继续使用 `/agent/v1` 和 `/agent/v2`。
- 明确 Builder `full` 是恰含五个私有 Worker 的服务器发行，不含远端 Agent；Agent 是 Host
  Monitoring companion，只经 Union 唯一公网 TLS/Gateway 配对和上报，不能直连 Worker。
- 将 Union Builder Release 定义为模块 Agent/客户端的集中官方发布面；Host 与 Photo
  仓库继续拥有源码和测试，companion 产物不进入 Union Server distribution。
  Builder v2.1.0 已集中发布并重下载复验 Host 桌面 Agent/移动 SDK 与 Photo
  Android/iOS/iPadOS 未签名客户端资产。
- 将服务器发行平台收敛为 Linux amd64/arm64，并要求发行清单与 Core 启动门禁校验目标；扩展
  Agent 矩阵为 Linux、Windows、macOS 桌面端以及 Android、iOS/iPadOS 宿主驱动的 Rust 核心库，
  明确移动编译支持不等于已经交付 APK/IPA 或拥有桌面 daemon/全系统遥测语义。
- 保留跨机 staging，同时要求 Builder install/rollback 在活动指针切换前拒绝宿主目标不匹配；
  明确 Ubuntu 24.04 原生 GNU runner 的 glibc/系统 ABI 是当前服务器兼容基线。

### Historical v0.4 architecture work

- 将产品边界收口为单一 Union 产品/Release、编译期模块选择和五个运行时私有 worker；补充
  `union-builder` CLI、静态网关、supervisor、四个官方 profile 与最终验收边界。
- 对齐 Builder 实际 profile：`minimal` 仅 Union core，`storage` 为 Photo+Dufs，`monitoring`
  为 Sentinel+Host，`full` 为全部五模块。
- 建立独立 `platform` 模块 manifest、`gateway-v1` 身份契约和 PostgreSQL 薄支持层；明确 Union
  core 保留控制面 SQLite，`sunshine`/`host_monitoring` 独立 PostgreSQL schema/role，Sentinel/
  Photo 使用专用 PostgreSQL，Dufs 保留 SQLite。
- 新增版本化且显式标记为 `draft` 的 `org.sarmg.blob-transfer@1.0.0`、Dufs/Photo 建议映射、
  已知差距、vendored 同步和输入检查；定义目标状态/错误/Range 语义，但不声称 adapter 已实现
  八项 `must`，也不合并业务实现。
- 明确所有外部传输必须经 TLS，Photo/Dufs 服务器端保存原始明文字节；摘要不构成加密。
- 更新需求、非目标、维护性、迁移门禁和 completion matrix；区分“构建里程碑正式 Release”与
  “production-ready 推广”，明确生产服务、业务数据升级和数据回滚尚待验收。
- 冻结 Builder `1a59bcf...` 主 CI 与四个官方 profile 的成功 run、artifact ID、内层 tar
  SHA-256、递归校验文件数、内容寻址 Release ID 和正负模块拓扑。
- 记录 minimal→full→minimal 的临时不可变文件槽位演练；明确它验证 Builder 安装/回滚指针
  语义，不代表 PostgreSQL/业务数据迁移、服务切换或生产故障恢复已经完成。
- 发布并复验 `union-builder v1.0.0` 的 Linux/macOS/Windows CLI 与 `SHA256SUMS`；正式发布单一
  `Union v0.4.0` full Linux 发行包，确认没有模块独立资产。
- 移除 Photo 模块 CI 的 APK/iOS `upload-artifact`，保留编译测试但不从模块仓库创建独立官方 Release；
  正式客户端资产统一由 Union Builder Release 产出。
- 从正式 Release 重新下载 Union 包，验证外层/递归校验和、五个完整源码 revision、32 个文件、
  六个可执行文件 mode、候选与正式目录一致，以及 minimal→正式 full→rollback 文件槽位语义。

## 0.1.0 - 2026-08-27

- 建立四项目迁移前/后的可执行基线和维护治理。
- 发布首版命名空间设计令牌、scoped CSS、生成 manifest、校验和及视觉基线。
- 将 Union、Photo Backup、Dufs 和 Sentinel 接入与其需求匹配的共享制品。
- 发布框架无关 HTTP v1 契约、黑盒/源码合规运行器和有期限 ADR 豁免。
