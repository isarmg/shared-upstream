# Dufs 与 Photo Backup 共性上移评估

## 1. 已执行的结论

Dufs 与 Photo Backup 在传输层有真实重合，在业务层没有。把所有能力和实现合并到 Union/
platform 的可行性仅 **4/10**、维护价值约 **3/10**；上移稳定语义、机器契约和合规测试的
可行性 **9/10**、价值 **7/10**。因此已选择后者并落地 `blob-transfer-v1` **草案和差距评估**，
没有创建共享 Storage trait，也没有迁移任何业务 SQL 或文件系统实现。

评估产物已经存在于源码中，包括
[`contracts/blob-transfer-v1.json`](contracts/blob-transfer-v1.json)、
[`contracts/blob-transfer-v1.md`](contracts/blob-transfer-v1.md)、两个消费者的建议映射/相关源码标记以及
`npm run conformance:blob`。同一草案已 vendored 到 Dufs 和 Photo，`sync:check` 会阻止漂移；该
命令只验证建议映射词汇、已知缺口和相关源码标记，不验证八项 `must`。`storage`/`full` Actions
制品及 Union `v0.4.0` 只证明两个 worker 被同一 profile 打包，不证明它们采用或符合草案，因此
抽取门槛计数为 **0/2**。

## 2. 重合能力、建议共享与不共享

| 能力 | Dufs | Photo Backup | 最终边界 |
|---|---|---|---|
| 上传 | PUT/PATCH、目标 revision、断点状态 | manifest、分片、BLAKE3、complete | 建议共享状态、幂等、checkpoint、错误目标；不共享 handler |
| 下载 | 文件 HEAD/Range/ETag | 账号资源 HEAD/Range/ETag | 建议共享 206/416 与缓存语义测试 |
| 完整性 | 文件/提交身份与持久化结果；没有内容摘要 manifest | part/full 内容摘要 | 草案目标是共享 256-bit 摘要表示和验证要求；Dufs 尚有缺口 |
| 不确定提交 | 有恢复记录，但草案映射不是已发布状态 API | 持久状态仅 `uploading|complete|failed` | `commit_started/unknown` 是目标保守语义，尚未双方实现 |
| 删除 | rooted filesystem 删除/隔离回收 | 资产软删除、恢复、永久删除 | 不共享业务状态机 |
| 配额 | 磁盘容量、并发、搜索预算 | 账号配额、part 上限 | 只建议共享 `quota_exceeded` 和观测字段 |
| 去重/元数据 | 路径、inode、mtime、权限 | 账号内 hash、相册、标签、时间线 | 保留各模块 |
| 数据库 | SQLite 与文件提交同故障域 | PostgreSQL 元数据/事务 | 不统一 schema/repository |

目标稳定错误类为 `hash_mismatch`、`quota_exceeded`、`target_conflict`、`upload_expired`、
`invalid_checkpoint`、`commit_unknown`。模块可以保留自己的 wire 字段和更细状态；只有真实
adapter 实现并经行为测试后，才能宣称它不会把不确定结果错误映射成成功或确定失败。

## 3. 安全与明文边界

外部上传、下载和管理 API 必须经 Union TLS 网关，worker 只监听私有 loopback。TLS 终止后，
Photo 和 Dufs 把调用方上传的原始字节写入受控服务器存储；正式 Photo 编码是 `plain-v1`。
这里明确不做客户端端到端加密，也不要求应用层静态加密。BLAKE3/SHA-256 用于完整性、去重或
ETag，不是加密。

服务器明文是产品需求，不等于取消主机安全：数据目录仍应使用最小权限、备份访问控制和需要时
由运维提供的磁盘/卷加密。卷加密对应用透明，不能改变 `plain-v1` 的恢复语义。

## 4. 为什么不合并业务实现

- Dufs 的 rooted filesystem、openat2、inode/revision、符号链接策略、目录操作和 SQLite 恢复
  必须在同一文件故障域内保持正确。
- Photo 的账号隔离、PostgreSQL 行锁、内容去重、asset/resource、相册/标签/时间线和移动端队列
  是照片领域能力。
- 同时抽象路径/对象 ID、SQLite/PostgreSQL、PUT/PATCH/multipart 和不同权限模型，只会产生
  大量 feature、回调与关联类型，扩大测试矩阵和跨模块发布耦合。
- 把字节搬运代码放到 Union 网关还会迫使控制面理解持久化提交，破坏 worker 故障隔离。

因此，上游只拥有目标词汇、错误、wire 约束草案和未来黑盒测试入口；platform 只拥有模块/网关/
数据库启动薄能力；领域实现继续由两个模块维护。

## 5. 合规与剩余门禁

当前源码门禁：

```bash
npm run sync:check
npm run conformance:blob
```

它们验证草案身份、两个**建议映射**覆盖目标词汇、已知缺口非空、vendored 内容一致和相关源码
标记存在，不验证 adapter 或运行时合规。各模块的既有测试覆盖部分常规上传、完整性或 Range
行为；`storage/full` Actions 制品及 Union `v0.4.0` 的 manifest、目录拓扑和校验和证据见
[RELEASE-EVIDENCE.md](RELEASE-EVIDENCE.md)，这些是打包证据。后续仍需先实现缺少的摘要/耐久状态，
再执行真实磁盘满、慢客户端、进程终止、重复请求、内容损坏、提交响应丢失和恢复测试。

只有以下条件连续满足后，才重新评估 `blob-transfer-core`：

1. 两模块连续两个正式 Union Release 逐项符合同一契约且无产品特例进入公共 API；
2. 至少 70% 候选代码无需业务回调或产品 feature 即可相同；
3. 上述故障注入全部自动化；
4. crate 不依赖 Axum/Hyper、SQLx/rusqlite、账号表或 rooted path；
5. 抽取后测试和升级矩阵没有增加一倍以上。

在达到门槛前，少量重复 I/O 代码是有意的隔离成本，不是待清理的技术债。
