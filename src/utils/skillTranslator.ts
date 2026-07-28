export interface TranslatedSkillData {
  titleZh?: string;
  descriptionZh: string;
  bodyZh: string;
}

const PRESET_TRANSLATIONS: Record<string, TranslatedSkillData> = {
  "banner-design": {
    titleZh: "Banner 视觉横幅设计指南",
    descriptionZh: "为社交媒体、广告、网站 Hero 图像与印刷品设计各类视觉横幅。提供多种艺术指导选项与 AI 图像生成提示词。",
    bodyZh: `# Banner 视觉横幅设计指南

用于为社交媒体、广告投效、网站 Hero 图像与创意资产设计高质量横幅。

## 🎨 艺术指导与风格支持
- **极简风 (Minimalist)**：清晰排版与大面积留白。
- **渐变色彩 (Gradient)**：现代 HSL 渐变与流动光感。
- **玻璃拟物 (Glassmorphic)**：半透明磨砂玻璃层叠效果。
- **3D / 霓虹 (Neon)**：炫酷立体材质与高饱和发光。

## 📐 支持的主流尺寸规格
- **Twitter/X Header**: 1500 × 500 px
- **LinkedIn Banner**: 1584 × 396 px
- **YouTube Banner**: 2560 × 1440 px
- **Website Hero**: 1920 × 1080 px / 1440 × 900 px
- **Instagram Story / Post**: 1080 × 1920 px / 1080 × 1080 px

## 🚀 常用生成指令
当需要生成图片资产时，可搭配 AI 图像生成工具使用对应 AspectRatio 比例输出。
`,
  },
  "find-skills": {
    titleZh: "Agent 技能检索与安装扩展",
    descriptionZh: "帮助用户搜索、发现与安装 AI Agent 技能插件，解答关于可扩展能力的问题。",
    bodyZh: `# Agent 技能检索与安装扩展

当用户询问“如何实现 X”、“有没有处理 Y 的技能”时触发，协助查找和推荐合适的 Skill 模块。

## 🔍 核心功能
- 全局 Skill 索引扫描
- 语义匹配与功能推荐
- 安装指令指导
`,
  },
  "free-search": {
    titleZh: "免费免 Key 网页与百科搜索",
    descriptionZh: "无需 API 密钥的完全免费 Web 搜索，整合 Wikipedia 百科 API 与 DuckDuckGo 内容提取。",
    bodyZh: `# 免费免 Key 网页与百科搜索

无需注册与 API Key，快速获取公共网页、维基百科与实时信息。

## ⚡ 适用场景
1. 查找公开概念、算法定义与文档
2. 批量提取非鉴权网页文本
`,
  },
  "frontend-design": {
    titleZh: "前端 Visual Design 视觉美化指导",
    descriptionZh: "针对新建 UI 或重构界面提供独特别致的视觉设计指导，避免模板化与平庸同质化。",
    bodyZh: `# 前端 Visual Design 视觉美化指导

打造令人眼前一亮的现代前端界面，建立专属的色彩与 Typography 排版系统。

## 🎯 设计原则
- **拒绝平庸颜色**：使用精心调配的 HSL 渐变与色彩暗调模式。
- **现代排版**：采用 Outfit、Inter、Roboto 等无衬线现代字体。
- **微交互与质感**：提供动感 Hover 反馈与精致玻璃微光效果。
`,
  },
  "ui-ux-pro-max": {
    titleZh: "UI/UX 全栈设计智库",
    descriptionZh: "UI/UX 设计智能本地知识库。涵盖 67 种设计风格、161 种调色盘、57 种字体搭配、25 种图表样式与 21 种主流前端技术栈。",
    bodyZh: `# UI/UX 全栈设计智库

面向全栈应用、前端页面、设计系统与可视化数据图表的 UI/UX 设计大脑。

## 📦 知识库覆盖
- **设计风格**: Dark Mode, Glassmorphism, Neumorphism, Minimalist, Editorial 等 67 种
- **配色调色盘**: 161 种专业搭配方案
- **字体排版**: 57 种 Font Pairings 组合
- **技术栈支持**: React, Next.js, Vue, Svelte, Tailwind CSS, shadcn/ui 等
`,
  },
  "systematic-debugging": {
    titleZh: "系统化排错与根因诊断流程",
    descriptionZh: "在遇到任何 Bug、测试失败或非预期行为时强制使用的系统化诊断与调试规范。",
    bodyZh: `# 系统化排错与根因诊断流程

## 🔍 调试原则
1. **查看日志优先**：在提出任何假设前，必须读取完整未截断的 Error 堆栈。
2. **拒绝掩盖症状**：禁止静默 try/catch 或注释掉报错断言。
3. **因果分析**：复现步骤 -> 提取 Log -> 定位 Root Cause -> 验证修复。
`,
  },
  "test-driven-development": {
    titleZh: "TDD 测试驱动开发规范",
    descriptionZh: "在编写具体实现代码前，先编写自动化测试，确保功能重构与开发的可靠性。",
    bodyZh: `# TDD 测试驱动开发规范

## 🔄 Red-Green-Refactor 循环
1. **Red**: 编写一个必然失败的单元测试/集成测试。
2. **Green**: 编写最简实现代码使测试通过。
3. **Refactor**: 在测试绿灯保护下优化与重构代码。
`,
  },
  "ai-video-generation": {
    titleZh: "AI 视频生成与镜头动作调度",
    descriptionZh: "通过文本提示词或首尾帧控制生成高质量 AI 视频与动态视觉资产。",
    bodyZh: `# AI 视频生成与镜头动作调度

针对视频剪辑、动态 Banner 与 AI 镜头控制的自动化调度工具。

## 🎬 核心功能
- **文本生成视频 (Text-to-Video)**：根据自然语言描述构建镜头流动。
- **图生视频 (Image-to-Video)**：指定参考图与运动幅度轨迹。
`,
  },
  "grill-with-docs": {
    titleZh: "文档驱动型架构对齐与深度访谈",
    descriptionZh: "通过追问式访谈打磨设计方案，同时自动生成 ADR 决策记录与术语表词典。",
    bodyZh: `# 文档驱动型架构对齐与深度访谈

在遇到重大架构决策时，通过连环追问厘清模糊细节，同步产出架构文档。
`,
  },
  "handoff": {
    titleZh: "会话上下文压缩与 Agent 任务交接",
    descriptionZh: "将当前长对话整理压缩为标准化 Handoff 交接文档，便于后续会话或其他 Agent 无缝接管。",
    bodyZh: `# 会话上下文压缩与 Agent 任务交接

## 📋 交接包含内容
- 当前已完成的工作与阶段成果
- 尚未解决的已知问题或 Bug
- 下一步行动计划 (Next Steps)
`,
  },
  "tavily-search": {
    titleZh: "Tavily AI 优化搜索引擎",
    descriptionZh: "专为 AI Agent 打造的高效网页检索 API，支持结构化 JSON 提取与上下文优化。",
    bodyZh: `# Tavily AI 优化搜索引擎

提供高相关度、去除广告杂质的纯净网页内容检索服务。
`,
  },
  "to-spec": {
    titleZh: "对话归纳与 Spec 规格说明书生成",
    descriptionZh: "将当前会话讨论结果整理归纳为规范的 Technical Spec 文档，并推送至项目 Task/Issue 追踪器。",
    bodyZh: `# 对话归纳与 Spec 规格说明书生成

无需二次访谈，直接梳理对话中的技术要点并生成可落地的 Spec 说明书。
`,
  },
  "ui-styling": {
    titleZh: "shadcn/ui + Tailwind CSS 界面样式组件库",
    descriptionZh: "基于 Radix UI 与 Tailwind CSS 构建无障碍、高美感、支持 Dark Mode 的现代化 React 组件与样式模式。",
    bodyZh: `# shadcn/ui + Tailwind CSS 界面样式组件库

提供设计系统、响应式布局、无障碍对话框与 Form 表单控件最佳实践。
`,
  },
  "agent-browser": {
    titleZh: "Playwright 浏览器自动化与 DOM 操作",
    descriptionZh: "通过控制无头浏览器进行页面导航、表单填写、DOM 截图与 Web 交互自动化。",
    bodyZh: `# Playwright 浏览器自动化与 DOM 操作

支持在 Agent 侧自动浏览网页、抓取动态数据与验证 Web 应用功能。
`,
  },
  "grill-me": {
    titleZh: "方案深度质询与交互式对齐",
    descriptionZh: "通过互动式提问彻底厘清设计选择、架构考量与产品细节，避免开发方向偏离。",
    bodyZh: `# 方案深度质询与交互式对齐

在写代码前主动反向质询，暴露潜在逻辑漏洞与遗漏边缘情况。
`,
  },
  "writing-plans": {
    titleZh: "多步骤任务实施计划书撰写",
    descriptionZh: "在开始复杂编码前，编写包含详细步骤、文件变更清单与验证方法的 implementation_plan.md。",
    bodyZh: `# 多步骤任务实施计划书撰写

将复杂需求拆解为独立可验证的小任务，确保开发过程条理清晰。
`,
  },
  "executing-plans": {
    titleZh: "分步计划执行与阶段性审核",
    descriptionZh: "按实施计划逐步落地代码，并在关键 Checkpoint 节点进行技术验证与评审。",
    bodyZh: `# 分步计划执行与阶段性审核

严格遵循 Implementation Plan 执行，确保每一阶段变更均可验证。
`,
  },
  "receiving-code-review": {
    titleZh: "代码评审意见接收与技术验证",
    descriptionZh: "严谨对待 Code Review 反馈，在修改代码前进行充分技术验证与根因核对。",
    bodyZh: `# 代码评审意见接收与技术验证

拒绝敷衍式修改，必须用事实与代码测试验证 Reviewer 的改进建议。
`,
  },
  "requesting-code-review": {
    titleZh: "代码合并前合规与质量评审",
    descriptionZh: "在完成重大功能或合并分支前主动发起质量走查，核对架构规范与测试覆盖率。",
    bodyZh: `# 代码合并前合规与质量评审

确保变更符合项目架构标准，测试用例全部通过后方可提交 PR。
`,
  },
  "subagent-driven-development": {
    titleZh: "Subagent 子智能体驱动并行开发",
    descriptionZh: "将相互独立的开发任务分发给多个子 Agent 并行执行，提升大型项目构建效率。",
    bodyZh: `# Subagent 子智能体驱动并行开发

隔离上下文，让专业 Subagent 分工处理子模块并汇总结果。
`,
  },
  "using-git-worktrees": {
    titleZh: "Git Worktree 隔离工作区调度",
    descriptionZh: "使用 Git Worktree 创建独立并行的工作目录，避免频繁切换 Branch 破坏当前上下文。",
    bodyZh: `# Git Worktree 隔离工作区调度

在独立工作树中执行功能试验，安全隔离全局状态。
`,
  },
  "verification-before-completion": {
    titleZh: "完成前 Empiric 运行验证规范",
    descriptionZh: "在向用户声明任务完成前，必须亲自运行 Build 与 Test 命令，提供确凿的运行成功证据。",
    bodyZh: `# 完成前 Empiric 运行验证规范

**事实胜于雄辩**：仅修改文件不等于完成任务，必须执行构建验证与单元测试！
`,
  },
};

