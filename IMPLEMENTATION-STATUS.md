# Union v0.5 模块化实施状态

**状态日期：2026-08-28。** 本页描述当前 v0.5 迁移源码，不把工作树测试、历史 Release 和生产
验收混为一谈。状态词含义如下：

- `仓库级已验证`：实现已存在，并有相应仓库的格式、静态检查或自动化测试结果；
- `已发布架构里程碑`：不可移动标签、正式 Release 与重新下载复验已完成，但不等于
  生产数据、网络、媒体和故障验收通过；
- `源码已实现/待集成验收`：主要路径已落地，但尚未在同一个最终、不可变发行中完成真实环境
  全链路；
- `待完成`：仍缺最终 revision 固定、正式制品或生产级测试。

## 1. 当前结论

v0.5 的迁移源码已经形成新的基线：Union Builder v2 在**发行构建阶段**选择并组装标准模块包；
Union Core 在**运行阶段**从当前发行的受信目录发现模块，完成 Manifest/版本/依赖校验、配置、
权限、migration、动态 Gateway/Web 资源注册以及启停和进程监管。Sunshine、Host Monitoring、
Sentinel Monitor、Photo Backup 和 Dufs 均以独立私有 process worker 为当前交付模式，不再作为
编译进 Core 的业务 feature，也不作为独立公网产品运行。
Sunshine 已拆到 `sunshine-worker`，Host Worker、远端 `host-m-agent` 与 `unionc-protocol` 已统一拆到
`host-monitoring`；`union-rust` 只保留 Core/Web 与平台运行时。Agent 是安装在被监控主机的 companion，
不进入五 Worker 的服务器 distribution，只经 Union 公网入口访问 Host 模块能力。
服务器源码与发行契约现只接受 Linux amd64/arm64；Host Agent 保留 Linux/Windows/macOS 桌面形态，
并新增 Android arm64、iOS/iPadOS device/simulator 的宿主驱动 Rust 库编译边界。移动库不是 daemon，
不提供或冒充 APK/IPA，凭据、HTTPS、权限与后台生命周期由宿主应用负责。Agent
与 Photo 客户端源码由所属模块仓库维护，官方产物统一由 Union Builder Release 发布；
Photo 已有 Android arm64 未签名 APK 与 iOS/iPadOS 未签名 device `.app` 构建边界。

Web 已转为统一 Shell + Dynamic Module Loading。Shell 只保留布局、认证状态、导航、权限门控、
模块加载器和错误隔离；每个模块通过 Manifest 和独立 ESM 入口注册 Route、Menu、Component 与
同源 API base。后端 Gateway 路由同样来自 Manifest，不再由 Core 为五个业务模块维护一份静态
固定路由表。

当前准确结论是：**Union `v0.5.0` 与 Builder `v2.0.0` 已完成正式标签、Release 和
重新下载复验；Builder `v2.1.0` 又完成了 Host Agent 与 Photo 客户端的集中发布和
独立复验。这些是已发布的运行时插件架构/双 Linux 架构与 companion 构建里程碑；但仍有
Dufs 私有 health 路由重叠、Sentinel storage tree 声明及 Host 稳定错误码等显式缺口，
且真实环境验收尚未完成。** 不可变证据锁定 Union
`f1cf40a8086a28fba822c0587b123c03980665d0`、Builder
`0e67aed64a239f7e74db4e30f03a2ff2c5a8790c`（v2.0 Server 组合）、
`ec74f2d235c20d3f51684558c79d51cd63015818`（v2.1 companion 发布）和 Dufs
`263778f8b34f2af77f851827fed36c924bc48b20`；完整 run、asset ID 与摘要见
[发行证据](RELEASE-EVIDENCE.md)。真实 PostgreSQL/SQLite/文件系统、媒体和跨仓库 E2E 仍须
在该发行上复验，因此不能宣称已完成生产迁移或具备 production-ready 资格。

Union v0.4.0 和 Builder v1.0.0 的编译期 feature、静态 Gateway、文件槽位与正式资产证据继续
保留，但只属于[历史证据](RELEASE-EVIDENCE.md)，不定义 v0.5 的当前实现方式。

## 2. 当前组件与职责

