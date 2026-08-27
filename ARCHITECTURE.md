# Sarmg 项目共享上游方案

> 2026-08-27 架构更新：Union 已确定为唯一发行单元，模块目标模型改为“编译期选择、运行时
> 独立进程、Union 唯一公网入口”。本文关于薄共享契约、数据库独立所有和不强制 Dufs 迁移
> Axum 的结论仍有效；旧的“模块独立发布”结论由
> [`REQUIREMENTS-AND-BOUNDARIES.md`](REQUIREMENTS-AND-BOUNDARIES.md) 取代。

> 2026-08-27 补充：本文定义的“薄共享上游”继续有效。基于 UnionC 提炼出的产品运行平台
> 作为独立层实现，见 [`../platform/README.md`](../platform/README.md)。平台通过模块契约组装产品，
> 不把业务 Router、业务数据库或统一 `AppState` 放入本共享上游。

## 1. 结论

`union-rust`、`dufs-ram`、`photo-backup`、`sentinel-monitor` 适合建立共享上游，
但最优方案不是统一全栈框架，也不是强制统一 Web 框架或数据库。推荐建设一个
**以稳定契约、生成制品和合规测试为核心的薄上游**：

1. 首先上游化已经在三个项目中重复出现的 Web 设计令牌、卡片和登录页模式。
2. 建立框架无关的 Rust Web 服务基线，并提供可选的 Axum 薄适配层。
3. 数据库保留“嵌入式 SQLite”和“服务型 PostgreSQL”两种配置档，不统一成单一产品。
4. 用黑盒合规测试统一认证、安全、健康检查和运维行为，而不是共享业务状态与业务表。
5. 只有至少两个项目连续多个版本保持相同的实现，才将该实现提升为公共 crate。

这一方案能解决当前已经发生的复制和漂移，同时避免公共层变成充满泛型、feature flag
和产品特例的“大一统框架”。

## 2. 当前项目边界

| 项目 | 前端 | HTTP 服务 | 数据库 | 不能被公共层接管的核心 |
|---|---|---|---|---|
| `union-rust` | React、TypeScript、Vite、React Query | Axum | SQLx SQLite | Agent 配对、遥测、Sunshine、SQLite 文件生命周期 |
| `dufs-ram` | 原生 HTML/CSS/ES Modules，资源嵌入二进制 | Hyper 自建路由 | rusqlite SQLite | rooted filesystem、路径协调、上传恢复、文件提交语义 |
| `photo-backup` | 内嵌管理页、Android Compose、iOS SwiftUI | Axum | SQLx PostgreSQL | 端到端加密、去重、分块上传、移动端状态机 |
| `sentinel-monitor` | 原生 JavaScript、Vite、HLS.js | Axum | SQLx PostgreSQL | MediaMTX、WHEP/HLS、ONVIF、录像、PTZ |

共同依赖 Rust、Tokio、Serde/JSON、HTTP API、认证和自托管部署，并不意味着它们拥有
相同的领域模型。公共层只应接管与产品领域无关、且已有重复证据的部分。

## 3. 设计原则

### 3.1 共享契约优先于共享实现

先统一错误格式、健康检查、安全行为和设计令牌；之后再观察实现是否真的相同。
共享实现一旦发布就是需要兼容和迁移的 API，不应把当前偶然相似的代码过早冻结。

### 3.2 使用“第三次复制即抽取”规则

Web 设计系统已经被 `union-rust`、`photo-backup` 管理页和 `dufs-ram` 登录页使用，
满足立即抽取条件。数据库 repository、`AppState` 和业务 Router 没有满足这一条件。

### 3.3 公共层必须允许产品表达不同

`sentinel-monitor` 的工业监控视觉、`photo-backup` 的移动端 Material/SwiftUI 体验，
都不应被统一皮肤覆盖。上游提供语义令牌和基础可访问性，产品保留布局和视觉主题。

