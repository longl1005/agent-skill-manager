# 移除侧边栏收起功能与自定义标题栏设计

## 目标

删除应用顶部的侧边栏收起按钮和整条 28px 自定义标题栏，让主界面直接从系统原生窗口标题栏下方开始，并让桌面端侧边栏始终完整展开。

## 界面结构

- 删除 `App` 中的 `.app-titlebar`、箭头按钮和对应 SVG。
- 删除只用于承载自定义标题栏与主体两行布局的 `.app-frame` 包装层。
- `TrayEventBridge`、`UpdateDialog` 和路由结构保持不变，`.app-shell` 直接承载 `AppSidebar` 与主内容区。
- `AppSidebar` 始终渲染品牌、主导航、Agent 导航和设置入口，不再根据收起状态隐藏内容。
- 桌面端侧边栏继续使用现有 `--sidebar-w` 固定宽度。
- 保留现有 `max-width: 680px` 响应式规则；该规则属于窄屏布局，不是用户可操作的收起功能。

## 状态与依赖清理

- 删除 `sidebarCollapsed` 和 `toggleSidebar` 状态读取。
- 删除只服务于该功能的 `src/stores/uiStore.ts`。
- 删除 `nav.collapseSidebar`、`nav.expandSidebar` 中英文文案。
- 删除 `getCurrentWindow` 引用和 `startWindowDrag` 逻辑。
- 删除 Tauri 能力配置中的 `core:window:allow-start-dragging`；窗口继续使用默认系统装饰标题栏，不影响 macOS 或 Windows 的原生窗口拖动、最小化、最大化和关闭操作。

## 样式

- 删除 `.app-frame`、`.app-titlebar`、`.titlebar-sidebar-toggle` 和悬停样式。
- 删除 `.app-frame .app-shell`、`.app-shell.sidebar-collapsed` 以及所有 `.sidebar.is-collapsed` 样式。
- 删除 `.app-shell` 的列宽切换动画，因为侧边栏宽度不再变化。
- 继续使用现有 `.app-shell { height: 100%; }`，使主体占满原生标题栏下方的全部可用高度。
- 不修改颜色、字体、主题 Token、侧边栏宽度或内容区间距。

## 测试与验收

- 将 `App` 的收起交互测试替换为静态布局测试：页面不存在“收起菜单”或“展开菜单”按钮，`.app-shell` 不包含 `sidebar-collapsed` 类。
- 删除 `AppSidebar` 测试中的 UI Store 重置逻辑和“收起后隐藏导航”测试。
- 保留并依赖现有侧边栏导航测试，验证完整导航在默认渲染时始终可见。
- 运行 `App.test.tsx`、`AppSidebar.test.tsx`、全量前端测试、生产构建和 `git diff --check`。
- 在正在运行的 Tauri 应用中确认内容区上移 28px、侧边栏完整显示且原生标题栏仍可拖动窗口。

## 非目标

- 不调整原生窗口装饰或 Tauri 窗口尺寸配置。
- 不新增其他侧边栏显示模式或持久化设置。
- 不修改导航项目、Agent 列表、路由或业务数据。
- 不处理与本功能无关的现有未提交改动。
