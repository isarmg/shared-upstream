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

基线中的 `sentinel-monitor` revision 为 `null`，记录的是采集当时尚未初始化 Git 的历史事实。
当前项目已建立独立仓库并采用 Apache-2.0；基线报告保持不可变，以免改写审计证据。