### 3.4 不以迁移技术栈作为抽取前提

不要求 `dufs-ram` 先迁移 Axum，也不要求四个项目使用同一数据库。技术栈迁移必须先有
独立的产品或维护收益，共享上游只能作为附加收益。

## 4. 上游结构

当前仓库已作为 `/mnt/sarmg.org/upstream` 独立初始化。下图表达共享契约仓库的长期目录边界；
产品运行平台位于独立的 sibling `platform/` 仓库，不进入这里的 `rust/` 规划目录：

```text
/mnt/sarmg.org/
├── union-rust/
├── dufs-ram/
├── photo-backup/
├── sentinel-monitor/
└── upstream/                         # 独立版本和发布
    ├── ARCHITECTURE.md
    ├── design/
    │   ├── tokens/
    │   │   ├── tokens.json          # 设计令牌唯一事实源
    │   │   └── schema.json
    │   ├── web/
    │   │   ├── reset.css
    │   │   ├── tokens.css
    │   │   ├── content-card.css
    │   │   ├── login.css
    │   │   └── accessibility.css
    │   ├── examples/                # 无框架 HTML 固件
    │   ├── visual-tests/            # Playwright 截图与可访问性测试
    │   └── dist/                    # 带版本和校验和的发布制品
    ├── rust/
    │   ├── web-core/                # 尽量只依赖 http/tokio/serde
    │   ├── axum-adapter/            # 可选 Axum extractor/layer/response
    │   ├── postgres-support/        # 仅服务型 PostgreSQL 公共启动能力
    │   └── test-support/            # 黑盒服务和隔离数据库测试工具
    ├── contracts/
    │   ├── errors.md
    │   ├── health.md
    │   ├── authentication.md
    │   ├── database-profiles.md
    │   └── observability.md
    ├── conformance/
    │   ├── http-security/
    │   ├── health/
    │   └── backup-restore/
    └── templates/
        ├── ci/
        └── deployment/
```

初期不应一次创建全部 crate。目录表达最终边界，实际实现按后面的阶段逐步增加。

## 5. 第一优先级：Web 设计上游

### 5.1 唯一事实源

`tokens.json` 保存语义而不是产品名称，例如：

```json
{
  "color": {
    "background": "#f5f6f3",
    "surface": "#ffffff",
    "text": "#202a33",
    "muted": "#60707c",
    "primary": "#245b75",
    "danger": "#a73d46",
    "success": "#24745b",
    "warning": "#a66a17"
  },
  "radius": {
    "control": "14px",
    "card": "20px",
    "panel": "26px"
  }
}
```

生成的 CSS 不得在消费者中手工修改；消费者只通过覆盖 CSS 变量定制主题。

### 5.2 CSS 必须使用命名空间

当前多个项目都存在 `.app-shell`、`.nav-item`、`.login-card` 等通用类名，但含义不同。
公共制品应使用稳定前缀，例如：

```css
.sarmg-card {}
.sarmg-card__row {}
.sarmg-login {}
.sarmg-status-led {}
```

设计令牌使用 `--sarmg-*` 前缀。不得依赖全局 `.app-shell` 选择器才能取得主题值。

### 5.3 消费方式

- `union-rust`：直接导入版本化 CSS；React 组件继续保留在项目内。
- `dufs-ram`：更新脚本把固定版本的无框架 CSS 制品复制到 `assets/`，随后继续编译进二进制。
- `photo-backup`：把管理页内联 CSS 拆成独立、可嵌入的固定版本制品；业务 HTML/JS 留在项目内。
- `sentinel-monitor`：默认只采用 reset、焦点、强制颜色和 reduced-motion 基线；保留自己的主题。
- Android/iOS：初期不共享组件；确有品牌统一需求后，再从 `tokens.json` 生成 Kotlin/Swift 常量。

### 5.4 测试要求

公共设计制品至少覆盖：

