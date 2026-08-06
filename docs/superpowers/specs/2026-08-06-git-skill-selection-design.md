# Git 仓库多 Skill 选择设计

## 目标

从 Git 仓库安装时解析真实的 `SKILL.md` 内容。一个仓库有多个 Skill 时，用户先选择一个 Skill，再选择分发 Agent；找不到 Skill 或克隆失败时显示明确错误，绝不创建占位 Skill。

## 数据流

1. 前端提交 Git 地址到新的解析命令。
2. 后端浅克隆至临时目录，递归枚举非 `.git` 目录中的 `SKILL.md` 或 `skill.md`。
3. 后端读取每个候选的 frontmatter，返回名称、描述和相对路径；临时目录随后删除。
4. 前端根据候选数自动继续单项流程，或显示选择列表。
5. 用户确认候选和 Agent 后，安装命令再次浅克隆，按用户选择的相对路径复制整个 Skill 目录到主库。

## 接口

- `inspect_git_skills(source) -> GitSkillCandidate[]`
  - `name`: frontmatter 的 `name`，缺失时使用目录名。
  - `description`: frontmatter 的 `description`，缺失时为空字符串。
  - `relative_path`: 仓库根目录到 Skill 根目录的相对路径。
- `install_skill_to_master(skill_name, source, source_subdir?)`
  - `source_subdir` 存在时只能复制克隆仓库内该路径；路径越界、缺少 `SKILL.md` 或克隆失败都返回错误。

## 前端交互

- 输入地址后先显示“正在解析仓库”。
- 0 个候选：显示“仓库中未找到 SKILL.md”。
- 1 个候选：直接进入现有 Agent 分发弹窗。
- 多个候选：显示“选择要安装的 Skill”弹窗；每项显示名称、描述和相对路径，选择后进入 Agent 分发弹窗。
- 所有解析和安装失败都以现有安装错误反馈展示。

## 安全与边界

- 只接受克隆目录内的相对路径；拒绝绝对路径、`..` 路径和缺少 `SKILL.md` 的目录。
- 忽略 `.git` 目录。
- 不再为 Git 仓库解析失败创建 `Skill '<name>'` 占位文件。
- 本地目录与 ZIP 导入行为保持不变。

## 验收

- `chuspeeism/dashi-ppt-skill` 解析出 `skills/dashi-ppt`，安装后保留其完整内容并命名为 `dashi-ppt`。
- 多 Skill 仓库需要用户选择，安装时仅复制所选目录。
- 无 Skill 或克隆失败时安装失败且主库不产生新目录。
