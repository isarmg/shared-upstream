# HTTP contract v1

本目录定义四个服务共同遵守的、与 Rust Web 框架无关的 HTTP 行为。线上的 URL 和历史错误体
可以不同，`conformance/projects.json` 中的适配器负责归一化；安全语义不能由适配器放宽。

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

`inventory` 验证源码证据并为所有项目生成同格式报告；`live` 还会对已配置 base URL 的服务执行
只读黑盒请求。设置 `SARMG_CONFORMANCE_STRICT=1` 后，缺少 base URL 也会使 live 检查失败。
