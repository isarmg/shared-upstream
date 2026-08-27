# Sarmg Shared Upstream

这里保存 `union-rust`、`dufs-ram`、`photo-backup` 和 `sentinel-monitor` 共同使用的
稳定契约、生成制品与合规测试。业务模型、业务数据库和产品页面不属于本仓库。

2026-08-27 起，Union 是唯一产品和发行单元；模块在构建时选择、运行时保持独立进程。
规范入口是 [`REQUIREMENTS-AND-BOUNDARIES.md`](REQUIREMENTS-AND-BOUNDARIES.md)，技术方案见
[`BUILD-AND-MODULE-ARCHITECTURE.md`](BUILD-AND-MODULE-ARCHITECTURE.md)，Dufs/Photo 的能力上移
评估见 [`DUFS-PHOTO-CAPABILITY-ASSESSMENT.md`](DUFS-PHOTO-CAPABILITY-ASSESSMENT.md)。

组合构建实现位于 [`union-builder`](https://github.com/isarmg/union-builder)，当前已发布
[`v0.2.0`](https://github.com/isarmg/union-builder/releases/tag/v0.2.0)。它提供本地 CLI、
精确 revision 清单、单一发行目录和可复用 GitHub Actions workflow。当前
`full-transition` 清单只表示三项外部 worker 已可组装，不等于五模块迁移完成。

当前实现覆盖共享上游方案的阶段 0–2：

- `baseline/`：项目版本、支持范围、验证命令和基线报告。
- `design/`：设计令牌、命名空间 CSS、无框架示例和视觉测试。
- `contracts/`：HTTP 错误、健康检查、认证和可观察性契约。
- `conformance/`：面向运行中服务的黑盒合规检查。
- `governance/`：所有权、评审和发布规则。
- `scripts/`：构建设计制品、同步消费者和运行基线验证。

总体技术决策见 [`ARCHITECTURE.md`](ARCHITECTURE.md)；完成范围、验证证据和未启动阶段见
[`IMPLEMENTATION-STATUS.md`](IMPLEMENTATION-STATUS.md)。

常用命令：

```bash
npm run check
npm run build:design
npm run sync:check
npm run test:design
npm run baseline:list
npm run conformance:inventory
```

设计制品由 `design/tokens/tokens.json` 和 `design/web/` 生成。消费者中的 vendored
文件不得手工修改，必须通过 `npm run sync` 更新。

## 许可证

本仓库的第一方代码、文档、测试、设计令牌和生成制品采用
[Apache License 2.0](LICENSE)。消费者不会因此取得其第三方依赖的重许可。
