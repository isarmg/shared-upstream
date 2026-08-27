# Union 发行体系：需求与边界

本文是 2026-08-27 起的产品与架构边界。它优先于各仓库仍在迁移中的旧部署说明。

## 1. 产品定义

Union 是唯一对外产品和发行单元。Sunshine、主机监控、Sentinel Monitor、Photo Backup 与
Dufs 是 Union 的可选能力模块，不再拥有独立产品定位、独立版本承诺或独立 GitHub Release。

“编译期模块”表示构建清单在编译前确定完整模块集合；构建结束后，不能通过复制二进制、
修改环境变量或扫描目录增加模块。修改模块集合必须重新生成一个 Union 发行版。

“运行时独立”表示每个模块工作进程拥有独立地址空间、服务账号/权限、资源限制、健康状态和
故障边界。它不表示模块可以直接暴露到公网，也不表示模块可以绕过 Union 独立部署。

## 2. 必须实现的需求

### 2.1 构建与发行

1. 一个声明式清单固定 Union 和所有模块的完整 Git commit ID。
2. 清单选择模块后，构建器把相应 `module-*` feature 编译进 Union 控制面，并分别编译所选
   worker；不使用 Rust `.so`/`.dll` 动态插件。
3. 输出只能有一个 Union 发行目录、一个版本、一个 manifest 和一份校验和。
4. 模块仓库保留源码和模块级 CI，但不得发布独立可执行程序、容器、crate 或 Release。
5. Union Release 可携带 Android/iOS 客户端和远端 Agent；它们物理上必须单独安装，但版本和
   兼容范围属于同一个 Union Release，不得形成另一套发布周期。
6. 本地和 GitHub Actions 必须调用同一个命令行工具，Actions YAML 不再复制构建业务逻辑。

### 2.2 运行时与网络

1. Union 网关是管理 UI、浏览器 API 和移动端 API 的唯一公共 HTTP(S) 入口。
2. 模块 HTTP worker 默认只监听 loopback；需要 Unix socket 的模块可在契约升级后增加，不能
   退回 `0.0.0.0` 默认值。
3. Union 必须使用静态路由表代理到已编译模块；管理员不能录入任意 upstream URL。
4. 外部流量必须使用 TLS。Photo Backup 的照片/视频仅要求传输中加密，服务器保存内容必须是
   可直接读取的原始明文；不得恢复客户端端到端加密设计。
5. Union 负责外部身份与授权。模块间身份使用短时、带 audience 的内部凭据，禁止转发 Union
   Cookie、共享 Cookie 密钥或信任任意本机请求。
6. 模块启动、退出、崩溃退避、健康、日志和升级由 Union 的 supervisor/服务管理配置统一控制。

### 2.3 数据与存储

1. PostgreSQL 可以统一为一个运维集群，但不能统一为一个业务 schema 或一套业务表。
2. 每个模块拥有自己的 schema、role、migration、备份一致性说明和数据删除策略；禁止跨模块
   外键、跨模块写入和运行时跨 schema 查询。
3. Sunshine 与主机监控必须先从 Union SQLite 迁入各自 PostgreSQL schema，才能拆成独立进程。
4. Sentinel 与 Photo Backup 保留独立 schema；Photo Backup 的对象内容仍位于受控文件/对象
   存储，PostgreSQL 只保存元数据和事务状态。
5. Dufs 的 SQLite 与共享根、inode 身份、上传恢复和文件提交处于同一故障域，当前继续保留。
   除非完成多节点 fencing 和分区语义设计，否则不得为了“统一数据库”改用 PostgreSQL。
6. Photo 移动端和 Union Agent 的离线队列继续使用设备本地数据库，不连接服务器 PostgreSQL。

### 2.4 质量与安全

1. 每个受支持的发行 profile 都必须执行格式、静态检查、单元测试、模块契约测试、网关黑盒
   测试、migration 测试、安装/回滚测试和生成制品校验。
2. 不承诺测试五模块的全部 32 种组合。官方支持 `minimal`、`storage`、`monitoring`、`full`
   四个 profile；自定义组合至少运行清单静态验证和所有被选模块的测试。
3. 构建器拒绝 branch、浮动 tag、带凭据 Git URL、非 loopback worker 地址、重复端口/路由和
   已存在的输出目录。
4. 生产秘密不进入构建清单、Release、日志、数据库 URL 示例或前端制品。
5. 每个发行版必须能回答：用了哪些源码 revision、编译了哪些模块、每个 worker 安装到哪里、
   数据属于谁、公开入口是什么、如何回滚。

## 3. 明确不做的事情

- 不做运行时模块商店、目录扫描、远程下载插件或第三方 ABI。
- 不把所有模块静态链接到同一进程；这会失去故障、权限和资源隔离。
- 不为“技术栈统一”重写 Dufs 的 Hyper 文件状态机，也不强制所有数据库使用 PostgreSQL。
- 不把 Union `AppState`、用户表、session 表或业务 DTO 上移到共享上游。
- 不把 Dufs 的任意文件浏览等同于 Photo Backup 的照片资产库。
- 不允许模块保留绕过 Union 的公共管理端口或独立登录入口作为长期兼容模式。
- 不承诺任意历史模块组合的无限兼容；发行清单和 Union 版本共同定义兼容范围。

## 4. 迁移完成定义

只有同时满足以下条件，才可以宣称“模块化迁移完成”：

1. 五个模块都由构建清单选择，未选模块不出现在 Union catalog、路由、worker 或发行目录。
2. 五个模块运行在独立进程，直接访问 worker 端口不能形成受支持的产品入口。
3. Sunshine/主机不再读写 Union core 的 SQLite 表，Union core 不再导入其业务 DTO。
4. 所有模块仓库不存在独立发布 workflow，Cargo package 标记为不可发布。
5. `full` 发行 profile 通过真实 PostgreSQL、文件系统、网关、移动端构建和回滚验证。
6. 文档没有把迁移目标写成已完成事实；实现状态表中的每项都有测试或制品证据。