| 组件 | 当前源码状态 | 已有仓库级证据 | 仍需最终验收 |
|---|---|---|---|
| Platform Manifest v1 | 仓库级已验证 | 严格 JSON/Rust validator、SemVer compatibility、依赖拓扑、路径/权限/service/migration 交叉校验及恶意输入测试 | 以最终 Platform SHA 固定到 Builder、Core 和五模块 |
| Platform SDK / Event API | 仓库级已验证 | 配置、认证、审计、任务、通知、服务发现、事件与 process context 的稳定接口/模型 | Core↔五 worker 的真实 wire/event、重试和持久 transport 验收 |
| Union Builder v2 | 已发布架构里程碑 | `v2.0.0` / `0e67aed64a239f7e74db4e30f03a2ff2c5a8790c` 完成 Server 组合基线；`v2.1.0` / `ec74f2d235c20d3f51684558c79d51cd63015818` 将 Host Agent 与 Photo 客户端收敛到同一 Release；config schema v2、五模块包、Manifest validator、白名单复制、有界扫描、SHA-256、可执行位、verify/stage/install/rollback 及全部正式资产已重下载复验 | 保持不可变 pin 与 profile 正负集合；文件回滚仍不是数据库/媒体回滚 |
| 平台矩阵 | 已发布架构里程碑/待生产验收 | Union v0.5 两个 Server 资产已重下载，验证清单、可执行位和 ELF 架构；Builder v2.1 已发布并复验 Host Linux/Windows/macOS Agent、Android/iOS/iPadOS 嵌入式源码 SDK，以及 Photo Android APK 和 Apple device `.app` | Agent/Photo 产物签名、公证、商店/组织分发和真机验收；Host 移动端仍无应用壳或 APK/IPA；GNU 包以 Ubuntu 24.04 glibc/系统 ABI 为当前基线 |
| 官方 profiles | 已随 Builder v2.0/Union v0.5 发布 | `minimal=无模块`、`storage=Photo+Dufs`、`monitoring=Sentinel+Host`、`full=五模块`；模块输入均使用完整 SHA，Union caller 在发行构建时注入自身精确 SHA；正式 full amd64/arm64 包均精确包含五个 Worker 且不含 Agent | 尚未对正式 v0.5 资产运行完整真实环境生命周期、数据与故障演练 |
| Core 平台边界 | 源码已实现/待集成验收 | 业务 Cargo feature 与业务 handler 依赖已从 Core 构建图移除；Sunshine、Host Worker/Agent/协议已移出 `union-rust`；认证、RBAC、配置、审计、任务、通知、注册、生命周期、Gateway、发现与事件为平台能力；`f1cf40a8086a28fba822c0587b123c03980665d0` 已将实际 Core 数据根及 Plugin Runtime 状态根纳入保留路径 | 最终无业务代码制品审计及五模块同时运行的资源/故障验证；真实部署路径、symlink/bind mount 和独立身份隔离仍须验收 |
| Plugin Runtime / catalog | 源码已实现/待集成验收 | 从发行内模块根 discovery/rescan；Manifest compatibility/dependency 检查；配置、权限、migration、前后端资源和生命周期状态管理；只接受发行已包含模块 | 候选 slot 上的首次发现、重启恢复、并发生命周期、失败升级保留旧发行和移除包保留数据测试 |
| Process supervisor | 源码已实现/待集成验收 | loopback 分配、标准 process 环境、启动/停止、健康、退避和状态模型；五模块均声明 `process` | 真 worker 崩溃循环、慢停机、强杀、Core 重启和资源上限演练 |
| 动态 Manifest Gateway | 源码已实现/待集成验收 | `/api/modules/<id>` canonical mount、Manifest route/method/auth/permission、header 清理、prefix rewrite；共享 Gateway SDK 对唯一 UTF-8 Principal 做 fail-closed 校验；Dufs module-local `/` 仅挂在自己的 canonical base 下 | 上传、HEAD/Range、SSE、WHEP/HLS、取消、慢客户端、CSRF/领域授权和大 body 黑盒 |
| Web Shell | 源码已实现/待浏览器 E2E | catalog 获取、按启用状态生成导航、动态 ESM/style 装载、`activate(hostSdk)`、Shell React 复用、权限过滤、单模块错误边界；Host 配对激活页已迁入模块且区分 Agent capability 与管理员 RBAC 端点 | 最终 Builder 包的五入口在浏览器真实加载；启停后 route/menu/style 清理；缓存、升级和 CSP 测试 |
| RBAC / 配置 / Migration | 源码已实现/待真实数据验收 | 平台权限与模块命名空间、配置 schema/secret 边界、模块独立 migration；PostgreSQL database/role 唯一；已声明 `storage_tree` 的绝对规范路径、父子重叠及 Core 保留根重叠均被拒绝，外置 `UNIONC_PLUGIN_STATE_DIR` 也在保留范围 | Sentinel/MediaMTX 补 storage tree 声明；非管理员负测试、secret 日志扫描、真实数据库迁移锁/恢复点/失败重试和审计证据；验证 symlink/bind mount 等非词法别名 |
| 任务 / 通知 / Event Bus | 源码已实现/待跨进程验收 | 平台级注册、触发、查询、发布/读取/确认和声明 topic 的仓库测试 | 五 worker 真实消费者、幂等、乱序/重复、Core 重启和 durable transport 边界 |

