# ADR 0001：允许有限的历史 Wire Adapter

- 状态：接受
- 日期：2026-08-27
- 所有者：Shared Upstream Maintainers
- 复审日期：2026-11-27

四个服务已有三种成熟错误格式和不同健康 URL。阶段 2 统一的是语义、报告与安全下限，而不是
强制同步破坏客户端。合规工具只允许 `flat-code-message`、`nested-error` 和
`rfc9457-problem` 三类错误适配器，以及配置中明确列出的健康路径。

适配器不得把缺少稳定错误码、CSRF 或安全头转换为“通过”；这类差异必须单独豁免。新增服务默认
使用扁平 `{code,message}` 或 RFC 9457，不再增加第四种格式。
