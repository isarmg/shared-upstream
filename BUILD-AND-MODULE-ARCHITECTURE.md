# 编译期模块、运行时进程隔离与单一发行

## 1. 结论

方案可行且值得实施：综合可行性 **8/10**、长期价值 **8/10**、维护性 **7/10**。五个模块已
足以抵消构建矩阵、进程协议和联调成本。它借鉴 Linux Kconfig 的“构建前确定能力集合”，不
借鉴内核的单地址空间或可装载模块 ABI。

```text
fixed profile + exact revisions
              │
              ▼
        union-builder CLI  ◀── GitHub Actions 只调用同一 CLI
              │
              ├── 编译 Union（选中 module-* feature）
              ├── 编译选中 worker 与前端
              └── 组装一个 Union release + manifest + SHA-256
                                      │
                                      ▼
                         TLS ──▶ Union 静态网关
                                      │
                              supervisor + gateway-v1
                ┌──────────┬──────────┼──────────┬──────────┐
                ▼          ▼          ▼          ▼          ▼
             Sunshine     Host     Sentinel    Photo       Dufs
              worker     worker     worker      worker      worker
                         loopback/private runtime services
```

编译期决定 catalog、网关路由、前端入口、worker 二进制、migration 清单和发行文件。运行时只
允许启停已编译模块，不能靠环境变量、复制二进制或扫描目录增加能力。

## 2. 五模块拓扑

| 模块 | 源码位置 | 私有运行形态 | 数据所有权 | Union 公开路径职责 |
|---|---|---|---|---|
| Sunshine | `union-rust/sunshine-worker` | loopback worker | PostgreSQL `sunshine` | 管理 API，经 Union 会话/CSRF |
| 主机监控 | `union-rust/host-monitoring-worker` | loopback worker | PostgreSQL `host_monitoring` | 管理 API 受会话保护；Agent API 保留设备认证 |
| Sentinel Monitor | `sentinel-monitor` | loopback worker；MediaMTX 为受管伴随进程 | 专用 PostgreSQL/`sentinel_monitor_runtime` role | 摄像头 UI/API 和媒体反代 |
| Photo Backup | `photo-backup` | loopback worker | 专用 PostgreSQL/`photo_backup_runtime` role；原始媒体在文件/对象存储 | 移动/管理 API、上传与下载 |
| Dufs | `dufs-ram` | loopback worker | 本地 SQLite + rooted filesystem | 文件、目录、上传与下载 |

Union core 有意保留控制面 SQLite，不是 PostgreSQL 迁移目标。Sunshine/主机可共享 PostgreSQL
集群但隔离 schema/role，Sentinel/Photo 采用专用数据库/role。Dufs 保留自己的 SQLite。跨所有权
边界的外键、写入、运行时 join、共享 migration 或共享业务 repository 均禁止。

所有 worker 都使用固定路由、固定 loopback bind、带 audience 的 `gateway-v1` 内部身份和健康
回显完成兼容门禁。Union 不接受管理员填写任意 upstream URL，也不把 Union Cookie 作为内部
身份转发。模块仍可保留其领域认证，例如 Photo 设备 token、主机 Agent token 和 Dufs 文件访问
规则；“Union 唯一入口”不等于删除领域授权。

## 3. union-builder 与单一 Release

