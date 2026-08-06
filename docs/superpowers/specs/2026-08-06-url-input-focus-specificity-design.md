# Git URL 输入框焦点样式修复设计

## 问题

Git / GitHub URL 输入框聚焦时同时出现输入框边框和全局键盘焦点外圈。
全局规则 `input:not(.skill-search *):focus-visible` 的选择器优先级高于
`.install-url-input:focus-visible`，导致局部的 `outline: none` 未生效。

## 设计

将局部规则改为 `input.install-url-input:focus-visible`，使其与全局规则拥有
相同的选择器优先级，且因定义位置更靠后而覆盖全局外圈。

输入框聚焦后仅保留现有的蓝色 1px 边框；不修改尺寸、间距、按钮或其它输入框。

## 验证

增加样式回归测试，断言局部规则采用 `input.install-url-input:focus-visible` 并清除
`outline`。运行该测试、完整前端测试和生产构建。
