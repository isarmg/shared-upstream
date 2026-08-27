# Dufs 与 Photo Backup 重合能力评估

## 1. 结论

两者存在传输与本地存储层的重合，但领域语义不同。把共同能力“全部迁入上游”的可行性只有
**4/10**；先上移契约和合规测试的可行性 **9/10**，价值 **6/10**；现在直接抽共享实现的
价值约 **3/10**。推荐先统一词汇、状态与黑盒测试，至少两个发行周期后再决定是否抽 crate。

当前决策状态：本轮不迁移 Dufs rooted filesystem 或 Photo asset 实现，也不创建通用 Storage
trait。下一阶段只把下文列出的传输状态、错误码、Range/HEAD 行为和观测字段加入上游契约；
两模块分别通过适配器满足契约。这样能获得一致体验和测试收益，同时避免把两种故障域绑定。

## 2. 能力矩阵

| 能力 | Dufs | Photo Backup | 是否适合上移 |
|---|---|---|---|
| 大文件上传 | PUT/PATCH、目标 revision、断点状态 | manifest + 分片、哈希、complete | 只上移状态/错误契约 |
| 下载 | 任意文件、HEAD/Range、目录浏览 | 按资源和账号读取内容 | 上移 Range/缓存合规测试 |
| 完整性 | 文件系统身份、fsync、rename 结果 | part/full BLAKE3 | 上移摘要类型和校验规则 |
| 恢复 | 上传 session、unknown commit、purge job | 客户端队列、缺片查询、恢复下载 | 上移幂等/unknown 语义 |
| 删除 | rooted filesystem 持久删除/隔离回收 | 资产软删除、恢复、永久删除 | 仅共享生命周期词汇 |
| 配额/限流 | 磁盘余量、并发、搜索预算 | 账号 quota、part 上限 | 上移 admission 指标契约 |
| 去重 | 不按内容全局去重 | 账号内 content hash 去重 | 保留 Photo 领域 |
| 元数据 | 路径、inode、mtime、权限 | 时间线、相册、标签、收藏、归档 | 不上移 |
| 安全根 | openat2/rooted path/符号链接策略 | 账号对象目录 | 保留 Dufs 领域 |
| 移动同步 | 无 | 设备扫描、增量变更、缩略图、恢复 | 保留 Photo 领域 |

## 3. 立即适合进入共享上游的内容

1. `blob-transfer-v1` 文档：分片编号、大小、摘要、重试、幂等键、complete 与 unknown 结果。
2. Range/HEAD 合规套件：206/416、Content-Range、ETag、取消、慢客户端和响应体限制。
3. 存储提交测试词汇：temporary、durable、commit-started、committed、unknown、reconcile。
4. 统一错误码：hash mismatch、quota exceeded、conflict、upload expired、commit unknown。
5. 指标字段：active uploads、bytes staged、commit duration、recovery backlog、quota rejection。
6. 日志脱敏与 request-id 传播规则。

这些内容应留在 `upstream/contracts` 与 `upstream/conformance`，不应进入 platform core 的模块
注册 API。

## 4. 暂时不能共享的实现

- Dufs 的 rooted filesystem、openat2、inode/revision、符号链接、目录删除和 SQLite 恢复状态机。
- Photo 的账号隔离、PostgreSQL 行锁、content 去重、asset/resource、相册/标签/时间线和移动端队列。
- 一个同时支持 SQLite/PostgreSQL、路径/对象 ID、PUT/PATCH/multipart 的“万能 Storage trait”。

这类抽象会充满 feature flag、关联类型和产品特例，维护成本高于重复的薄 I/O 代码。

## 5. 未来抽取门槛

只有满足全部条件才建立 `blob-transfer-core`：

1. 两模块连续两个 Union Release 使用相同状态和错误契约；
2. 至少 70% 的候选代码无需产品 feature 或业务回调即可相同；
3. 真实故障测试覆盖磁盘满、进程终止、重复请求、内容损坏和恢复；
4. crate 不依赖 Axum/Hyper、SQLx/rusqlite、账号表或 rooted path；
5. 抽取后测试矩阵和升级步骤没有增加一倍以上。