- Chromium 与 Firefox。
- 320px、480px、760px、1080px 和桌面宽度。
- 浅色、深色、forced-colors、reduced-motion。
- 键盘焦点、错误状态、超长中英文、200% 缩放。
- React 页面和纯 HTML 页面各一个消费固件。

## 6. 第二优先级：Web 服务契约与安全基线

先以文档和黑盒合规测试统一以下行为：

### 6.1 错误响应

建议统一为：

```json
{
  "error": {
    "code": "validation_error",
    "message": "可向用户展示的信息",
    "request_id": "可选请求标识"
  }
}
```

数据库错误、路径、SQL、密钥和上游凭据不得出现在公共消息中。

### 6.2 健康检查

- `/health/live`：只表达进程事件循环可响应，不访问慢依赖。
- `/health/ready`：检查数据库和当前产品不可缺少的依赖。
- readiness 失败返回非 2xx，并提供机器可读的组件状态。
- 健康接口不得泄露连接字符串、文件路径或秘密值。

项目可在迁移期保留旧路径，但部署模板最终只使用统一路径。

### 6.3 认证与请求安全

公共契约要求：

- 浏览器会话使用 `HttpOnly`、`SameSite`，生产环境使用 `Secure`。
- Cookie 状态变更请求使用每会话随机 CSRF token，或经过审查的等价 Origin 防护。
- 密码哈希在有界阻塞池中执行，并限制全局与单来源并发。
- 登录失败不区分账号不存在和密码错误。
- 请求体、解析时间、总处理时间和并发均有显式预算。
- 安全响应头由最终提供 HTML/API 的组件负责，不能假定反向代理或应用会替对方设置。

认证业务模型不进入公共 crate：单管理员、多用户、设备 Token 和 RBAC 仍由产品实现。

### 6.4 可观察性与停机

- 每个请求有 request-id，日志字段名称保持一致。
- 密码、Token、Cookie、RTSP URL 和文件内容不得进入日志。
- 优雅停机必须区分可取消读取和不可取消的持久化提交。
- 后台任务必须被跟踪，停机时有明确的等待与强制终止阶段。

## 7. Axum 策略

`union-rust`、`photo-backup`、`sentinel-monitor` 可以在稳定契约后共享薄 Axum 适配层：

- 错误 envelope 与 `IntoResponse`。
- request-id、安全响应头和 tracing Layer。
- body limit、deadline 和 panic 隔离。
- 健康检查响应类型。
- 测试 Router 的辅助函数。

`axum-adapter` 不得包含数据库、用户模型、`AppState` 或产品 Router。

### 7.1 `dufs-ram` 不以 Axum 迁移为前提

`dufs-ram` 当前对 Hyper Body、流式上传、Range 下载、请求取消和自建路由阶段存在深层语义。
如果以后迁移，应采用以下顺序：

1. 先把领域逻辑与 `hyper::Request<Incoming>`、具体 Response Body 解耦。
2. 用现有测试固定 HEAD、Range、上传中断、CSRF、超时和停机行为。
3. 只替换路由、extractor 和 middleware，不重写文件系统与上传状态机。
4. 迁移完成并稳定若干版本后，再决定是否使用 `axum-adapter`。

不应为了让技术栈看起来一致而进行迁移。

## 8. 数据库策略

### 8.1 不统一为单一数据库

统一数据库产品不能统一业务 schema 或 repository，反而会破坏已有产品属性：

- `dufs-ram` 和 `union-rust` 的 SQLite 文件、锁、journal、完整性检查和本地恢复属于部署模型。
- `photo-backup` 使用 PostgreSQL 行级锁维护并发配额、去重和上传提交。
- `sentinel-monitor` 已是包含 MediaMTX 等外部服务的服务型部署，PostgreSQL 依赖合理。

也不应让任一项目同时支持 SQLite/PostgreSQL；这会使 migration、事务和测试矩阵翻倍。

### 8.2 Embedded SQLite profile

