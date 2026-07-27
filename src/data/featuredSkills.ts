export interface FeaturedSkill {
  id: string;
  name: string;
  category: "all" | "ui" | "search" | "workflow" | "architecture";
  description: Record<"zh" | "en", string>;
  author: string;
  repoUrl: string;
  fileCount: number;
}

export const FEATURED_SKILLS: FeaturedSkill[] = [
  {
    id: "frontend-design",
    name: "frontend-design",
    category: "ui",
    description: {
      zh: "注重视觉美感、排版与响应式体验的前端 UI 设计指南与组件规范",
      en: "Guidance for distinctive visual design and UI component patterns",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills/frontend-design",
    fileCount: 2,
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
    repoUrl: "https://github.com/superpowers/skills/ui-ux-pro-max",
    fileCount: 5,
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
    repoUrl: "https://github.com/superpowers/skills/free-search",
    fileCount: 2,
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
    repoUrl: "https://github.com/superpowers/skills/tavily-search",
    fileCount: 4,
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
    repoUrl: "https://github.com/superpowers/skills/banner-design",
    fileCount: 3,
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
    repoUrl: "https://github.com/superpowers/skills/systematic-debugging",
    fileCount: 2,
  },
];

export function getFeaturedSkillsByCategory(category: string): FeaturedSkill[] {
  if (category === "all") return FEATURED_SKILLS;
  return FEATURED_SKILLS.filter((s) => s.category === category);
}
