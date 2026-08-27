# Changelog

本项目遵循语义版本。设计制品和 HTTP 契约分别在 manifest/report 中声明自己的契约版本。

## Unreleased

- 建立独立 `platform` 模块契约、编译期 Axum 组装和 PostgreSQL 薄支持层。
- Photo Backup 与 Sentinel 共同使用 PostgreSQL 启动/readiness 支持；Photo Backup 新增数据库与
  本地存储真实 readiness，移除对应临时豁免。

## 0.1.0 - 2026-08-27

- 建立四项目迁移前/后的可执行基线和维护治理。
- 发布首版命名空间设计令牌、scoped CSS、生成 manifest、校验和及视觉基线。
- 将 Union、Photo Backup、Dufs 和 Sentinel 接入与其需求匹配的共享制品。
- 发布框架无关 HTTP v1 契约、黑盒/源码合规运行器和有期限 ADR 豁免。
