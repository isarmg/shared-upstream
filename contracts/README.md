# Shared contracts

本目录定义 Union Core 与五个模块共同遵守的、与 Rust Web 框架无关的 HTTP 行为。当前 inventory
登记一个 `public_ingress`（Union Core）和五个 `private_module`（Sunshine、Host、Sentinel、Photo、
Dufs）。只有 Core 接受 `UNION_BASE_URL` 并执行公网 live 检查；模块不得声明直接 live base URL。
远端 `host-m-agent` 是 Host Monitoring companion，而不是第六个 HTTP conformance project：它不在
服务器 distribution 中提供入口，只能经 Union 访问 Host Worker 的 Manifest capability 路由。

三类路径必须严格区分：

- `/modules/<id>` 是 Web Shell 页面路由，只返回 Shell 文档或动态模块页面；
- `/api/modules/<id>` 是 Manifest 声明、Core 会话/RBAC/CSRF 或模块 capability 保护的 Gateway API；
- Manifest 的 `health.liveness_path` / `health.readiness_path` 是 Core supervisor 访问 loopback worker 的
  私有探针，不是模块公网 API，也不能为了 conformance 伪造为公开路由。

因此模块 health 使用 `module_manifest` 检查：解析 Manifest，确认 `process` + loopback、canonical
Gateway base、health service，并拒绝任何 GET/HEAD Gateway route 覆盖私有 probe。模块运行状态由
登录后的 `/api/platform/modules` catalog 呈现。线上业务错误体可以不同，配置中的适配器负责
归一化；安全语义不能由适配器放宽。

契约类别：

- `health`：Core 提供公开、不可缓存的存活/就绪探针；private module 声明仅供 supervisor 使用且不被
  Gateway route 覆盖的 loopback probe，并由受保护 catalog 汇总状态。
- `errors`：错误必须含稳定机器码和面向人的消息，5xx 不得泄露内部细节。
- `session`：会话 Cookie 至少使用 `HttpOnly` 与 `SameSite=Strict`，HTTPS 部署使用 `Secure`。
- `csrf`：Cookie 会话的状态变更请求必须验证会话绑定令牌；纯 Bearer API 不适用。
- `headers`：浏览器可访问响应至少包含 MIME、防嵌套、来源和引用策略。
- `budgets`：请求体大小和接收时间必须有界；超限应得到确定的 4xx。
- `logging`：认证头、Cookie、CSRF、密码和令牌不得进入访问日志或公开错误。

规范正文见 [`http-v1.json`](http-v1.json)，报告格式见
[`conformance-report.schema.json`](conformance-report.schema.json)。任何暂时不满足的条目必须引用
带所有者、风险和复审日期的 ADR；不能用项目配置静默关闭检查。

运行：

```bash
npm run conformance:inventory
UNION_BASE_URL=http://127.0.0.1:8080 npm run conformance:live
```

`inventory` 验证源码、Manifest、中央认证和私有 health/catalog 证据并为六个单元生成同格式报告；
`live` 只额外经 Union 唯一入口执行 Core 的只读黑盒请求，不直连或推测 worker 端口。设置
`SARMG_CONFORMANCE_STRICT=1` 后，缺少 `UNION_BASE_URL` 也会使 live 检查失败。

Dufs 与 Photo Backup 的目标共同传输语义草案另见
[`blob-transfer-v1.md`](blob-transfer-v1.md) 和机器可读的
[`blob-transfer-v1.json`](blob-transfer-v1.json)。该草案建议共享状态、错误、完整性、恢复与
Range 行为，不共享文件系统、照片资产或 SQL 实现；目前的检查只验证草案输入与差距声明，
不构成运行时合规认证。
