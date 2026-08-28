# Blob transfer contract v1 draft

本草案描述 Dufs 与 Photo Backup 值得收敛到上游的目标传输语义，但不共享领域实现，也不表示
两个模块已经满足全部要求。机器可读正文为 [`blob-transfer-v1.json`](blob-transfer-v1.json)，
其中的 `must` 是未来合规门槛，不是当前完成声明。

## 状态与恢复

`planned → staging → commit_started → committed` 是成功路径。`rejected` 表示已确定失败且可按
业务规则重新开始；`expired` 表示服务器没有可恢复记录；`unknown` 表示请求可能已经提交，
客户端必须先查询 checkpoint/最终对象，禁止盲目重放。模块可以有更细的内部状态，但适配器
必须保守映射；不能把不确定结果映射成失败或成功。

## 两个建议适配器

- Dufs 保留 `X-Dufs-*` 头、路径 revision、inode/rooted filesystem 和 SQLite 提交日志。
- Photo Backup 保留 manifest/part API、BLAKE3、账号内 content 去重、PostgreSQL 行锁和资产模型。

建议只共享状态词汇、稳定错误类别、摘要表示、HEAD/Range 行为、幂等和观测字段。任何试图把
路径与 asset ID、SQLite 与 PostgreSQL、PUT/PATCH 与 multipart 合成一个万能 trait 的改动都
超出本契约边界。

## 安全与明文边界

传输必须经过 Union TLS 网关。契约不定义静态数据加密。Photo Backup 的正式编码固定为
`plain-v1`：服务器提交的字节与客户端资源字节一致；Dufs 同样保存调用方上传的原始字节。
摘要验证完整性，不构成加密。

## 合规

`conformance/blob-transfer-projects.json` 固定两个实现的**建议**状态/错误映射、已知缺口和相关
源码标记。`npm run conformance:blob` 只校验草案身份、建议词汇覆盖、vendored 内容一致以及相关
标记仍存在；它不验证八项 `must`，也不证明 adapter 或运行时已经合规。内容摘要、持久化
`commit_started/unknown`、磁盘满、重复请求、进程终止和提交响应丢失等行为必须先在各模块实现，
再由真实写入黑盒/故障测试逐项提供证据。
