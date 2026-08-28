# 构建与文件生命周期证据

**证据日期：2026-08-27。** 本文冻结 `union-builder` 四个官方 profile、Builder `v1.0.0`、
Union `v0.4.0` 和文件安装/回滚演练的最终证据。它明确区分 Actions artifact、正式 GitHub
Release 与生产运行验收，也不把文件槽位切换等同于 PostgreSQL 或业务数据迁移。

## 1. 固定输入

四次构建的 workflow head 均为 Builder commit
[`1a59bcf73fd743d5d2f319d11d788dbbf1768d2f`](https://github.com/isarmg/union-builder/commit/1a59bcf73fd743d5d2f319d11d788dbbf1768d2f)。
该 commit 的主分支 CI
[`33129349000`](https://github.com/isarmg/union-builder/actions/runs/33129349000) 已成功。

Profile 锁定的源码 revision 为：

| 所有者/模块 | Repository revision |
|---|---|
| Union core、Sunshine、主机监控 | `63af6330f3888c9418f61cd9e7265fc8b70db1bf` |
| Sentinel Monitor | `47dfa54ee2f441eb91918ca61d56e650c431ca66` |
| Photo Backup | `934708b57e00978a8ccaaae197005a8a9aca5e74` |
| Dufs | `af3b381fad4ee615c9604f2b119656f635e744ad` |

这些是完整 commit SHA，不是 branch、tag 或浮动版本。所有被选择的 worker 在制品中的 Unix mode
均为 `0755`。发行后的分支头可以继续接收契约生命周期与发布治理提交；上表有意冻结 `v0.4.0`
的历史构建输入，而不是声称它等于未来的 `main`。

## 2. 四个 profile 的 Actions 证据

下载每个 run 的 Actions artifact 后，对其中的 Union 内层 tar 计算 SHA-256；安全展开后再运行
同一 Builder 的 `verify`。`verify files` 是递归校验清单实际验证的文件数。

| Profile | Actions run | Artifact ID | 内层 tar SHA-256 | `verify files` | 内容 ID |
|---|---:|---:|---|---:|---|
| `minimal` | [`33129390195`](https://github.com/isarmg/union-builder/actions/runs/33129390195) | `9669694999` | `84c3dd894b4ae25b6992f03f2e76c72d83c02f44a04bc87932633868520ac904` | 7 | `unionc-0.4.0-7b89bc94176f9f290063457a12ef652d4978760f1bee8e0a6bce0664e7b69796` |
| `storage` | [`33129392286`](https://github.com/isarmg/union-builder/actions/runs/33129392286) | `9669766150` | `adadde40d0251351036a5b63e32a576ea972531ea0a3e7fb094a3fa5a133db87` | 11 | `unionc-0.4.0-e3dd069c560ca9f76bd2987e96c673686155affda4edf48f331b3184b8823ae2` |
| `monitoring` | [`33129391676`](https://github.com/isarmg/union-builder/actions/runs/33129391676) | `9669769151` | `02c2fb3ab6b273d1f8ea9b8e5c2904a31197dd65900d6512f21486b8897f959f` | 21 | `unionc-0.4.0-bf98f6e7615fda8be8a3580e8b3489ca44ff8c57b3f4679fb00148a96a13bbd5` |
| `full` | [`33129390090`](https://github.com/isarmg/union-builder/actions/runs/33129390090) | `9669863043` | `25a2726b43baa4adb36fade4c8ff6c636dc9df004efe9328d2dac9ad92760a3a` | 32 | `unionc-0.4.0-4acc14d10c5b075cd45317dcb586c90de45eefb16c98ff3c3d0bcb249639e5c0` |

Manifest 和发行目录给出的模块集合完全一致：

| Profile | 必须存在 | 必须不存在 |
|---|---|---|
| `minimal` | 无可选模块 | Sunshine、Host、Sentinel、Photo、Dufs |
| `storage` | Photo、Dufs | Sunshine、Host、Sentinel |
| `monitoring` | Sentinel、Host | Sunshine、Photo、Dufs |
| `full` | Sunshine、Host、Sentinel、Photo、Dufs | 无 |

因此这四个 run 已证明：固定 revision 可由干净 Actions job 构建；profile 的正、负拓扑与 manifest
一致；被选 worker、前端和校验清单被组装为一个 Union 目录。但这还没有证明 worker 在生产环境
真正启动，也没有证明静态路由的所有协议行为。

Actions artifact 有保留期，Artifact ID 和 run 页面可能不永久提供下载；上表的完整输入 SHA、
内层 tar SHA、递归校验结果和内容寻址 ID 是保留在版本库中的审计锚点。正式长期资产及外层
校验和记录在第 4 节。

## 3. 本地不可变槽位演练

使用正式 Builder `v1.0.0` Linux CLI，对已通过 `verify` 的 `minimal` Actions 目录和正式 Union
`v0.4.0` full 目录，在临时安装根执行了以下文件生命周期：

1. 安装 `minimal`：`current` 指向内容 ID `unionc-0.4.0-7b89bc...`，`previous` 不存在；
2. 安装正式 `full`：`current` 指向 `unionc-0.4.0-a494f2...`，`previous` 指向 minimal；
3. 执行 rollback：`current` 重新指向 minimal，`previous` 指向正式 full；
4. 回滚后分别对两个不可变 `releases/<release-id>` 槽位再次执行 `verify`，均通过。

这验证了 Builder 的“先完整校验、不可变 slot、原子 `current`/`previous` 指针切换、离线回滚”
文件语义。演练使用临时目录，没有修改生产 `/opt`、systemd、数据库、媒体目录或用户数据。

尤其要注意，它**没有**验证：

- Sunshine/Host 从 SQLite 到 PostgreSQL 的导入、停写、切换和数据回滚；
- Photo/Sentinel 的真实 PostgreSQL、Dufs 的真实 SQLite/rooted filesystem 或备份恢复；
- Union 网关下的 strict HTTP conformance、公开 TLS、认证/CSRF、上传、Range、SSE、WHEP/HLS；
- 磁盘满、响应丢失、进程崩溃、慢客户端、重复提交或内容损坏等故障注入。

这些仍是 production-ready 部署验收项，不能由文件槽位测试代替。

## 4. 正式 Release 证据

### Builder v1.0.0

注释标签 `v1.0.0` 精确指向 `1a59bcf73fd743d5d2f319d11d788dbbf1768d2f`。发布工作流
[`33130162873`](https://github.com/isarmg/union-builder/actions/runs/33130162873) 的标签门禁、CI、三平台
构建、full 组合验证和 publish 共 7 个 job 全部成功；正式
[Release](https://github.com/isarmg/union-builder/releases/tag/v1.0.0) ID 为 `378201602`。

| 资产 | Asset ID | SHA-256 | 大小 |
|---|---:|---|---:|
| `union-builder-linux-x86_64` | `533060795` | `98f90c7f2f080877503796904583647ddb399152a7edf3aca5a2ef7dedb5280a` | 1,594,072 |
| `union-builder-macos-aarch64` | `533060794` | `f9b451c75d391252f5e0d9f5a795de7b916acbcd921387dab02ab7b45ee527a7` | 1,271,760 |
| `union-builder-windows-x86_64.exe` | `533060792` | `276bd31dbef2eca31bb12cb85b74c42849b4f4198ca85b3c88fa3f10101430e0` | 1,519,616 |
| `SHA256SUMS` | `533060798` | `7330fa1aa5149ef34a08626acc334e74c092c5e4b079106d38a0c377a8dd3f0b` | 286 |

从 Release 重新下载后的资产集合与上表完全相等，`sha256sum --check` 三项通过；文件 magic 分别
为 ELF、Mach-O 和 PE，Linux CLI 报告 `union-builder 1.0.0`。Release 不包含 full 验证 artifact，
因此 Builder Release 只发布构建工具。

### Union v0.4.0

正式标签精确指向 `63af6330f3888c9418f61cd9e7265fc8b70db1bf`。非发布候选工作流
[`33130431299`](https://github.com/isarmg/union-rust/actions/runs/33130431299) 先通过；正式工作流
[`33131309723`](https://github.com/isarmg/union-rust/actions/runs/33131309723) 的标签门禁、13 项仓库 CI、
Builder full 组装和 publish 共 16 个 job 全部成功。正式
[Release](https://github.com/isarmg/union-rust/releases/tag/v0.4.0) ID 为 `378208562`，且资产集合严格
只有两项：

| 资产 | Asset ID | SHA-256 | 大小 |
|---|---:|---|---:|
| `union-0.4.0-full-linux-x86_64.tar.gz` | `533084643` | `45f135f55f6a2366f3ae659d819ec43cb97858a04044084715c0029ea44340ad` | 25,307,559 |
| `SHA256SUMS` | `533084642` | `c8fccebdde51100b1e8402d6c91fe7b8de12902d65d2e79b007e409c57941962` | 103 |

从 Release 重新下载后，外层 `SHA256SUMS` 通过；tar 路径白名单和普通文件/目录类型检查通过；
安全解包后，正式 Builder 验证 32 个清单文件，内容 ID 为
`unionc-0.4.0-a494f2eb429dedba53812952b815676a1ed6d880823050f654a24288e948a978`。
`bin/unionc` 和五个 worker 均为 `0755`，manifest 的 distribution revision 与五模块 revision
逐项匹配第 1 节。正式目录与候选工作流下载目录逐文件相同。

四个 profile Actions artifact 仍不是四个对外产品。Dufs 的旧历史 Release 也不是当前交付入口；
现行 Dufs、Photo、Sentinel 仓库均无独立 Release workflow，`v0.4.0` 没有任何模块独立资产。
`v0.4.0` 的定位是正式、非 prerelease 的架构/构建里程碑 Release，并非 production-ready 资格
声明；Release 正文已明确写出该分类，未来发布 workflow 也会自动前置同一警示。后者仍受第 3、
5 节列出的运行与数据门禁约束。

## 5. 可重复性与剩余边界

当前可审计保证是：完整源码 revision、工具链、模块图、路径、manifest、每次构建的递归校验和与
官方发布流水线固定。正式 Union 候选与正式 Release 逐文件相同。直接从 Builder 仓库触发的 full
artifact 与从 Union 仓库调用的 full artifact 中，只有 `bin/unionc` 不同；根因是开发模式回退
路径通过 `CARGO_MANIFEST_DIR` 编入二进制，两个 Actions checkout 根不同。生产发行始终从
`bin/unionc` 相对定位 `share/union/web`，因此运行路径不使用该回退值，但这意味着当前不能宣称
“跨任意 checkout 根逐字节相同”。若要提升到该保证，后续必须删除该绝对路径或在 Builder 中
统一 `--remap-path-prefix`，并增加双路径字节比较门禁。

该限制不改变本页的正式资产完整性与 revision 证据。尚未完成的项目仍是生产运行验收：真实
PostgreSQL/SQLite/文件系统、公开 TLS、strict HTTP、媒体、业务数据迁移和故障注入。
