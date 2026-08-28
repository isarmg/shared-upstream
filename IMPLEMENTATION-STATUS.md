# Union 模块化实施状态

**状态日期：2026-08-27。** 本表区分三种含义：`已验证` 表示已有可重复的仓库级测试或既有 CI
证据；`已实现/待集成验收` 表示源码存在且局部测试通过，但尚未在同一最终 Release 完成全链路；
`待完成` 表示仍缺实现或正式制品。不能把前两者混写成生产迁移已经完成。

## 1. 总体结论

最终架构的主要模块源码已经落地：独立 `union-builder`、五模块编译期 feature/spec、五个私有
worker、静态 Union 网关/supervisor、`gateway-v1` 内部身份、Sunshine/主机 PostgreSQL 拆分以及
Dufs/Photo `blob-transfer-v1` 评估草案。阶段 0–2 的共享上游基线仍有效。

四个官方 profile 已在同一固定 Builder commit 上完成干净 Actions 构建、递归校验和、manifest
正负拓扑检查；minimal→full→minimal 的临时不可变文件槽位演练也已通过。证据见
[构建与文件生命周期证据](RELEASE-EVIDENCE.md)。

Builder `v1.0.0` 和单一 Union `v0.4.0` 已正式发布，并从 Release 页面完成独立下载复验。当前仍
不满足[完成定义](REQUIREMENTS-AND-BOUNDARIES.md#6-模块化迁移完成的定义)：`full` 制品的运行时
strict 检查、真实 PostgreSQL/文件系统、业务数据切换、媒体和跨模块故障测试仍待最终验收。
准确表述是“最终架构源码、组合构建和正式发行已验证，生产运行与数据迁移验收未收口”。

## 2. 完成矩阵

| 工作流 | 状态 | 已有证据 | 最终验收待办 |
|---|---|---|---|
| 阶段 0：四仓库基线/治理 | 已验证 | 机器化项目清单、前后 quick 报告、维护规则 | 后续发布持续更新 revision |
| 阶段 1：共享设计 | 已验证 | `@sarmg/design`、manifest/SHA-256、消费者同步、视觉快照 | 正式 Release 重新生成并校验 |
| 阶段 2：HTTP v1 | 已验证（源码/历史 live） | 机器契约、源码/黑盒运行器、ADR 豁免模型；配置已收敛到单一 `UNION_BASE_URL` 和模块 prefix | 在最终 Union URL 运行 strict live |
| Blob transfer v1 | 已完成评估/草案；未实现合规 | 标记为 `draft` 的机器契约、Dufs/Photo vendored 副本、建议状态/错误映射、已知缺口和相关源码标记检查 | 逐项实现八项 `must`，再以 `storage/full` 黑盒与故障注入验证；此前不得声称 adapter 合规 |
| platform 薄公共层 | 已验证（仓库级） | 模块 manifest、PostgreSQL 薄层、`gateway-v1` crate 与单元测试 | 以最终 commit 固定到全部消费者 |
| union-builder CLI | 已验证/已发布 | `v1.0.0` run `33130162873` 全绿；三平台 CLI 与 `SHA256SUMS` 从 Release 下载复验，Linux CLI 报告 1.0.0 | 后续补签名/attestation；不得移动版本标签 |
| 官方 profile 拓扑 | 已验证（Actions 与正式制品） | 四个成功 run、artifact ID、内层 tar SHA-256、内容 ID、manifest 和目录负证据均已冻结；正式 Union full 资产再次通过相同检查 | 继续把每个新 Union Release 的资产与 revision 写入证据 |
| 五模块编译期选择 | 已验证（制品拓扑）/待运行验收 | `minimal=core only`、`storage=Photo+Dufs`、`monitoring=Sentinel+Host`、`full=五模块`；被选 worker 均为 `0755` | 对 `full` 的 catalog、静态路由、前端与实际 worker 启停执行运行时检查 |
| 静态网关/内部身份 | 已实现/待集成验收 | 固定 upstream、header 清理、prefix rewrite、健康 identity 单测 | 真正上传、Range、SSE、媒体和认证/CSRF 黑盒 |
| supervisor | 已实现/待集成验收 | 私有 bind/env、PID/status、退避、SIGTERM/kill 测试 | 安装制品的崩溃循环和优雅停机演练 |
| Union core SQLite | 已实现；待迁移后清理验收 | 控制面继续使用 SQLite；正常服务请求路径不再读写旧 Sunshine/Host 域表，显式迁移/回滚/备份校验工具只能只读访问 | Sunshine/Host 切换验收后删除其旧域表，并回归 core 备份/恢复 |
| Sunshine worker | 已实现/待切换验收 | 独立 crate、PostgreSQL schema、import/verify/rollback 与真实 PG 测试 | 发布候选旧数据停写切换/回滚 |
| 主机监控 worker | 已实现/待切换验收 | 独立 crate、PG schema、遥测导入与 HTTP 生命周期测试 | 发布候选 Agent/管理路径及回滚 |
| Sentinel worker | 已实现/待集成验收 | loopback/gateway middleware、模块 prefix、MediaMTX 私有反代源码 | 最终前端、WHEP/HLS/SSE/UDP 部署联调 |
| Photo worker | 已验证（仓库级）/待集成 | loopback/gateway、plain-v1、Range/HEAD/ETag 和既有上传测试；blob 草案仍有持久化 `commit_started/unknown` 等缺口 | TLS 网关大文件、配额、恢复和移动客户端联调；补齐草案 `must` 行为 |
| Dufs worker | 已验证（仓库级）/待集成 | 私有 gateway、固定 loopback、SQLite/file 与上传恢复语义；最终提交 CI `33128684316` 成功；尚无草案要求的内容摘要 manifest | Union 下上传/Range 与存储故障测试；补齐草案 `must` 行为 |
| 独立模块 Release 移除 | 已实现 | 模块独立发布 workflow 已删除；Photo CI 只构建测试且不再上传 APK/iOS 可安装制品；worker 是内部制品 | GitHub 规则/最终仓库扫描防止重新引入；正式客户端只能随 Union Release 分发 |
| 单一 Union Release | 已验证（发行文件） | `v0.4.0` run `33131309723` 的 16 jobs 全绿；Release 仅有 full tar.gz 与外层 `SHA256SUMS`，下载后安全解包并递归验证 | 后续版本继续禁止模块独立资产；生产运行门禁另行验收 |
| 安装/升级/回滚 | 正式制品文件生命周期已验证；数据/服务待完成 | 正式 Builder CLI 对 minimal→正式 `v0.4.0` full→rollback minimal 演练通过，`current`/`previous` 正确且两个不可变 slot 均通过 `verify` | 完成服务、PostgreSQL/FS、业务数据迁移及故障回滚演练 |

## 3. 数据状态

| 所有者 | 目标 | 状态与边界 |
|---|---|---|
| Union core | 控制面 SQLite | 正常服务运行时只读写 core 表；物理库暂时仍可包含旧 Sunshine/Host 域表，仅允许显式迁移、回滚或备份校验工具把它们作为只读证据，验收后才删除 |
| Sunshine | PostgreSQL `sunshine` | worker migration/import/verify/rollback 已实现；正式切换待发行验收 |
| 主机监控 | PostgreSQL `host_monitoring` | worker migration/import/verify/rollback 已实现；正式切换待发行验收 |
| Sentinel | 专用 PostgreSQL + `sentinel_monitor_runtime` role | 模块独占 database；MediaMTX 为受管伴随进程而非共享数据库 |
| Photo Backup | 专用 PostgreSQL + `photo_backup_runtime` role + 明文内容存储 | PostgreSQL 仅元数据/事务；`plain-v1` 原始字节不做端到端加密 |
| Dufs | SQLite + rooted filesystem | 有意例外；提交日志和文件在同一故障域，不迁 PostgreSQL |

数据库“统一”仅指需要服务型数据库的四个模块采用 PostgreSQL 运维基线和共同的连接/migration
薄能力，不表示共享 schema/database、role、业务表、事务或生命周期。Union core、Dufs 和设备
离线库保留 SQLite，是明确且有意的边界。

## 4. 已落地的 Dufs/Photo 评估与草案

`blob-transfer-v1` 已把 canonical 状态、六类稳定错误、256-bit lowercase hex 摘要、幂等/
checkpoint/unknown 结果、原子提交、HEAD/单 Range 与观测字段写成版本化目标。Dufs 和 Photo
各自保留 Hyper/Axum、SQLite/PostgreSQL、路径/资产 ID 和 PUT/PATCH/multipart 实现。

这项工作完成的是共性评估、草案、建议映射和差距透明化，不是“共享语义已经合规”，也不是
“共享业务实现”。Dufs 尚缺内容摘要 manifest/hash mismatch；Photo 的持久状态仍为
`uploading|complete|failed`，没有耐久的 `commit_started|unknown`。是否抽取无 framework/database
的公共 crate，要先补齐真实行为与故障测试，再在两个**合规**正式 Union Release 后按
[能力评估](DUFS-PHOTO-CAPABILITY-ASSESSMENT.md)重新判断；当前计数为 `0/2`。

## 5. 验证命令

本仓库纯源码门禁：

```bash
cd /mnt/sarmg.org/upstream
npm run check
npm run conformance:blob
npm run conformance:inventory
npm run test:design
```

四个 profile 已从 Builder 固定 revision 的干净 Actions job 构建，不以当前多仓库工作树作为
制品证据；详细输入和输出见 [RELEASE-EVIDENCE.md](RELEASE-EVIDENCE.md)。HTTP live 配置已经
切换到单一 Union URL 与静态模块 prefix；随后仍须让运行时 strict conformance、真实
PostgreSQL/文件系统、公开 TLS、业务数据迁移、媒体与故障注入都通过，才把生产运行验收更新为
完成；正式 Release 附件及外层校验和已经通过，证据不再与运行时待办混写。