## 3. 五个标准模块包

每个模块现在拥有 Backend、Frontend、`manifest.json`、`permissions.json`、
`config/schema.json`、`version.json` 和独立 migration 声明。Builder 从源码白名单组装
`modules/<id>`，并从锁定 Git revision 生成最终 source metadata；它不会把整个源码树、`.git`、
`target`、mobile 或 docs 复制进发行。

| 模块 | 包与运行方式 | 数据所有权 | 当前状态与主要待办 |
|---|---|---|---|
| Sunshine | 独立 `sunshine-worker` 仓库根标准包；私有 process | dedicated PostgreSQL database + role；库内保留 `sunshine` schema | `d6e6d944c75bd2666deb2a472a874c659cbb8da6` 已包含独立 worker、Manifest、config、migration，以及按原交互恢复并适配动态 Shell/RBAC 的模块前端；待远端 CI、旧数据停写、导入/复验、Gateway 与回滚候选演练 |
| Host Monitoring | 独立 `host-monitoring/host-monitoring-worker` 标准包；私有 process，Manifest args 包含 `serve`；同仓 Agent 不进入服务器包 | dedicated PostgreSQL database + role；库内保留 `host_monitoring` schema | `bb301742e8f6c7c181b17b0191e62b99bf42ebdb` 已将 Agent 产品、安装服务与发布资产统一命名为 `host-m-agent`，恢复模块前端并保留既有线协议；Builder v2.1 曾从前序 `d80053fcd7edc924b2890784f50be3864e7e1585` 集中发布旧命名桌面包与移动 SDK，当前新命名资产待下一次 Builder Release；移动端仍没有 APK/IPA、宿主后台承诺或桌面等价整机遥测；待签名/公证、真实宿主 App、Agent 配对、历史导入、长连接/重启及数据回滚 |
| Sentinel Monitor | 独立仓库根标准包；私有 process | 专用 PostgreSQL database/role；媒体与 MediaMTX 的领域所有权归模块，但录像目录尚未声明 `storage_tree` | Manifest/Frontend/配置/路由已迁移；先补 MediaMTX 持久目录声明与冲突门禁，再做真实摄像头、ONVIF、UDP、WHEP/HLS/SSE、录像与故障隔离联调 |
| Photo Backup | 独立仓库根标准包；私有 process | 专用 PostgreSQL database/role + 模块明文内容目录 | `41c67959ff901cdc6c5caac3e678ea8430f0ec7c` 的上传/资源库、标准包、Android arm64 未签名 APK 和 iOS/iPadOS 未签名 device `.app` 已由 Builder v2.1 集中发布并重下载复验；待公网 TLS 网关、大文件恢复、配额、签名/真机客户端、真实存储故障与数据恢复 |
| Dufs | 独立仓库根标准包；私有 process | rooted filesystem + embedded SQLite，作为明确例外；serve/state tree 均有独立声明 | `263778f8b34f2af77f851827fed36c924bc48b20` 已规范化 Linux 平台相关的 `stat.st_nlink` 类型并增加原生 ARM64 check/release build 门禁，Builder `0e67aed64a239f7e74db4e30f03a2ff2c5a8790c` 已在 `storage/full` 固定该 revision；当前 GET/HEAD catch-all 仍覆盖 supervisor health path，须先加 Gateway deny/拆路由，再做上传/Range/RBAC、磁盘故障和恢复验证 |

五模块的监听端口是 Core 管理的本地私有端点。它们没有独立公网入口，浏览器和客户端只能通过
Union TLS/Gateway 访问。进程隔离提供独立故障域，但不等同于容器沙箱；container/service 是后续
演进适配器，不是当前五模块已经完成的部署模式。同一 `unionc` OS 身份也不能抵御恶意模块读取
兄弟进程或文件；当前校验和与固定 revision 建立的是受信官方代码供应链，不是第三方插件安全
沙箱。独立身份/cgroup/namespace 或 container/service 隔离仍属于低信任模块上线前门禁。

