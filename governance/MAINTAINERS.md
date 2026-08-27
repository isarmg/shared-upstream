# 维护与发布职责

当前没有可安全推断的个人账号，因此使用角色而不是虚构用户名。建立远端仓库时，必须把
下列角色映射到真实人员或团队，并在 CODEOWNERS/分支保护中落实。

## 角色

- **Upstream Maintainer**：管理版本、CHANGELOG、弃用周期和正式制品。
- **Security Reviewer**：审批认证、加密、Cookie、CSRF、秘密值和安全响应头变更。
- **Design Reviewer**：审批令牌、无框架 CSS、可访问性和视觉基线变更。
- **Consumer Owner**：分别负责四个消费者的升级验证，任何上游发布都不能绕过消费者测试。

## 合并规则

- 普通文档和测试修复：至少一名 Upstream Maintainer 审批。
- 设计公共 API：Upstream Maintainer 与 Design Reviewer 各一名审批。
- 安全或认证行为：Upstream Maintainer 与 Security Reviewer 各一名审批。
- 破坏性变更：除上述审批外，至少两个受影响 Consumer Owner 确认迁移方案。

## 发布权限

- 只有 Upstream Maintainer 可以创建 tag 和发布制品。
- 正式发布必须来自受保护 tag、干净工作树和锁定依赖。
- 发布流程生成 SHA-256 清单；消费者固定版本和校验和，不自动跟随最新版。
- 安全制品与纯设计制品分开版本和审查，禁止把认证行为变化藏在样式发布中。

## 例外

消费者可以拒绝某个公共模块，但必须在 `contracts/adr/` 留下带到期审查日期的 ADR。
没有两个活跃消费者的公共实现应在季度审查时删除或降级为示例。
