# URL 安装输入框焦点样式修复

## 目标

Git / GitHub URL 输入框在获得键盘焦点时只显示一层清晰的蓝色焦点提示，避免当前边框与全局 `:focus-visible` 轮廓叠加形成双层蓝框。

## 方案

- 保留 `.install-url-input:focus` 的主题色边框，作为唯一的可见焦点提示。
- 为 `.install-url-input:focus-visible` 显式移除全局 outline 和 outline offset。
- 不调整输入框宽度、间距、按钮位置、文案或提交行为。

## 验收

- 鼠标或键盘聚焦 URL 输入框时，仅出现单层蓝色边框。
- 全局输入框无障碍焦点规则仍适用于其他输入框。
- Git URL 安装表单现有测试继续通过。
