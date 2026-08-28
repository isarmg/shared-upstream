# Shared contracts

本目录定义 Union 及模块共同遵守的、与 Rust Web 框架无关的 HTTP 行为。当前 inventory 登记
Union、Dufs、Photo、Sentinel 四个消费者；三个模块的 live 检查都只接受同一个
`UNION_BASE_URL`，并通过 `/modules/...` 固定前缀访问，不再支持直接检查 worker 端口。
Sunshine 与主机监控的公开兼容路径属于 Union console/Agent API，由 Union 的网关与 profile
测试覆盖，不被登记成两个可独立访问的 Web 服务。线上的错误体可以不同，
`conformance/projects.json` 中的适配器负责归一化；安全语义不能由适配器放宽。

契约类别：

- `health`：公开、快速的存活探针，以及真正检查依赖的就绪探针；响应不得缓存。
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

`inventory` 验证源码证据并为所有项目生成同格式报告；`live` 还会经 Union 唯一入口执行只读
黑盒请求。设置 `SARMG_CONFORMANCE_STRICT=1` 后，缺少 `UNION_BASE_URL` 也会使 live 检查失败。

Dufs 与 Photo Backup 的目标共同传输语义草案另见
[`blob-transfer-v1.md`](blob-transfer-v1.md) 和机器可读的
[`blob-transfer-v1.json`](blob-transfer-v1.json)。该草案建议共享状态、错误、完整性、恢复与
Range 行为，不共享文件系统、照片资产或 SQL 实现；目前的检查只验证草案输入与差距声明，
不构成运行时合规认证。
