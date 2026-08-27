# ADR 0002：阶段 2 当前豁免

- 状态：接受，有期限
- 日期：2026-08-27
- 所有者：各项目维护者
- 复审日期：2026-11-27

当前豁免如下：

- `dufs-ram / errors.machine_readable`：文件浏览器的 API 使用 RFC 9457，但未认证的页面请求会
  重定向到 HTML 登录页，现有只读通用探针不能稳定触发 Problem Details。风险低；项目自身测试
  已覆盖问题文档，复审时增加专用无副作用探针。
- `dufs-ram / headers.browser`：私有页面已有 MIME、frame、referrer、permissions 与 CSP，尚未
  显式下发 CORP。风险低；确认下载跨源兼容需求后补齐。
- `photo-backup / errors.machine_readable`：历史错误体只有 `error` 消息，没有稳定机器码。风险中；
  下一 API minor 版本增加 `code`。
- `photo-backup / session.cookie`：Cookie 已有 HttpOnly 与 SameSite=Strict，但服务端无法按 HTTPS
  部署配置增加 Secure。风险中；目前要求 TLS 终止代理重写 Cookie，后续改为应用显式配置。
- `photo-backup / session.csrf`：后台依赖 SameSite=Strict，尚无会话绑定 CSRF。风险中；在允许任何
  跨站或嵌入部署前必须修复。
- `photo-backup / headers.browser`：管理页仅有 CSP，尚未统一 MIME、frame、referrer 与 CORP 头。
  风险中；全局中间件落地后移除。
- `sentinel-monitor / session.csrf`：Cookie 写 API 尚无会话绑定 CSRF。风险中；同上。
- `sentinel-monitor / headers.browser`：静态页和 API 缺少统一安全头。风险中。
- `sentinel-monitor / budgets.request`：外部 HTTP 请求有超时，但入站 JSON 请求体没有显式全局字节
  上限。风险中；增加 Axum body limit 后移除。

豁免不是永久兼容承诺。到期前维护者必须修复、缩小风险或用新的 ADR 明确续期依据。