独立仓库 [`union-builder`](https://github.com/isarmg/union-builder) 是构建规则的唯一实现。
它提供本地 CLI；可复用 GitHub Actions workflow 负责准备固定工具链、调用 CLI、上传制品和
创建 **一个 Union Release**，不复制 Cargo/npm/组装决策。

构建器负责：

- 校验完整 commit revision、模块 ID、feature、静态 route、loopback 地址和端口冲突；
- 以受约束参数执行 Cargo 与前端构建，不执行 profile 提供的任意 shell；
- 只编译被选模块，安装 worker 到 `libexec/union/modules/`；
- 组装 Union 前端和模块前端、release manifest 及递归 SHA-256；
- 对已存在输出目录、浮动 revision、带凭据 URL 和不安全路径直接失败。

已发布的 `v0.2.0` 是过渡构建器与历史验证基线。Builder commit `1a59bcf...` 的主 CI 和四个
官方 profile Actions run 已成功；四份制品通过内层 tar SHA-256、递归 `verify`、manifest 正负
拓扑和 worker `0755` 检查。minimal→full→minimal 的临时不可变槽位安装/回滚也已通过。精确
run、artifact、hash 与 Release ID 见 [构建与文件生命周期证据](RELEASE-EVIDENCE.md)。

Builder `v1.0.0` 与 Union `v0.4.0` 已正式发布；Release 页面下载的三平台 Builder CLI、单一 Union
full 包和各自 `SHA256SUMS` 均已复验。Actions artifact 仍只是构建证据，不是新的产品或模块
Release；长期公开发行以 Union `v0.4.0` 的一个 full 包为准。

构建器不负责生成生产秘密、替管理员选择数据目录、修改防火墙或把模块 migration 合并为一套
事务。安装器可以调用模块迁移命令，但数据所有权仍在模块。

## 4. 官方 profile

| Profile | 编译模块 | 验收目标 |
|---|---|---|
| `minimal` | 无可选模块（仅 Union core） | 最小控制面、认证、安装和回滚基线 |
| `storage` | Dufs、Photo Backup | 文件和照片路径、Range、上传恢复 |
| `monitoring` | Sentinel、主机监控 | 摄像头、媒体、Agent 与遥测 |
| `full` | 全部五模块 | 唯一 production-ready 推广阻断级集成门禁 |

自定义 profile 是高级功能。CLI 保证构建图合法并编译、组装选中模块；调用方 CI 仍必须运行
所有选中模块的测试。维护者只对以上四种组合承诺安装级验证，不测试五模块的全部 32 种组合。

## 5. 数据迁移门禁

Sunshine 与主机监控从旧 Union SQLite 域表切换时必须按以下顺序执行；两个所有者分别迁移，
不能用一次跨域事务掩盖所有权。Union core 自己的控制面表原地保留在 SQLite：

1. 固定旧版与新版 revision，备份 SQLite 和目标 PostgreSQL；
2. 在停写窗口运行模块自己的 migration 和一次性 importer；
3. 比较行数、关键字段、摘要和引用完整性；有差异即拒绝切换；
4. 启动私有 worker，经 Union 网关执行读写与健康检查；
5. 正常服务请求路径不再读写旧 Sunshine/Host 表；它们只作为迁移、回滚或备份校验工具的只读
   证据保留，禁止新旧两端同时写；
6. 回滚时先停新写入、验证证据、恢复旧版本与旧数据，再开放流量。

只有新 worker 的切换、运行和回滚验收完成后，才能通过单独 migration 删除 Union SQLite 中的
旧 Sunshine/Host 域表；不得删除 Union core 的认证、设置和控制面表。

Photo/Sentinel 继续拥有既有专用 PostgreSQL。Dufs 不进入该迁移：其 SQLite 提交日志必须与
rooted filesystem 位于同一故障域；在设计多节点 fencing 和分区语义前迁到 PostgreSQL 会降低
正确性，而不是提高统一性。

## 6. 维护性与取舍

收益：构建内容可追溯、未选模块没有路由/worker、模块崩溃不拖垮网关、Release 与安全更新只
维护一条路径，GitHub Actions 不再散落构建业务逻辑。

成本：代理必须覆盖流式 body、SSE、Range、大文件和媒体路径；进程间 DTO、超时、取消、日志、
身份与数据库迁移都必须显式版本化；单一 Release 会增加跨仓库协调。

控制成本的方法是：固定五个模块和四个官方 profile、保持共享层薄、用契约而不是共享业务
代码、只在两个消费者经历至少两个 Union Release 且实现高度同构后抽公共 crate。

## 7. 当前实现与最终验收

| 能力 | 已有实现事实 | 尚未关闭的发行门禁 |
|---|---|---|
| 声明式 CLI/单目录组装 | Builder `v1.0.0` 已发布；三平台资产、`SHA256SUMS`、四 profile 和正式 Union full 资产均复验 | 新版本继续固定工具链并保存 Release 证据 |
| 五模块编译选择 | 四 profile manifest/目录精确证明未选模块不入制品、选中 worker 为 `0755` | 在正式 `full` 运行时验证 catalog、静态路由和模块启停，而非只检查文件 |
| 静态网关与 supervisor | 固定路由、内部身份、健康门禁、崩溃退避/退出处理已实现并有单元测试 | 在 `full` 制品验证流式上传、Range、SSE/媒体、重启和优雅退出 |
| Sunshine/主机数据拆分 | 独立 PostgreSQL schema、import/verify/rollback 命令与仓库级真实 PG 测试已实现 | 对发布候选数据集完成一次可审计切换/回滚演练 |
| Union core 数据库 | 控制面 SQLite 是既定最终方案；旧域表退出正常服务读写路径 | 验证只读迁移/回滚证据移除不影响 core 备份、恢复与升级 |
| Dufs/Photo 共性 | `blob-transfer-v1` 草案、vendored 副本、建议映射、已知差距及相关源码标记检查已落地 | 实现八项 `must`，再由发行制品执行内容损坏、磁盘满、响应丢失、重复提交等行为验证；当前不声称合规 |
| 唯一公共产品 | 模块独立 Release workflow 已移除，私有 worker 边界已实现 | 验证安装后无模块公网监听、无独立登录/发布入口 |
| 不可变文件安装/回滚 | minimal→full→minimal 的临时 slot 演练通过；`current`/`previous` 和两个 slot 的递归校验正确 | 正式环境完成服务切换、模块数据迁移与回滚；文件指针测试不能替代它们 |

因此，当前可以称为“最终架构源码、固定组合和正式发行文件已验证”，但不能在运行时、数据与
故障门禁全部通过前称为“生产迁移完成”。