适用于 `dufs-ram`、`union-rust`，统一的是验收规范：

- 单进程/单写者边界。
- bundled SQLite 版本策略。
- journal mode、busy timeout、外键和 synchronous 策略。
- 数据库及 sidecar 文件权限与身份检查。
- schema 精确验证、integrity check 和 foreign key check。
- 备份 manifest、原子公开、恢复校验和回滚步骤。
- 事务内不得等待网络或执行无界文件 I/O。

由于一个项目使用 rusqlite、另一个使用 SQLx SQLite，初期只共享规范和合规测试。

### 8.3 Service PostgreSQL profile

适用于 `photo-backup`、`sentinel-monitor`：

- SQLx 连接池构造和连接超时。
- migration 执行、schema 版本和启动失败策略。
- readiness、事务错误分类和可重试条件。
- 最小权限账号与连接字符串秘密管理。
- 隔离测试数据库的创建和销毁。
- PostgreSQL 与对象/录像存储的一致备份边界。

在两个项目的策略一致并稳定后，可以抽取 `postgres-support`，但其中不得包含业务 SQL。

## 9. 发布与依赖管理

### 9.1 独立版本

共享上游应有自己的语义版本和 CHANGELOG，不与任何产品版本绑定。

- patch：不改变契约的修复。
- minor：向后兼容的新令牌、规则或中间件。
- major：类名、错误格式、配置或安全行为的破坏性调整。

安全修复可以要求消费者升级，但不能在消费者未验证时静默替换本地制品。

### 9.2 固定依赖

各项目使用明确版本、Git tag/commit 和制品校验和。发布构建不得依赖
`../upstream` 之类的本地路径。当前父目录可以用于联调，但正式构建必须能从独立 checkout 重现。

建议由自动化创建消费者升级 PR，每个项目运行自己的测试后再合并。

### 9.3 许可证

公共上游的第一方内容统一使用 SPDX 标识为 `Apache-2.0` 的 Apache License 2.0。
正式抽取前仍须核对每段代码来源；第三方内容必须保留原许可证，不能因进入公共制品而
被重许可。

## 10. 分阶段实施计划

### 阶段 0：记录基线（已完成，2026-08-27）

- 为四个项目记录当前版本、测试命令、浏览器支持和部署模型。
- 写明共享上游的所有权、评审人和发布权限。
- 不迁移数据库，不迁移 `dufs-ram` HTTP 框架。

完成条件：任何公共化改动前，都能独立验证四个项目当前行为。

交付证据：`baseline/projects.json`、`governance/MAINTAINERS.md` 和
`baseline/reports/pre-upstream-ready-2026-08-27.json`。迁移后的同口径报告为
`baseline/reports/post-upstream-phase-0-2-2026-08-27.json`。

### 阶段 1：抽取设计系统（已完成，2026-08-27）

- 从 `union-rust` 提炼语义令牌和六行卡片算法。
- 使用 `.sarmg-*` 和 `--sarmg-*` 命名空间重新发布，不直接复制旧通用类名。
- 先迁移 `union-rust`，再迁移 `photo-backup` 管理页，最后迁移 `dufs-ram` 登录页。
- `sentinel-monitor` 只接入基础可访问性制品。

完成条件：三个消费者不再保存可手工漂移的设计系统副本，视觉与可访问性测试通过。

交付证据：`design/`、`dist/design/` 与 `scripts/sync-consumers.mjs`。
`union-rust`、`photo-backup`、`dufs-ram` 使用带 manifest 的 vendored 制品，消费者的桥接样式
只保留产品特例；`sentinel-monitor` 只接入 scoped reset 与 accessibility。Playwright 基线覆盖
320/760/1280 像素、明暗主题、键盘焦点、减少动效和强制色模式。

### 阶段 2：建立服务合规测试（已完成，2026-08-27）