const COMMON_HEADER_MAP: [RegExp, string][] = [
  [/^#\s+Overview/gi, "# 概述"],
  [/^#\s+Description/gi, "# 描述说明"],
  [/^##\s+Overview/gi, "## 概述"],
  [/^##\s+Description/gi, "## 描述说明"],
  [/^##\s+Instructions/gi, "## 操作指南"],
  [/^##\s+Usage/gi, "## 使用方法"],
  [/^##\s+Requirements/gi, "## 前置要求"],
  [/^##\s+Examples/gi, "## 示例代码与用法"],
  [/^##\s+Principles/gi, "## 设计原则"],
  [/^##\s+Features/gi, "## 核心功能特性"],
  [/^##\s+Actions/gi, "## 可用指令操作"],
  [/^###\s+Overview/gi, "### 概述"],
  [/^###\s+Usage/gi, "### 使用说明"],
];

const COMMON_LABEL_MAP: Record<string, string> = {
  name: "技能名称 (Name)",
  description: "描述说明 (Description)",
  "argument-hint": "参数/指令提示 (Argument Hint)",
  version: "版本号 (Version)",
  license: "开源协议 (License)",
  author: "作者 (Author)",
  tags: "标签 (Tags)",
};

export function translateFrontmatterKey(key: string): string {
  return COMMON_LABEL_MAP[key] || key.replace(/-/g, " ");
}

export function translateSkill(skillName: string, originalDesc: string, originalBody: string): TranslatedSkillData {
  const preset = PRESET_TRANSLATIONS[skillName];
  if (preset) {
    return {
      titleZh: preset.titleZh,
      descriptionZh: preset.descriptionZh,
      bodyZh: preset.bodyZh,
    };
  }

  // 智能回落翻译规则
  let translatedDesc = originalDesc;
  if (originalDesc) {
    translatedDesc = originalDesc
      .replace(/^Design\s+/i, "设计 ")
      .replace(/^Provides?\s+/i, "提供 ")
      .replace(/^Use when\s+/i, "适用于 ")
      .replace(/^Help users\s+/i, "帮助用户 ")
      .replace(/for AI Agents?/gi, "适用于 AI Agent")
      .replace(/cross-platform/gi, "跨平台")
      .replace(/for social media/gi, "针对社交媒体")
      .replace(/guide for/gi, "指南于");
  }

  let translatedBody = originalBody;
  for (const [pattern, replacement] of COMMON_HEADER_MAP) {
    translatedBody = translatedBody.replace(pattern, replacement);
  }

  return {
    titleZh: undefined,
    descriptionZh: translatedDesc || "暂无中文描述",
    bodyZh: translatedBody,
  };
}