远端 `host-m-agent` 不监听 Union 的模块端口，也不由 Core supervisor 启停。它与 Host Worker
共用 `host-monitoring` 仓库和协议是为了消除 wire DTO 漂移，不改变部署边界：服务器 `full` 包仍
只有五个 Worker，Agent 在远端主机独立安装并只向 Union 发起出站 TLS 请求。

## 4. 数据与迁移状态

| 所有者 | 当前目标 | 必须保持的边界 |
|---|---|---|
| Union Core | 独立 SQLite + Core 私有数据根 | 只持有平台身份、RBAC、配置、审计、任务、通知、registry/lifecycle 等平台数据；实际解析的 `UNIONC_DATA_DIR` 及 Plugin Runtime 状态根是模块不可重叠的保留目录；不得读写模块业务表 |
| Sunshine | dedicated PostgreSQL database + role（库内 `sunshine` schema） | 自有 migration/凭据/备份；不能与 Host/Sentinel/Photo 共用 database 或 join/修改其数据 |
| Host Monitoring | dedicated PostgreSQL database + role（库内 `host_monitoring` schema） | 自有 migration/凭据/遥测生命周期；与 Core 旧表切换须有可复验 journal，不能与 Sunshine 共用 database |
| Sentinel Monitor | dedicated PostgreSQL database + role；目标为模块独占媒体目录 | 摄像头凭据、事件、录像与 MediaMTX 状态归 Sentinel；当前配置 Schema 未以 `storage_tree` 声明录像目录，不能宣称平台已验证目录隔离 |
| Photo Backup | dedicated PostgreSQL database + role + 明文内容存储 | PostgreSQL 管元数据/事务；服务器保存 TLS 解密后的原始明文字节，不宣称端到端或静态应用层加密 |
| Dufs | rooted filesystem + SQLite | 有意不迁 PostgreSQL；提交日志与文件在同一所有权和故障恢复边界 |

“统一数据库运维”不表示共享 database、业务 schema、表、role、超级用户或跨模块事务；四个
PostgreSQL 模块必须各用自己的 database + role。文件 release rollback 也不会自动逆转 migration、
数据库、媒体或文件内容；每个模块必须单独证明备份、恢复点和旧版本兼容性。

Union `f1cf40a8086a28fba822c0587b123c03980665d0` 已对配置 Schema 中声明的 `storage_tree` 强制非根、
词法规范化绝对路径，并拒绝同模块内及跨模块相同或父子重叠。Core 启动时还把实际解析后的
`UNIONC_DATA_DIR` 与 Plugin Runtime 状态根作为保留 tree 注入配置注册表；即使通过
`UNIONC_PLUGIN_STATE_DIR` 外置，模块目录与这些根相同、为其祖先或后代也会 fail-closed。当前门禁
覆盖 Photo 内容目录与 Dufs serve/state 目录；冲突的磁盘旧配置会保留但不注入 worker。Sentinel 的
MediaMTX 录像目录尚未声明，因此仍是完成门禁而不是已实现证据。该检查是词法误配置门禁，尚不
识别 symlink、bind mount 或同一底层文件系统对象的别名，也不替代独立 OS 身份/目录权限验收。

## 5. 仓库级验证与证据边界

本轮迁移已通过相关仓库的格式、静态检查和自动化测试；其中 Builder v2 已对五个真实工作区
Manifest/package 执行 check/plan，并通过自身 package、供应链边界、校验和、安装和文件回滚测试。
Dufs `263778f8b34f2af77f851827fed36c924bc48b20` 已修复此前完整 ARM64 组合构建暴露的 link-count
类型差异并加入原生 ARM64 门禁，Builder `0e67aed64a239f7e74db4e30f03a2ff2c5a8790c` 已随
`v2.0.0` 固定该输入；
Union `f1cf40a8086a28fba822c0587b123c03980665d0` 已补齐 Core/Plugin 状态根保留测试。Host
前序 `d80053fcd7edc924b2890784f50be3864e7e1585` 的桌面三系统与 Android/Apple 移动库 CI 已通过；
当前 `bb301742e8f6c7c181b17b0191e62b99bf42ebdb` 的重命名和前端恢复已通过本地 workspace、目标编译、
打包契约与 Web 测试，但新提交的远端 CI 与 Builder 新名称 Release 尚待运行；
Photo `41c67959ff901cdc6c5caac3e678ea8430f0ec7c` 的 Android/Apple 客户端构建 CI 也已通过。
Builder `v2.1.0` 正式运行 `33185010955` 随后从这两个不可变 revision
重建并发布了 Host/Photo companion；14 个 Release 资产的精确名称、SHA-256、
包格式和关键内容已通过独立重下载复验。

