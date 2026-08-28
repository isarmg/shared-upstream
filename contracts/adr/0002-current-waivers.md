# ADR 0002：HTTP v1 当前豁免

- 状态：接受，有期限
- 日期：2026-08-27
- 更新：2026-08-28（运行时插件/中央入口基线）
- 所有者：各项目维护者
- 复审日期：2026-11-27

当前豁免如下：

- `host-monitoring / errors.machine_readable`：Host worker 的错误体目前只有 `message`，尚无稳定机器码。
  风险中；补齐与其他四模块一致的 `code` 后关闭。
- `dufs / health.liveness`、`dufs / health.readiness`：Dufs 的 Manifest 正确声明了 supervisor 私有
  探针，但其文件服务 `/{*path}` GET/HEAD Gateway 路由也覆盖 `__dufs__/health` 与
  `__dufs__/ready`。这些路径仍受 Union 会话/RBAC 保护，不是独立公网端口，但尚未达到“只允许
  supervisor 访问”的目标。风险中；Core Gateway 增加 health-path deny 或 Dufs 拆分不重叠路由后
  关闭，不能通过把探针登记为公网 conformance URL 来掩盖。

豁免不是永久兼容承诺。到期前维护者必须修复、缩小风险或用新的 ADR 明确续期依据。

Photo、Sentinel 与 Dufs 的旧本地 Cookie/CSRF 豁免已随中央认证迁移关闭：它们不再签发管理会话，
管理路由统一由 Union Core 的 Cookie、CSRF、RBAC 与规范 Principal 保护。旧 Dufs/Photo 错误体、
模块本地浏览器安全头和 Sentinel 请求预算豁免也已关闭：稳定错误码已落地，且唯一公网入口的安全
头与绝对请求体预算由 Core 覆盖所有 Gateway 响应/请求。设备、Agent 和短时媒体 capability 路由
不使用浏览器会话，按各自 Manifest 的精确 `module` auth 清单验证。
