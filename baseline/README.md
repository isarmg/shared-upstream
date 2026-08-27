# 项目基线

`projects.json` 是阶段 0 的机器可读清单，记录四个消费者在公共化之前的版本、部署模型、
浏览器范围和验证命令。`scripts/verify-baseline.mjs` 按相同格式执行这些命令，并将结果写入
`baseline/reports/`。

```bash
node scripts/verify-baseline.mjs --list
node scripts/verify-baseline.mjs --project union-rust --mode quick
node scripts/verify-baseline.mjs --all --mode full
```

基线报告记录命令、退出码、起止时间和日志末尾，不记录环境变量。报告不是测试替代品；
它证明每个项目仍然可以独立执行自己的验证流程。

`sentinel-monitor` 当前没有独立 Git 元数据，因此 revision 为 `null`。在它被正式纳入发布
流程前，应单独初始化仓库并增加许可证与 CI；阶段 0 不擅自做这项所有权决定。

