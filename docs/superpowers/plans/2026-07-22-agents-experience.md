# Agents 体验实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：**将当前 Agents 摘要页升级为“仅已检测 Agent 的列表 + Agent Skill 工作台 + 中央仓库添加弹层”的可读、可操作 UI。

**架构：**前端路由以 `agent_id` 标识详情页；现有 `ScanReport` 是所有只读数据的唯一来源。中央仓库与同步执行不在本期接入，弹层仅显示明确的计划状态，不能伪造文件写入成功。

**技术栈：**React 18、TypeScript 5、React Router 6、Zustand 4、现有 CSS；不新增依赖。

## 全局约束

- 列表仅显示 `detection_status === "Detected"` 或 `"Partial"` 的 Agent。
- 不改 Rust、Tauri IPC、Skill 指纹算法或扫描逻辑。
- 不新增数据库、中央仓库服务、Sync Engine 或真实文件写入。
- 所有未实现的写操作必须禁用并解释原因；不得伪造成功。
- 数据来自 `useScanStore().report`；扫描错误必须继续显示，已有报告不丢失。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `src/routes/Agents.tsx` | 已检测 Agent 卡片列表与详情页入口。 |
| `src/routes/AgentDetail.tsx` | 单 Agent Skill 工作台、搜索、视图切换和弹层状态。 |
| `src/components/AddSkillModal.tsx` | 中央仓库选择和同步预览的计划态弹层。 |
| `src/App.tsx` | 注册 `/agents/:agentId` 路由。 |
| `src/styles/global.css` | 卡片、工作台、Skill 网格、模态框样式。 |

## Task 1：检测 Agent 列表与详情路由（已完成：`91c3c06`）

**文件：**修改 `src/routes/Agents.tsx`、`src/App.tsx`、`src/styles/global.css`；新建 `src/routes/AgentDetail.tsx`。

- [ ] **步骤 1：先写失败的路由使用契约**

在 `App.tsx` 添加：

```tsx
<Route path="/agents/:agentId" element={<AgentDetail />} />
```

并在 `Agents.tsx` import 不存在的 `Link` 卡片详情路由。

- [ ] **步骤 2：验证红灯**

运行：`pnpm build`  
预期：报错 `AgentDetail` 模块不存在。

- [ ] **步骤 3：实现最小列表和详情数据查找**

```ts
const detectedAgents = report.agents.filter((agent) =>
  agent.detection_status === "Detected" || agent.detection_status === "Partial",
);
```

每张卡片使用 `<Link to={\`/agents/${agent.agent_id}\`}>`，展示图标占位、名称、`{agent.skills.length} Skills` 与箭头。`AgentDetail` 使用 `useParams()` 和 `report.agents.find(...)`；找不到时提供返回列表入口。

- [ ] **步骤 4：验证绿灯**

运行：`pnpm build`  
预期：类型检查和 Vite 构建通过。

- [ ] **步骤 5：提交**

```bash
git add src/App.tsx src/routes/Agents.tsx src/routes/AgentDetail.tsx src/styles/global.css
git commit -m "feat: add detected agent list and detail route"
```

## Task 2：能力控制台视觉重构与 Agent Skill 工作台

**文件：**修改 `src/routes/AgentDetail.tsx`、`src/styles/global.css`。

- [ ] **步骤 1：先写失败的工作台契约**

在详情页引用不存在的 `filteredSkills` 和 `viewMode`，并让 `pnpm build` 失败。

- [ ] **步骤 2：实现搜索和视图切换**

```ts
const [query, setQuery] = useState("");
const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
const filteredSkills = agent.skills.filter((skill) =>
  `${skill.name} ${skill.description}`.toLowerCase().includes(query.toLowerCase()),
);
```

Agents 列表重构为能力控制台：环境标签、`Agents · N` 标题、说明文本、右侧“重新扫描”次级按钮；已检测 Agent 卡片使用深色渐变、图标、状态徽标、Skills/Roots 数字和 “Open workspace →”。

详情顶部展示名称、技能数、首个根路径、`skills / issues` 摘要；右侧有搜索、刷新（调用共享 `scan`）、网格/列表切换及唯一绿色主操作“Add Skill”。默认三列 Skill 网格是视觉核心；卡片用内容区/底部操作区分隔，显示名称、截断描述、文件数和“仅本地”标签。导入/删除按钮禁用，`title="同步功能尚未实现"`。

- [ ] **步骤 3：验证绿灯**

运行：`pnpm build`  
预期：构建通过。

- [ ] **步骤 4：提交**

```bash
git add src/routes/AgentDetail.tsx src/styles/global.css
git commit -m "feat: add agent skill workspace"
```

## Task 3：中央仓库添加弹层（计划态）

**文件：**新建 `src/components/AddSkillModal.tsx`；修改 `src/routes/AgentDetail.tsx`、`src/styles/global.css`。

- [ ] **步骤 1：写失败的弹层契约**

在详情页 import 不存在的 `AddSkillModal` 并运行 `pnpm build`；预期模块不存在。

- [ ] **步骤 2：实现弹层**

```tsx
interface AddSkillModalProps { agentName: string; onClose: () => void; }
export function AddSkillModal({ agentName, onClose }: AddSkillModalProps) {
  return <div role="dialog" aria-modal="true" aria-label={`添加到 ${agentName}`} />;
}
```

弹层包含搜索框、空的中央仓库状态、已选数量、取消和禁用的 `同步到 {agentName}` 按钮；明确文案“中央仓库与同步引擎即将接入”。点击遮罩或取消关闭弹层，Escape 关闭。

- [ ] **步骤 3：验证绿灯与手工路径**

运行：`pnpm build`。启动 `pnpm tauri:dev`，扫描后进入一个 Agent，打开/关闭弹层，验证不会触发文件写入。

- [ ] **步骤 4：提交与发布门禁**

```bash
git add src/components/AddSkillModal.tsx src/routes/AgentDetail.tsx src/styles/global.css
git commit -m "feat: add planned skill sync modal"
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

## Task 4：Slate Blue 视觉系统

**文件：**修改 `src/styles/global.css`、`src/routes/Agents.tsx`、`src/routes/AgentDetail.tsx`。

- [ ] **步骤 1：写失败的视觉 token 使用契约**

在 Agents 页面和详情页引用 `var(--agents-surface)`、`var(--agents-primary)`，在 CSS 未定义这些 token 时运行浏览器开发者检查，预期页面使用回退色或 token 未解析。

- [ ] **步骤 2：定义统一 token 并替换主色**

```css
:root {
  --agents-canvas: #10131a;
  --agents-surface: #171d27;
  --agents-border: #2b3a51;
  --agents-text: #edf1f7;
  --agents-muted: #91a0b4;
  --agents-primary: #3b82f6;
  --agents-primary-hover: #2563eb;
}
```

Agents 相关区域仅使用这些 token：蓝色仅用于“Open workspace”、选中态和“Add Skill”；所有检测状态使用低饱和蓝/灰标签。移除 Agents 区域的橙色图标背景、绿色主按钮和高饱和状态色。

- [ ] **步骤 3：验证视觉与构建**

运行：`pnpm build`。启动 `pnpm tauri:dev`，确认 Agents 列表与详情页均使用 Slate Blue，且主操作只有蓝色“Add Skill”。

- [ ] **步骤 4：提交**

```bash
git add src/styles/global.css src/routes/Agents.tsx src/routes/AgentDetail.tsx
git commit -m "style: apply slate blue agents palette"
```
