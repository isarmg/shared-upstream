# Sarmg 薄共享上游架构

## 1. 决策

`union-rust`、`dufs-ram`、`photo-backup`、`sentinel-monitor` 共享稳定行为和视觉基础，但不共享
领域模型。最优上游是**契约、生成制品和合规测试**，不是统一 Web framework、数据库或
`AppState`。

产品运行形态由[发行体系规范](REQUIREMENTS-AND-BOUNDARIES.md)定义：Union 唯一发行，五模块
编译期选择、运行时私有进程。共享运行时能力位于 sibling `platform` 仓库，组合构建位于
`union-builder`，它们都不应把业务代码反向塞入本仓库。

## 2. 分层

```text
upstream       设计令牌、HTTP/blob 契约、黑盒合规、治理
     │
platform       module manifest、gateway-v1、PostgreSQL 薄启动能力
     │
Union          产品 catalog、静态网关、认证边界、supervisor、单一发行
     │
workers        Sunshine / Host / Sentinel / Photo / Dufs 领域实现与数据
```

依赖只能向上使用稳定契约。upstream 不导入业务 crate；platform 不包含业务 SQL；Union 不跨
schema 写模块数据；worker 不获取 Union Cookie 密钥或任意控制面状态。

## 3. 共享准入规则

优先级依次为：

1. 先写框架无关、机器可读的行为契约；
2. 各消费者用 adapter 和源码/黑盒证据满足契约；
3. 至少两个消费者连续两个正式 Union Release 保持同构；
4. 候选实现不依赖产品状态、数据库或 Web framework，才抽公共 crate。

少量重复薄代码优于错误抽象。共同使用 Rust/Tokio/Serde 或都提供上传 API，不足以证明应共享
Router、repository 或事务。

## 4. 当前共享内容

### 设计系统

`design/tokens/tokens.json` 是语义令牌唯一事实源；`design/web/` 生成命名空间 CSS。Union、
Photo、Dufs 消费适合其页面的制品；Sentinel 只使用 reset/accessibility，保留监控视觉。React、
Android Compose、SwiftUI 和各模块业务组件不进入上游。

### HTTP v1

[`contracts/http-v1.json`](contracts/http-v1.json) 定义错误、live/ready、Cookie/CSRF、安全头、
请求预算和日志脱敏。不同 Axum/Hyper wire 形态可用有限 adapter 归一化，安全要求不能豁免。

### Blob transfer v1

[`contracts/blob-transfer-v1.md`](contracts/blob-transfer-v1.md) 是已被 Dufs/Photo vendored 的目标
语义草案，建议统一状态、稳定错误、摘要、幂等、checkpoint、unknown、HEAD/Range 与观测字段。
当前建议映射和已知缺口可机器校验，但尚未证明八项 `must` 的运行时合规。草案明确不共享
filesystem、asset、SQL 或 handler。外部经 TLS，服务器保存原始明文字节。

### PostgreSQL 与网关

这些是 `platform` 的薄实现而非本仓库内容：PostgreSQL 层只提供 pool/migration/readiness；
`gateway-v1` 只提供 token/audience/protocol/prefix 身份。schema、SQL、认证和业务 DTO 留在 worker。

## 5. 技术栈与数据库选择

Dufs 不需要为共享上游迁移到 Axum。其 Hyper 流式 body、Range、取消和 rooted filesystem 状态机
具有独立价值；迁移技术上约 **6/10** 可行，但单为共享上游而迁移的价值约 **2/10**。只有迁移
本身带来产品收益且现有语义测试完整时才应考虑替换路由层。

数据库也不做形式统一：Union core 保留控制面 SQLite；Sunshine/Host 使用隔离 PostgreSQL
schema/role；Sentinel/Photo 使用专用 PostgreSQL；Dufs 使用 SQLite + 文件系统；Photo 移动端和
Union Agent 保留设备本地数据库。旧 Union SQLite 中的 Sunshine/Host 域表只作为只读迁移/回滚
来源，切换验收完成后才可删除。统一的是所有权、备份、migration、readiness 和验收规则，不是
业务表。

因此，共享 PostgreSQL 运维基线的可行性约 **8/10**、维护价值约 **7/10**；强制把 Union core、
Dufs 和设备离线库也迁入 PostgreSQL 的可行性约 **3/10**，且会扩大故障域与测试矩阵，维护收益
为负。旧 Sunshine/Host 域表已经退出正常服务请求的读写路径，只允许显式迁移、回滚或备份校验
工具只读使用，最终切换验收后再删除。

## 6. 安全边界

- Union 是唯一公共 TLS 入口，worker 固定 loopback/private。
- gateway identity 证明请求来自本次 Union supervisor，不替代模块领域授权。
- Union 管理会话 Cookie 不转发给 worker；主机 Agent、Photo 设备和 Dufs ACL 仍各自验证。
- Photo/Dufs 内容在服务器端是应用可直接读取的明文；摘要不是加密。透明磁盘加密属于运维层。
- 生产秘密不得进入 upstream 制品、Builder profile、前端或 Release manifest。

## 7. 维护性结论

薄上游降低视觉、安全行为和传输语义漂移，且不会把五个故障域绑定在一起，维护收益高。主要
风险是契约无限扩张和平台层吸收业务特例；治理上以机器 schema、适配器、抽取门槛和明确
non-goals 控制。任何新增共享 API 都必须同时说明两个真实消费者、兼容策略和删除/升级成本。

当前结论已有正式发行证据：Builder `v1.0.0`、四个官方 profile 和单一 Union `v0.4.0` 的文件
清单、校验和及文件槽位回滚均已验证。它仍不是生产迁移完成声明；真实数据库/文件系统、网关、
媒体、数据切换与故障恢复状态以 [`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md) 为准。
