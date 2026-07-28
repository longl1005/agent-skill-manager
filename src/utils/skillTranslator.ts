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
  "brainstorming": {
    titleZh: "头脑风暴与需求设计探究",
    descriptionZh: "在开始任何创造性开发（创建新功能、构建组件、修改行为）之前必须使用的需求探究规范。",
    bodyZh: `# 头脑风暴与需求设计探究

探索用户真实意图、明确需求边界与架构设计，确保在编码前达成设计对齐。
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

export function translateSkill(skillName: string, originalDesc: string, originalBody: string): {
  descriptionZh: string;
  bodyZh: string;
} {
  const preset = PRESET_TRANSLATIONS[skillName];
  if (preset) {
    return {
      descriptionZh: preset.descriptionZh,
      bodyZh: preset.bodyZh,
    };
  }

  // 智能智能回落翻译规则
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
    descriptionZh: translatedDesc || "暂无中文描述",
    bodyZh: translatedBody,
  };
}
