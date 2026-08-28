# Union 发行体系：需求、边界与完成定义

本文是 Union 模块化工作的规范入口。架构目标和已经通过的验收证据是两件事：`MUST` 描述发行
要求；[实施状态](IMPLEMENTATION-STATUS.md) 只在存在源码、测试或制品证据时标记已完成。

## 1. 产品与术语

Union 是唯一对外产品、版本和 GitHub Release。Sunshine、主机监控、Sentinel Monitor、
Photo Backup、Dufs 是五个可选模块，不拥有独立产品版本或独立 Release。

- **编译期模块**：清单在编译前固定模块集合；改变集合必须重建 Union。
- **私有 worker**：模块在独立进程中运行，以取得崩溃、权限和资源隔离；这不是支持用户绕过
  Union 直接部署 worker 的承诺。
- **薄共享上游**：只共享稳定契约、生成制品、合规测试和无业务语义的平台能力。
- **唯一入口**：公开 TLS 终止、Web/API 路由和控制面认证由 Union 承担；模块领域 token/ACL
  仍在模块中校验，尤其是 Agent、Photo 设备和 Dufs 文件权限。

## 2. 必须满足的需求

### 2.1 构建与发行

1. 一个声明式 profile 固定 Union 和所有选中模块的完整 Git commit；platform/upstream 等传递
   输入必须由这些源码仓库的 lockfile、vendored 契约及其校验和固定，不能依赖浮动分支。
2. 构建器把选中 `module-*` feature 编译进 Union，并分别编译对应 worker/前端；禁止动态
   `.so`/`.dll`、运行时下载、目录扫描和浮动 branch/tag。
3. 输出只有一个 Union 发行目录、版本、manifest 和递归校验和；worker 只作为该发行内部文件。
4. 模块仓库保留源码与模块级 CI，但第一方 package 不发布 crate，不存在独立 Release workflow，
   CI 也不上传可安装程序制品；客户端如需正式分发，只能作为同一 Union Release 的资产。
5. Android/iOS 客户端和远端 Agent 可以物理独立安装，但其兼容范围和版本属于同一 Union Release。
6. 本地与 GitHub Actions 必须调用同一 `union-builder` CLI；YAML 只负责工具链、缓存、制品传递
   和创建 Release。
7. 构建器必须拒绝带凭据 Git URL、不完整 revision、重复端口/路由、非 loopback worker bind、
   路径逃逸、symlink 逃逸和已存在输出目录。

### 2.2 运行时与网络

1. Union 是管理 UI、浏览器 API、移动 API 和设备接入的唯一公共 HTTP(S) 入口。
2. worker 固定监听 loopback/private endpoint；管理员不能输入任意 upstream URL 或覆盖模块端口。
3. 编译期静态路由必须与选中 feature 一致；未选模块不出现在 catalog、路由、supervisor 或制品。
4. Union 为每次 worker 启动生成 256-bit 内部 token、固定 audience、协议版本和期望 public prefix；
   readiness 必须回显并验证这些值，兼容失败时不开放路由。
5. 网关不得把 Union Cookie、内部身份头、hop-by-hop 头或客户端伪造的 forwarded 头透传给 worker。
   Union 管理路径先执行会话与 CSRF；领域路径继续执行模块自身认证。
6. supervisor 负责启动、健康、PID、崩溃退避、日志和优雅 `SIGTERM`，超时后才强制退出。
7. 代理必须保持流式上传/下载、HEAD/Range、SSE 和媒体路径语义，不能整包缓冲大文件。

### 2.3 TLS 与服务器明文

1. 外部流量必须使用 TLS；私有 loopback 链路不构成另一个公开服务。
2. Photo/Dufs 提交到服务器的内容必须保持客户端资源的原始明文字节；Photo 正式编码为
   `plain-v1`，禁止恢复客户端端到端加密设计。
3. 内容摘要用于完整性、ETag 或去重，不得描述成加密。
4. 运维可使用透明卷/磁盘加密和受控备份，但不能改变应用可直接读取/恢复原始文件的语义。

### 2.4 数据所有权

1. Union core 保留自己的控制面 SQLite；Sunshine、主机监控可共用 PostgreSQL 运维集群，但
   必须分别拥有 `sunshine`、`host_monitoring` schema/role/migration；Sentinel、Photo 使用各自
   专用 PostgreSQL database/role/migration。所有者都须定义备份和删除策略。
2. 禁止跨 schema/database 外键、写入、运行时 join、共享 migration 和共享业务 repository。
3. Sunshine、主机从旧 Union SQLite 域表导入各自 PostgreSQL 所有权边界后才能切换；importer
   必须提供校验、拒绝不一致和回滚证据，禁止新旧双写。旧域表仅作为只读迁移/回滚来源，验收
   完成后才能删除；正常服务请求路径不得再读写这些旧域表，只有显式迁移、回滚或备份校验工具
   可以只读访问；Union core 的控制面 SQLite 表继续保留。
4. Photo 的 PostgreSQL 只保存元数据/事务；原始媒体保存在受控文件或对象目录。
5. Dufs 保留 SQLite + rooted filesystem。本项目没有多节点 fencing/分区语义前，不得为形式统一
   改为 PostgreSQL。