当前 [HTTP inventory](conformance/reports/inventory-2026-08-28.json) 已按一个公网 Core + 五个私有
模块重新生成：41 项源码/Manifest 检查通过，Host 稳定错误码与 Dufs 两个 health 私有性检查共
3 项有期限豁免，Core 的 4 项公开 live 检查在未提供 `UNION_BASE_URL` 时为 `not_run`。该报告不再
用 `/modules/...` Web 路由冒充 worker API/health，也不把 inventory 当成线上 E2E。
此外，Core 当前 health handler 源码未显式设置 `Cache-Control: no-store`；conformance 保留该严格
live 断言，正式验收前必须补齐或用真实响应证明等价的全局策略，不能在 inventory 中预先记为通过。

当前正式 Release 已完成的是不可变源码/制品链、双架构、五模块集合、模式位和摘要复验，
以及 Builder v2.1 对 Host/Photo companion 的集中未签名产物交付。
尚未完成的是在该正式 full 制品上执行真实数据库、文件系统、媒体、TLS 和跨模块 E2E；
也尚未建立远端 companion 的生产签名、公证、分发与真机验收证据。

本 upstream 仓库继续使用以下本地门禁：

```bash
cd /mnt/sarmg.org/upstream
npm run check
npm run conformance:blob
npm run conformance:inventory
npm run test:design
```

HTTP/blob 阶段 0–2 的设计与契约基线仍有效。`blob-transfer-v1` 仍是显式 draft：它记录 Dufs/Photo
可能共享的传输语义和差距，不代表两个模块已经实现同一业务层，也不能作为正式 adapter 合规声明。

## 6. v0.5 完成门禁

以下事项全部完成前，状态保持“源码实现基线”，不得升级为“生产迁移完成”：

1. **已完成发行里程碑部分：** Platform、Union、Builder、五模块候选源码使用完整不可变 SHA，
   Union v0.5 / Builder v2.0 正式 Server 发行链及 Builder v2.1 companion 发行链已冻结；
2. **已完成发行里程碑部分：** 在干净 CI 分别针对 Linux amd64/arm64 构建 `full`，并验证包正负集合、Manifest、权限、
   config/version、migration、可执行位、有界文件清单和 SHA-256；`full` 必须含五个 Worker 且不含
   `host-m-agent`、Agent 安装器或 Host 仓库其他源码；
3. **已完成：** 发布并重新下载验证 Builder v2.0、Builder v2.1 与 Union v0.5 的不可移动
   tag/Release；旧 v0.4/v1 标签未移动或覆盖；
4. 从最终 full slot 启动 Core，逐个发现、配置、迁移、启用、访问、禁用和重启五模块，并证明
   未包含模块不能运行、禁用模块不会留下 Gateway/Web 注册；
5. 为 Sentinel/MediaMTX 补齐 `storage_tree`，并在真实 Core 数据根/外置 Plugin 状态根、PostgreSQL、
   Dufs SQLite/rooted filesystem、Photo 内容目录和媒体目录执行绝对/重叠资源负测试、升级、失败、备份、恢复及文件
   release/data rollback 分离演练；
6. 通过公开 TLS 后的认证/RBAC/CSRF、上传、HEAD/Range、SSE、WHEP/HLS、取消、大文件、慢客户端、
   磁盘满、进程崩溃和 Core 重启 E2E；另从远端 Agent 只经 Union 完成配对/报告，并证明无法直连
   Host Worker；
7. 冻结最终 SHA、CI run、asset ID、摘要、内容 ID和验收报告，并在本文与 Release 正文中继续明确
   架构里程碑和 production-ready 资格是两个不同结论。
8. 在允许低信任或第三方模块前，为每个 worker 建立独立 OS/workload identity、私有目录与资源
   限额，并验证它不能读取 Core/兄弟模块凭据、状态或数据库连接；仅独立 PID 不满足此门禁。

当前 [RELEASE-EVIDENCE.md](RELEASE-EVIDENCE.md) 已分开记录 v0.5/Builder v2 正式发行与
v0.4/Builder v1 历史证据。完成剩余真实环境门禁后，才能把状态升级为生产迁移完成。
