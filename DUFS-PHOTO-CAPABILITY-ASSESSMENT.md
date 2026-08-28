# Dufs 与 Photo Backup 共性能力上移评估

## 结论

两者存在可共享的**传输协议和平台适配能力**，但不应把文件系统与相册业务合并进 Core。最佳上移
层级是：

1. `upstream` 保存框架无关的 `blob-transfer-v1` 行为契约和黑盒合规测试；
2. `platform` 提供可选的流式 body、摘要、幂等键、checkpoint、Range、错误与观测适配器；
3. Dufs/Photo 各自实现存储、事务、ACL、资产模型和恢复策略；
4. Union Gateway 只保证认证/RBAC、限额、流式透传、取消和统一外部 TLS。

该上移方案可行性约 **8/10**、价值约 **8/10**；把 Dufs/Photo 业务实现直接迁入 Core 的价值约
**2/10**，维护风险高，不应实施。

## 值得共享的能力

| 能力 | 最佳所有者 | 原因 |
|---|---|---|
| upload id / operation id 语义 | upstream contract | 与存储模型无关，便于客户端恢复 |
| 标准 problem/error code | upstream contract + SDK types | Gateway、Web、移动端可一致解释 |
| BLAKE3/SHA-256 摘要元数据 | SDK helper | 算法和头字段可复用，事务仍归模块 |
| checkpoint/status/unknown | contract + adapter | 响应丢失后避免盲目重复写入 |
| HEAD/Range/ETag 条件请求 | contract + HTTP adapter | Dufs/Photo 都需要，但资源标识不同 |
| streaming/backpressure/cancel | gateway/platform adapter | 防止 Core 缓冲大文件，保持取消传播 |
| request limits/timeout/metrics | Core policy + SDK hooks | 属于平台横切能力 |
| 上传任务与通知事件 | task/notification/event API | UI 可统一展示，不共享业务数据库 |
| Web 上传控件视觉基础 | design tokens/可选组件 | 共享可访问性和状态呈现，不共享业务页 |

这些能力只有在两个消费者以同构方式稳定使用并有合规测试后，才应从契约进一步抽为 Rust/TypeScript
库。先抽一个“万能 blob repository”会把错误抽象固化为 API。

## 不应上移的能力

- Dufs 的 rooted filesystem、目录遍历、symlink/mount 边界、文件 ACL 和 SQLite 提交日志；
- Photo 的 asset、album、timeline、duplicate stack、metadata、thumbnail、移动端队列和设备 token；
- 两者各自的删除/回收、磁盘布局、数据库 schema、migration 和领域审计；
- 将文件对象伪装成照片 asset，或让 Photo 直接查询 Dufs SQLite/目录；
- 在 Core 中建立跨两模块的共享业务表或事务。

如果未来 Photo 选择 Dufs 作为一个 blob provider，也必须通过版本化 Plugin API，把它视为可替换
存储后端；Photo 仍拥有 asset 元数据和一致性，不得直接操作 Dufs 内部路径或数据库。

## Plugin Architecture 下的具体落点

两个模块分别声明：

- `/api/modules/dufs` 与 `/api/modules/photo-backup` API 命名空间；
- 自己的读取、上传、删除、管理权限；
- 自己的配置 schema、migration 和健康检查；
- `blob.upload.*` 等稳定 Platform API 能力版本（若实现后）；
- `dufs.file.*`、`photo-backup.asset.*` 等独立事件主题。

Core 可以把两者的长传输显示在统一任务中心，把成功/失败显示为统一通知，但任务 payload 只保存
稳定资源引用，不复制模块的业务对象。模块禁用后历史审计仍可读，业务详情则明确显示模块不可用。

## 加密边界

外部传输必须经过 TLS；Gateway 到独立 Service 使用 mTLS 或等价受认证加密，loopback process 段
可按部署威胁模型选择本地明文。服务器接收后保存原始、可由服务直接读取的明文字节。摘要用于
完整性和幂等，不是加密；不得在 UI 或文档中称为端到端加密或静态内容加密。

## 数据库结论

Photo 使用 PostgreSQL，Dufs 保留 SQLite + filesystem 的本地一致性边界。两者统一 migration
描述和状态接口，而非统一数据库引擎。强制 Dufs 迁移 PostgreSQL 不会提高插件兼容性；插件边界
依赖 Manifest/API/事件，不依赖相同 Web framework 或相同存储引擎。

两者的目录也不共享：Photo 内容根、Dufs serve root 与 Dufs SQLite state root 分别通过
`x-union-resource: storage_tree` 声明。Core 要求非根、词法规范化绝对路径，并拒绝同模块内或
模块之间相同/父子重叠；这防止误配置造成跨模块写入，但不替代 symlink/mount 与 OS 权限验收。

## 迁移顺序

1. 保持并补齐 `blob-transfer-v1` 的运行时合规测试；
2. 在 Platform SDK 定义纯协议类型和流式适配器，不包含 storage trait 的业务假设；
3. Dufs/Photo 分别接入并证明原有 Range、取消、完整性和恢复语义未回归；
4. Gateway 执行大 body 无缓冲透传、限额、取消和错误映射测试；
5. 至少两个正式模块版本稳定后，再评估抽取更高层实现。

这使共享能力能独立演进，同时避免 Core 成为新的文件/照片“大泥球”。
