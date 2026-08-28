# Sarmg Shared Upstream

本仓库是 Union 产品线的薄共享上游：保存稳定契约、设计制品、机器可读映射和合规测试，不保存
业务 Router、业务数据库、用户表或通用“万能存储”实现。

自 2026-08-27 起，产品模型固定为：

- **一个产品、一个发行单元**：Union 是唯一公开产品；模块不单独发布程序或 GitHub Release。
- **编译期选择模块**：构建清单固定源码 revision 和模块集合，发行后不能动态安装模块。
- **运行时私有进程**：Sunshine、主机监控、Sentinel Monitor、Photo Backup、Dufs 分别运行，
  仅由 Union 静态网关和 supervisor 管理；独立进程是隔离边界，不是独立产品。
- **数据独立所有**：Union core 保留控制面 SQLite；Sunshine、主机监控使用隔离 PostgreSQL
  schema/role；Sentinel、Photo 使用专用 PostgreSQL database/role；Dufs 因 rooted filesystem
  与提交日志的一致性边界继续使用自己的 SQLite。
- **传输加密、服务器明文**：外部传输必须经 TLS；Photo 与 Dufs 在服务器端保存上传的原始明文
  字节，摘要用于完整性验证，不构成端到端或静态数据加密。

## 仓库职责

- `design/`：设计令牌、命名空间 CSS、无框架示例和视觉测试。
- `contracts/http-v1.json`：健康、错误、认证、安全头、预算与日志脱敏契约。
- `contracts/blob-transfer-v1.*`：Dufs/Photo 上传、恢复、错误、摘要和 Range 的目标语义草案。
- `conformance/`：源码证据、vendored 契约同步与运行中服务的黑盒检查。
- `baseline/`、`governance/`：历史基线、所有权和发布规则。

共同实现按职责分布：`platform` 提供模块描述、PostgreSQL 薄支持层和网关身份契约；
`union-builder` 提供本地/CI 共用的声明式构建 CLI；Union 负责静态路由、认证边界、进程监管和
唯一发行。GitHub Actions 只调用 CLI，不另存一套构建逻辑。

## 权威文档

- [需求、非目标与完成定义](REQUIREMENTS-AND-BOUNDARIES.md)
- [编译期模块与运行时拓扑](BUILD-AND-MODULE-ARCHITECTURE.md)
- [实施状态与最终验收矩阵](IMPLEMENTATION-STATUS.md)
- [构建、制品与文件槽位证据](RELEASE-EVIDENCE.md)
- [Dufs/Photo 能力上移评估](DUFS-PHOTO-CAPABILITY-ASSESSMENT.md)
- [薄共享上游的设计理由](ARCHITECTURE.md)

## 当前状态

阶段 0–2（基线、设计上游、HTTP v1）已完成；`blob-transfer-v1` 草案、两个消费者的建议映射和
已知差距清单已经落地，但八项 `must` 尚未获得逐项运行时合规证据。
固定 Builder commit 的四个官方 profile 已由干净 Actions job 构建并校验，manifest 精确证明
`minimal`、`storage`、`monitoring`、`full` 的正负模块拓扑；minimal→full→minimal 的临时文件
安装/回滚演练也已通过。完整 run、artifact、SHA-256 和 Release ID 见
[构建与文件生命周期证据](RELEASE-EVIDENCE.md)。

Builder [`v1.0.0`](https://github.com/isarmg/union-builder/releases/tag/v1.0.0) 与单一 Union
[`v0.4.0`](https://github.com/isarmg/union-rust/releases/tag/v0.4.0) 已正式发布；从 Release 页面重新
下载的资产、外层/递归 SHA-256、五模块 revision、Unix mode 和文件安装/回滚均已复验。该结论是
正式发行文件证据，不等于生产迁移完成：运行时 strict conformance、真实 PostgreSQL/文件系统、
媒体、业务数据切换及故障注入仍待生产验收。详见[实施状态](IMPLEMENTATION-STATUS.md)。

## 本仓库验证

```bash
npm run check
npm run conformance:blob
npm run conformance:inventory
npm run test:design
```

`npm run sync` 会从唯一事实源更新消费者中的设计制品和 `blob-transfer-v1.json`；vendored 文件
不得手工修改。`conformance:blob` 只验证草案、建议映射、差距声明和相关源码标记，不声称运行时
合规。`conformance:live` 需要外部运行中的 Union，不属于纯源码检查。

## 许可证

本仓库的第一方代码、文档、测试、设计令牌和生成制品采用
[Apache License 2.0](LICENSE)。这不会重许可任何第三方依赖。
