# 反白托盘图标 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 macOS 托盘图标替换为与应用图标一致的白色圆角主体与中央透明三节点镂空图形，提升菜单栏可见性。

**Architecture:** 仅替换 `tray-template.png` 资源；Rust 保持 `tauri::include_image!` 与 `icon_as_template(true)` 的现有加载路径。图像先以纯色键控背景生成，再移除键色生成带 alpha 的 PNG，并按 18 × 18 像素缩放。

**Tech Stack:** GPT Image、Python chroma-key removal helper、macOS `sips`、Tauri 2。

## Global Constraints

- 画布必须为 18 × 18 px、RGBA PNG，并具有 alpha 通道。
- 外轮廓为带安全边距的白色圆角方形主体，约占 15 × 15 px。
- 中央三节点连接图形必须透明镂空，且必须与应用 icon 一致：上方一个圆节点、下方左右各一个圆节点，三条连接臂在中心汇合；不得使用蓝色、阴影、渐变、描边、文字或额外装饰。
- macOS 保持 `icon_as_template(true)`；Windows 继续使用彩色默认应用图标。
- 四角必须完全透明；不改动托盘菜单、事件、窗口生命周期或 Windows 图标策略。

---

### Task 1: 创建并校验反白模板资源

**Files:**
- Modify: `src-tauri/icons/tray-template.png`
- Verify: `src-tauri/src/tray.rs:188-191`
- Verify: `src-tauri/target/release/bundle/macos/Agent Skill Manager.app`

**Interfaces:**
- Consumes: `tauri::include_image!("./icons/tray-template.png")` 与 `.icon_as_template(true)`。
- Produces: 18 × 18、透明四角、白色圆角主体与透明三节点镂空的 `tray-template.png`。

- [ ] **Step 1: 生成带可移除背景的图标源图**

使用 `image_gen` 生成一张用于键控的方形源图，提示词必须包含：

```text
Use case: logo-brand
Asset type: macOS menu bar template icon
Primary request: a white rounded-square app icon with a centered upright three-node network symbol punched out as transparent negative space: one circular node at the top, two circular nodes at the lower left and lower right, and three arms meeting at a central junction.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background.
Style/medium: crisp minimal flat vector-like icon.
Composition/framing: centered 15×15-style rounded-square silhouette with generous outer padding.
Constraints: only white rounded-square body and the transparent cutout symbol; no blue, black fill inside the cutout, shadows, gradients, borders, text, watermark, or extra elements.
```

- [ ] **Step 2: 移除键色并覆盖项目模板资源**

将生成源图复制至 `/private/tmp/asm-inverted-tray-source.png`，运行：

```bash
python3 /Users/dragon/.codex/skills/.system/imagegen/scripts/remove_chroma_key.py \
  --input /private/tmp/asm-inverted-tray-source.png \
  --out src-tauri/icons/tray-template.png \
  --auto-key border --soft-matte --transparent-threshold 12 \
  --opaque-threshold 220 --despill --force
```

- [ ] **Step 3: 缩放资源至托盘实际尺寸**

```bash
sips --resampleHeightWidth 18 18 src-tauri/icons/tray-template.png
```

- [ ] **Step 4: 验证 PNG 尺寸与透明通道**

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha src-tauri/icons/tray-template.png
file src-tauri/icons/tray-template.png
```

Expected: `pixelWidth: 18`、`pixelHeight: 18`、`hasAlpha: yes`，且为 RGBA PNG。使用图像查看工具确认四角透明、主体为白色、三节点区域透明。

- [ ] **Step 5: 验证加载策略未被改变**

```bash
rg -n 'include_image!\("\./icons/tray-template.png"\)|icon_as_template\(true\)' src-tauri/src/tray.rs
```

Expected: 两项均匹配，确保 macOS 仍使用模板渲染。

- [ ] **Step 6: 构建 macOS 应用包**

```bash
pnpm tauri build --bundles app
```

Expected: 构建成功，并生成 `src-tauri/target/release/bundle/macos/Agent Skill Manager.app`。

- [ ] **Step 7: 手工验收**

启动生成的 `.app`，在深色与浅色菜单栏中确认：图标轮廓明显、四角透明、中央三节点为菜单栏颜色的镂空，且没有蓝色背景。

- [ ] **Step 8: 提交**

```bash
git add src-tauri/icons/tray-template.png
git commit -m "feat: use inverted app icon for macOS tray"
```

仅当该资源没有混入任何不相关改动时执行。

## 自检

- 视觉规格由步骤 1–4 覆盖。
- macOS 模板和 Windows 不受影响由步骤 5 覆盖。
- 实际 `.app` 构建和菜单栏视觉由步骤 6–7 覆盖。
