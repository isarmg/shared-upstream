# Changelog

本项目遵循语义版本。设计制品和 HTTP 契约分别在 manifest/report 中声明自己的契约版本。

## Unreleased

- 将产品边界收口为单一 Union 产品/Release、编译期模块选择和五个运行时私有 worker；补充
  `union-builder` CLI、静态网关、supervisor、四个官方 profile 与最终验收边界。
- 对齐 Builder 实际 profile：`minimal` 仅 Union core，`storage` 为 Photo+Dufs，`monitoring`
  为 Sentinel+Host，`full` 为全部五模块。
- 建立独立 `platform` 模块 manifest、`gateway-v1` 身份契约和 PostgreSQL 薄支持层；明确 Union
  core 保留控制面 SQLite，`sunshine`/`host_monitoring` 独立 PostgreSQL schema/role，Sentinel/
  Photo 使用专用 PostgreSQL，Dufs 保留 SQLite。
- 新增版本化且显式标记为 `draft` 的 `org.sarmg.blob-transfer@1.0.0`、Dufs/Photo 建议映射、
  已知差距、vendored 同步和输入检查；定义目标状态/错误/Range 语义，但不声称 adapter 已实现
  八项 `must`，也不合并业务实现。
- 明确所有外部传输必须经 TLS，Photo/Dufs 服务器端保存原始明文字节；摘要不构成加密。
- 更新需求、非目标、维护性、迁移门禁和 completion matrix；区分“构建里程碑正式 Release”与
  “production-ready 推广”，明确生产服务、业务数据升级和数据回滚尚待验收。
- 冻结 Builder `1a59bcf...` 主 CI 与四个官方 profile 的成功 run、artifact ID、内层 tar
  SHA-256、递归校验文件数、内容寻址 Release ID 和正负模块拓扑。
- 记录 minimal→full→minimal 的临时不可变文件槽位演练；明确它验证 Builder 安装/回滚指针
  语义，不代表 PostgreSQL/业务数据迁移、服务切换或生产故障恢复已经完成。
- 发布并复验 `union-builder v1.0.0` 的 Linux/macOS/Windows CLI 与 `SHA256SUMS`；正式发布单一
  `Union v0.4.0` full Linux 发行包，确认没有模块独立资产。
- 移除 Photo 模块 CI 的 APK/iOS `upload-artifact`，保留编译测试但不从模块仓库交付可安装程序；
  正式客户端资产只能归属同一 Union Release。
- 从正式 Release 重新下载 Union 包，验证外层/递归校验和、五个完整源码 revision、32 个文件、
  六个可执行文件 mode、候选与正式目录一致，以及 minimal→正式 full→rollback 文件槽位语义。

## 0.1.0 - 2026-08-27

- 建立四项目迁移前/后的可执行基线和维护治理。
- 发布首版命名空间设计令牌、scoped CSS、生成 manifest、校验和及视觉基线。
- 将 Union、Photo Backup、Dufs 和 Sentinel 接入与其需求匹配的共享制品。
- 发布框架无关 HTTP v1 契约、黑盒/源码合规运行器和有期限 ADR 豁免。