- 统一错误、健康检查、Cookie/CSRF、安全头、请求预算和日志脱敏契约。
- 测试以 HTTP 黑盒方式运行，暂不要求项目使用相同 crate。

完成条件：四个项目能生成同一格式的合规报告；任何例外都有项目 ADR 说明。

交付证据：`contracts/http-v1.json`、统一报告 schema、
`conformance/projects.json`、黑盒运行器和 `contracts/adr/`。库存报告固定提供
32 个检查槽位；运行中服务通过四个 `*_BASE_URL` 环境变量启用只读 HTTP 探针。当前不满足项
均引用带所有者、风险和复审日期的 ADR，不会被适配器伪装成通过。

### 阶段 3：PostgreSQL 薄支持层

- 只在 `photo-backup` 与 `sentinel-monitor` 中统一连接池、migration、readiness 和测试数据库工具。
- 连续至少两个发布周期验证没有产品特例侵入公共 API。

完成条件：公共层没有业务表名、业务 DTO 或业务错误码。

### 阶段 4：可选 Axum 适配层

- 从三个现有 Axum 项目中提炼已经一致的 middleware 和响应适配。
- `dufs-ram` 是否迁移 Axum 单独决策，不纳入阶段完成条件。

完成条件：删除公共层后，任何项目仍可用自己的薄适配器恢复同一契约，证明没有框架锁定。

### 阶段 5：审查新的 crate 候选

只有满足以下全部条件才抽取：

1. 至少两个生产消费者。
2. 已经存在实质相同代码，而不是预测未来可能相同。
3. 不包含产品领域模型。
4. 有独立单元测试和消费者契约测试。
5. 能给出兼容性、弃用和安全响应策略。

## 11. 明确不进入共享上游的内容

- 四个项目的业务 schema 和 migrations。
- 统一的 `AppState`、Repository 或业务 Router。
- Agent、文件系统、照片加密或视频媒体协议。
- 产品导航结构、产品文案和全部视觉皮肤。
- Android Compose、SwiftUI、React 之间的跨框架组件封装。
- 同时支持 SQLite/PostgreSQL 的通用 ORM 层。
- 仅包装数行第三方库调用、没有独立策略价值的 crate。

## 12. 维护制度

- 公共 API 必须有契约测试和升级说明。
- 上游变更先在一个参考消费者 canary，再逐个升级其他项目。
- 每个消费者保留覆盖变量、适配器和拒绝某一公共模块的逃生口。
- 每季度删除没有两个活跃消费者的公共模块，避免公共仓库成为代码仓库杂物间。
- 安全模块采用更严格评审；认证或加密变更不得与纯样式发布混在同一版本。
- 公共层不承诺同步发布四个产品，消费者应能长期固定在已验证版本。

## 13. 成功指标

方案是否成功，不以“公共仓库代码量”衡量，而以这些结果衡量：

- 相同设计修复不再需要手工复制到三个项目。
- 四个服务都能通过同一套 HTTP 安全和健康检查测试。
- `photo-backup` 与 `sentinel-monitor` 不再重复 PostgreSQL 启动和测试脚手架。
- 任一项目仍可独立构建、测试、发布和回滚。
- 公共层升级失败不会阻塞其他产品发布。
- 没有为了共享而牺牲 `dufs-ram` 的单文件部署、SQLite 本地一致性或
  `sentinel-monitor` 的专用监控体验。

## 14. 最终决策

采用以下组合方案：

```text
共享设计令牌和无框架 CSS                    立即实施
共享 HTTP/安全/健康检查契约与黑盒测试       第二阶段实施
共享 SQLx PostgreSQL 薄支持层               稳定后实施
共享 Axum 薄适配层                          有重复证据后实施
统一数据库                                  不实施
强制 dufs-ram 迁移 Axum                     不作为前提
统一业务框架、状态和领域模型                不实施
```

这是当前四个项目之间收益最高、迁移风险最低、长期维护边界最清晰的上游方案。
