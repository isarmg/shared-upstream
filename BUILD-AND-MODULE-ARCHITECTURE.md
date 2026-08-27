# 编译期选择、运行时进程隔离的模块架构

## 1. 结论与可行性

总体方案可行，推荐实施，综合可行性 **8/10**、长期价值 **8/10**。最有价值的部分是统一
发行、确定攻击面、可复现组合和故障隔离；最昂贵的部分不是 Cargo feature，而是 Sunshine/
主机的数据拆分、统一身份、前端路由与组合测试。

“内核式”只借鉴 Kconfig 的编译前选择和确定制品，不借鉴内核的单地址空间：

```text
union-build.toml
      │ exact revisions + selected modules
      ▼
union-builder
      ├── cargo build Union --features module-a,module-b
      ├── cargo build module-a worker
      ├── cargo build module-b worker
      └── assemble one versioned Union release
                         │
                         ▼
                 Union public gateway
                    │ supervisor
             ┌──────┴────────┐
             ▼               ▼
       module-a loopback  module-b loopback
          process            process
```

编译期决定 catalog、网关路由、前端入口、supervisor 单元、数据库 migration 列表和发行文件；
运行时只允许启停已编译模块，不能增加模块。

## 2. 构建器边界

独立仓库 [`union-builder`](https://github.com/isarmg/union-builder) 是组合构建的唯一实现。
GitHub Actions 只安装固定工具链、调用 CLI、传递制品和创建 Release。

当前可执行基线是 `union-builder v0.2.0`：`check`、`plan`、`build` 三个命令和
`.github/workflows/build-union.yml` 共用同一实现。官方过渡清单
`profiles/full-transition.toml` 已固定 Union、Sentinel、Photo 与 Dufs 的完整 commit，并明确
把三个 worker 安装到 `libexec/union/modules/`。它不是最终 `full` profile，因为 Sunshine 与
主机监控仍在 Union 进程内。

构建器负责：

- TOML schema、模块 ID、路由、loopback 地址和端口冲突验证；
- 获取或检查完整 Git revision，不接受浮动 branch/tag；
- 生成精确 Cargo 命令，不执行清单提供的 shell；
- 组装 `bin/unionc`、`libexec/union/modules/*`、release manifest 与 SHA-256；
- 在输出已存在时失败，避免把两个发行图混在一起。

构建器不负责运行数据库 migration、生成生产秘密、安装 systemd、修改防火墙或替用户决定
数据目录。这些属于部署器和运维边界。

## 3. 维护性评估

### 收益

- 从六套 Release workflow 收敛到一个可本地测试的 CLI，构建逻辑不再被 YAML 锁住。
- 某发行版包含什么由 manifest 确定，事故复盘不再依赖运行时环境变量猜测。
- 模块崩溃、泄漏或高 CPU 不直接破坏 Union gateway；可配置独立权限和资源限制。
- 模块不再承担公网 TLS、统一登录、发布签名和安装器的重复维护。
- 未选择模块不贡献路由和 worker，攻击面与容量随 profile 明确变化。

### 成本

- supervisor、内部身份、代理流式 body、WebSocket/SSE、Range 和大文件上传都要有统一测试。
- 模块组合会指数增长；必须只承诺少量官方 profile，不能声称 32 种组合等价支持。
- 单一 Release 增加协调成本：模块修复不能随意发版，但可通过只重建受影响 profile 和快速
  Union patch release 缓解。
- 进程边界使 DTO、错误、超时、取消和追踪上下文必须显式版本化，早期代码量会上升。

综合看，五个模块已经足以让收益大于成本；若只有一两个模块，则不值得引入这套机制。

## 4. 必须按顺序迁移

### A. 组合构建层

建立 `union-builder`、固定 revision、单一目录输出和 Release。此阶段不能宣称 worker 已内部化。

### B. 现有独立服务内部化

Sentinel、Photo、Dufs 改为默认 loopback，Union 使用静态 gateway path，独立发布关闭。先保留
模块自己的认证作双重保护，内部身份稳定后再移除重复登录。

### C. Sunshine/主机数据拆分

完成 SQLite 导出、PostgreSQL schema migration、双读校验、停写切换、回滚演练。Union core
只能保存不透明模块状态，不能继续持有模块业务表。

### D. Sunshine/主机进程拆分

将模块 crate/前端入口移到自己的 worker package，加入内部身份与健康契约；删除 Union 内的
旧 Router、后台任务和 DTO。SQLite 独占锁存在期间禁止提前启动多个进程。

### E. 收口

删除运行时 URL 配置和独立登录入口，发布四个官方 profile，执行 full install/upgrade/rollback
门禁，才把旧架构文档归档。

## 5. 官方发行 profile

| Profile | 模块 | 主要用途 |
|---|---|---|
| `minimal` | 主机监控 | 基础设备与遥测 |
| `storage` | 主机监控、Dufs、Photo Backup | 文件与照片管理 |
| `monitoring` | 主机监控、Sunshine、Sentinel | 主机、串流与摄像头 |
| `full` | 全部五模块 | 完整自托管发行版 |

自定义 profile 是高级功能：构建器保证图有效，但维护者不承诺每种组合都有安装级测试。

## 6. 当前实现与剩余工作

| 能力 | 当前状态 | 完成门槛 |
|---|---|---|
| 精确 revision、清单校验、单一目录组装 | 已实现并发布 `union-builder v0.2.0` | 远程 full-transition 组装持续通过 |
| Sentinel/Photo/Dufs 编译期 catalog 选择 | Union `module-*` feature 已实现 | 前端入口、静态代理、supervisor 同样受 feature 控制 |
| Worker 私有监听 | Sentinel、Photo 强制回环；构建清单拒绝非回环 | Dufs 生产启动参数由 Union 生成且不可覆盖 |
| 取消模块独立发布 | 三个模块的独立发布 workflow 已移除 | 仓库保护规则阻止重新引入模块 Release |
| Sunshine/主机进程拆分 | 未开始，仍共享 Union SQLite/AppState | PostgreSQL 导入、回滚与双读校验完成后拆进程 |
| Union 唯一公共入口 | 目标已确定，当前仅健康探测和外部导航 | 静态网关、内部身份、流式/Range/升级测试通过 |
| 四个官方 profile | 尚未发布 | 安装、升级、回滚和真实依赖矩阵全部通过 |

因此当前可准确称为“组合构建与三 worker 内部化基线”，不能称为“五模块进程化完成”。
