# 共享上游与平台实施状态

> 重要：下面的阶段 0–3 记录历史完成度，不代表新的进程模块目标已经完成。新的目标、门禁与
> 当前差距见 `REQUIREMENTS-AND-BOUNDARIES.md` 和 `BUILD-AND-MODULE-ARCHITECTURE.md`。
> `union-builder` 0.2.0 已发布；Sunshine/主机仍在 Union 进程内，Sentinel/Photo/Dufs 已完成
> 编译期 catalog 选择与统一组装，但仍等待静态网关和 supervisor，因此现在不能宣称五模块
> 迁移完成。

截至 2026-08-27，阶段 0、1、2 已完成。阶段 3 已进入 canary：Photo Backup 与 Sentinel
共同消费独立 `platform` 中的 PostgreSQL 薄支持层，需经过两个发布周期后才能宣布稳定。
阶段 4 的通用 HTTP middleware/响应适配仍未开始；当前 `platform-axum` 只负责发行程序中的
编译期模块组装，不承诺跨产品 HTTP 行为抽象。
`dufs-ram` 仍使用 Hyper，数据库仍按模块独立所有。

UnionC 已作为首个发行组装程序接入五模块目录：Sunshine 与主机监控是进程内模块，
Sentinel、Photo Backup 与 Dufs 是独立服务模块。外部模块首版仅贡献导航和存活状态，
不代理请求、不转发 Union 会话，也不共享用户表。

## 2026-08-27 组合构建增量

- `union-builder v0.2.0` 已发布 Linux x86-64、macOS arm64 与 Windows x86-64 CLI；可复用
  Actions workflow 只调用该 CLI，不复制构建规则。
- `profiles/full-transition.toml` 用完整 commit 固定 Union、Sentinel、Photo、Dufs；干净
  checkout 的 `plan` 及远程完整编译、组装、artifact 上传均已通过
  [最终 Actions run 33098368287](https://github.com/isarmg/union-builder/actions/runs/33098368287)。
- Union 已增加 `module-sentinel-monitor`、`module-photo-backup`、`module-dufs` Cargo feature；
  默认、无可选模块和三个单模块组合均通过编译，默认 Rust 测试通过。
- `platform-core` 直接导出版本化 manifest，Union 不再读取本机 `../../platform` 兄弟目录；
  独立 checkout 的 CI 已通过。
- Sentinel 与 Photo 默认并强制监听 loopback；Dufs 的正式组合地址由构建清单强制为 loopback。
- 三个模块仓库不再有独立发布 workflow；worker crate/binary 仍存在是运行隔离的实现细节，
  不构成独立产品或发布物。

尚未完成：Union 静态代理、worker supervisor、内部短时身份、Dufs 启动参数封闭、Sunshine/
主机 PostgreSQL 数据迁移与进程拆分、四个正式 profile 的安装/升级/回滚门禁。

## 阶段 0

- 四项目版本、框架、数据库、部署模型、浏览器范围和 quick/full 命令已机器化登记。
- 公共制品的所有权、评审和发布权限已定义。
- 改动前和改动后的四项目 quick 基线报告均为 `pass`。

## 阶段 1

- `@sarmg/design` 0.1.0 提供语义令牌、scoped reset、六行 3:2 卡片、登录页和无障碍规则。
- 生成物包含 manifest 与 SHA-256；同步脚本以精确内容检查四个消费者，禁止手工漂移。
- Union、Photo Backup、Dufs 已迁移共享样式；Sentinel 只使用 reset/accessibility，保留其监控皮肤。
- 七张视觉快照及强制色断言已通过；Dufs 的真实登录页也通过 Chromium 键盘和 forced-colors
  检查。

## 阶段 2

- HTTP v1 契约覆盖健康/就绪、错误、Cookie、CSRF、安全头、请求预算和日志脱敏。
- 报告器统一 `pass/fail/waived/not_run` 语义，支持三种有限历史错误适配器，不绑定 Axum/Hyper。
- 当前 inventory：32 项中 12 项源码证据通过、9 项有期限 ADR 豁免、11 项等待运行中服务执行。
- `SARMG_CONFORMANCE_STRICT=1` 可在 CI 中将缺少服务 URL 视为失败；报告 URL 自动删除凭据。

## 阶段 3 canary

- `sarmg-platform-postgres` 提供无业务 SQL 的连接池、migration 和 readiness。
- Photo Backup、Sentinel 已移除重复的连接池启动代码并共同消费该 crate。
- Photo Backup 增加数据库与本地存储真实 readiness，对应豁免已移除。
- 稳定条件尚未满足：需要两个消费者各完成至少两个发布周期，并确认没有产品特例进入公共 API。

## UnionC 平台组装

- `sarmg-platform-core` 提供模块 manifest、运行方式、UI 贡献、健康状态和数据库所有权契约。
- `sarmg-platform-axum` 只做编译期 Router 组装；不使用 Rust 动态插件 ABI。
- UnionC 后端和前端均通过唯一组装根注册 Sunshine 与主机监控；业务状态已拆入各模块。
- 外部服务 URL 只从启动环境读取，必须为无凭据、无查询参数的 HTTP(S) URL；探测客户端不跟随重定向。

## PostgreSQL 迁移边界

- 已提供 `core`、`sunshine`、`host_monitoring` 三个目标 schema 的 migration，并在隔离测试 schema 中验证。
- UnionC 当前运行时仍使用 SQLite；切换前必须完成数据导入器、备份/恢复、回滚演练和模块级回归测试。
- Dufs 及 Photo 移动端继续使用本地 SQLite；将它们强制改成 PostgreSQL 会破坏单文件/离线部署模型。
- 数据库的“统一”限定为 PostgreSQL 运维集群和薄启动能力，业务 schema、role、migration 与生命周期仍由模块独立所有。

## 验证命令

```bash
cd /mnt/sarmg.org/upstream
npm run check
npm run test:design
npm run conformance:inventory
npm run baseline:quick
```

生产或联调环境的黑盒检查：

```bash
UNION_BASE_URL=http://127.0.0.1:8080 \
DUFS_BASE_URL=https://127.0.0.1:5000 \
PHOTO_BACKUP_BASE_URL=http://127.0.0.1:8081 \
SENTINEL_BASE_URL=http://127.0.0.1:8082 \
SARMG_CONFORMANCE_STRICT=1 npm run conformance:live
```
