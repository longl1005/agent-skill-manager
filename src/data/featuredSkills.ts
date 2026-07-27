export interface FeaturedSkill {
  id: string;
  name: string;
  category: "all" | "ui" | "search" | "workflow" | "architecture";
  description: Record<"zh" | "en", string>;
  author: string;
  repoUrl: string;
  fileCount: number;
  installsText?: string;
  ownerRepo?: string;
}

export const FEATURED_SKILLS: FeaturedSkill[] = [
  {
    id: "find-skills",
    name: "find-skills",
    category: "search",
    description: {
      zh: "在 GitHub / skills.sh 上快速查找并检索各类 Agent Skill 扩展",
      en: "Discover and search agent skills from GitHub / skills.sh",
    },
    author: "Vercel Labs",
    repoUrl: "https://github.com/vercel-labs/skills",
    fileCount: 2,
    installsText: "2.7M installs",
    ownerRepo: "vercel-labs/skills",
  },
  {
    id: "frontend-design",
    name: "frontend-design",
    category: "ui",
    description: {
      zh: "注重视觉美感、排版与响应式体验的前端 UI 设计指南与组件规范",
      en: "Guidance for distinctive visual design and UI component patterns",
    },
    author: "Anthropic",
    repoUrl: "https://github.com/anthropics/skills",
    fileCount: 2,
    installsText: "709K installs",
    ownerRepo: "anthropics/skills",
  },
  {
    id: "grill-me",
    name: "grill-me",
    category: "workflow",
    description: {
      zh: "通过交互式访谈引导深入剖析需求并对齐设计决策",
      en: "Interactive interview process to refine plans and resolve design decisions",
    },
    author: "Matt Pocock",
    repoUrl: "https://github.com/mattpocock/skills",
    fileCount: 2,
    installsText: "675K installs",
    ownerRepo: "mattpocock/skills",
  },
  {
    id: "agent-browser",
    name: "agent-browser",
    category: "workflow",
    description: {
      zh: "CLI 驱动的高效网页自动化与浏览器交互测试工具",
      en: "Headless browser automation and CLI testing utility for agents",
    },
    author: "Vercel Labs",
    repoUrl: "https://github.com/vercel-labs/agent-browser",
    fileCount: 3,
    installsText: "583K installs",
    ownerRepo: "vercel-labs/agent-browser",
  },
  {
    id: "ui-ux-pro-max",
    name: "ui-ux-pro-max",
    category: "ui",
    description: {
      zh: "UI/UX 设计情报库，内置 67 种风格、161 种配色与 57 种字体搭配",
      en: "UI/UX design intelligence database with 67 styles and 161 palettes",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills",
    fileCount: 5,
    installsText: "420K installs",
    ownerRepo: "superpowers/skills",
  },
  {
    id: "free-search",
    name: "free-search",
    category: "search",
    description: {
      zh: "完全免费的 AI 联网搜索技能，支持维基百科与 DuckDuckGo 搜索",
      en: "Completely free web search engine using Wikipedia and DuckDuckGo",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills",
    fileCount: 2,
    installsText: "350K installs",
    ownerRepo: "superpowers/skills",
  },
  {
    id: "tavily-search",
    name: "tavily-search",
    category: "search",
    description: {
      zh: "专为 AI Agent 优化的结构化网络检索与网页内容提取技能",
      en: "AI-optimized web search engine powered by Tavily API",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills",
    fileCount: 4,
    installsText: "310K installs",
    ownerRepo: "superpowers/skills",
  },
  {
    id: "banner-design",
    name: "banner-design",
    category: "ui",
    description: {
      zh: "社交媒体、广告、网站 Hero 与全平台横幅 Banner 智能设计",
      en: "Design banners for social media, ads, website heroes, and print",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills",
    fileCount: 3,
    installsText: "280K installs",
    ownerRepo: "superpowers/skills",
  },
  {
    id: "systematic-debugging",
    name: "systematic-debugging",
    category: "workflow",
    description: {
      zh: "系统化 Bug 排查与根因诊断工作流指南",
      en: "Systematic debugging and root-cause analysis workflow",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills",
    fileCount: 2,
    installsText: "250K installs",
    ownerRepo: "superpowers/skills",
  },
];

export function getFeaturedSkillsByCategory(category: string): FeaturedSkill[] {
  if (category === "all") return FEATURED_SKILLS;
  return FEATURED_SKILLS.filter((s) => s.category === category);
}