6. Photo 移动端和 Union Agent 的离线数据库留在设备本地，不能直接连接服务器 PostgreSQL。

### 2.5 质量、维护与供应链

1. production-ready 推广前，官方 `minimal`（仅 Union core）、`storage`（Photo+Dufs）、
   `monitoring`（Sentinel+Host）、`full`（五模块）profile 必须执行格式、静态检查、单元测试、
   契约测试、migration、网关黑盒、安装/升级/回滚和制品校验；构建里程碑 Release 只适用第 5 节
   第一层门禁。
2. 自定义组合至少通过清单静态验证和所有选中模块的测试；不承诺 32 种组合均有安装级支持。
3. Release 必须能回答源码 revision、模块列表、worker 路径、公开路由、数据所有者和回滚方式。
4. 生产秘密不得进入 profile、Release、日志、数据库 URL 示例或前端产物。
5. 共享实现须满足“至少两个消费者、两个正式 Release、无产品特例”的抽取门槛；否则使用
   versioned contract + adapter，避免把业务耦合进 upstream/platform。

## 3. 非目标

- 不做运行时插件商店、第三方 ABI、远程下载或模块热插拔。
- 不把五个模块静态链接进 Union 单进程；编译期选择不等于运行时同进程。
- 不为了技术栈一致迁移 Dufs Hyper 文件状态机，也不强制所有数据进入 PostgreSQL。
- 不共享 Union `AppState`、用户/session 表、业务 DTO、跨模块事务或通用 Storage trait。
- 不把 Dufs 路径/目录产品等同于 Photo 资产/相册产品。
- 不承诺 worker 端口、内部 token 或 migration CLI 是面向最终用户的稳定公共 API。
- 不允许模块保留公网管理端口、独立登录页或独立发布作为长期兼容模式。
- 不承诺从任意历史版本直接升级；每个 Release 声明受支持的起点和回滚点。

## 4. 操作边界

- Union：唯一公网 TLS、控制面认证、静态路由、catalog、supervisor、安装/升级编排。
- platform：模块 manifest、网关身份/协议、PostgreSQL 连接/migration 薄能力；不得包含业务 SQL。
- upstream：设计/HTTP/blob 契约与合规；不得依赖某个业务 framework 或数据库。
- worker：领域认证、业务规则、schema/migration、文件提交和恢复。
- union-builder：确定性构建与组装；不得生成生产秘密或替运维选择数据策略。
- 运维：PostgreSQL/文件系统备份、TLS 证书、服务账号、资源/网络限制和灾难恢复。

## 5. 迁移与发布门禁

本项目区分两个层级：

- **构建里程碑 GitHub Release**：固定源码和模块图，完成供应链、制品拓扑与校验和门禁后可以
  发布，用于冻结架构与构建证据；必须明确标注“不具备 production-ready 资格”。
- **production-ready 推广/部署**：除上述门禁外，还必须通过真实数据预检、私有启动、功能联调、
  安装升级以及服务与数据回滚。未通过时不得批准生产切流、部署或使用 production-ready 标签。

Union `v0.4.0` 属于前者：它是正式、非 prerelease 的架构/构建里程碑 GitHub Release，但不是
production-ready 发布。第 6 节的“模块化迁移完成”仍以第二层全部通过为准。

| 阶段 | 必须证据 | 失败行为 |
|---|---|---|
| 源码固定 | profile 中全部为完整 commit，工作树/输入可追溯 | 拒绝构建 |
| 模块构建 | 仅选中 feature、worker、前端进入 release manifest | 拒绝组装 |
| 数据预检 | migration/import/计数/摘要/引用校验与备份成立 | 不切流量 |
| 私有启动 | loopback、gateway identity、live/ready、无公网监听 | 不开放网关路由 |
| 功能联调 | 管理 auth/CSRF、领域认证、上传、Range、SSE/媒体按 profile 通过 | 不批准生产部署/production-ready |
| 安装升级 | 干净安装和支持起点升级均可完成 | 不批准生产部署/production-ready |
| 回滚 | 二进制、配置和数据回滚演练有可审计证据 | 不批准生产部署/production-ready |
| 供应链 | manifest、SHA-256、Release 附件与 revision 一致 | 拒绝 GitHub Release |

## 6. “模块化迁移完成”的定义

只有以下条件全部满足，才可使用“完成”而不是“源码已实现”：

1. 五模块均由 profile 选择，未选模块不进入 catalog、路由、worker、前端或发行目录；
2. 五模块均运行在独立私有进程，直接 worker 端口不是受支持产品入口；
3. Sunshine/主机的正常服务运行时不再读写 Union SQLite 中的旧域表；旧域表只读保留到切换/回滚
   验收完成，且只允许显式迁移、回滚或备份校验工具访问，之后才可删除；Union core 继续只拥有
   并使用自己的控制面 SQLite 表；
4. 所有模块 package 不可独立发布，仓库无独立 Release workflow；
5. `full` 固定 revision 制品通过真实 PostgreSQL、文件系统、网关、媒体/移动接口、安装、升级
   和回滚门禁；
6. 四个官方 profile 的 manifest 与校验和已保存，单一 Union Release 可复现；
7. 文档状态与实际证据一致，所有待办仍明确列出。
