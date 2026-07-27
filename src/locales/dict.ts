export type Language = "zh" | "en";

export const dict = {
  zh: {
    // Navigation
    "nav.dashboard": "仪表盘",
    "nav.library": "技能库",
    "nav.install": "安装技能",
    "nav.allAgents": "所有智能体",
    "nav.discoveredAgents": "已发现智能体",
    "nav.settings": "设置",

    // Settings
    "settings.title": "设置",
    "settings.subtitle": "管理系统偏好与 Agent 技能目录配置",
    "settings.appearance.title": "外观主题",
    "settings.appearance.desc": "选择应用程序的视觉主题模式",
    "settings.theme.light": "浅色模式",
    "settings.theme.lightDesc": "适合白天的清爽干净视觉体验",
    "settings.theme.dark": "深色模式",
    "settings.theme.darkDesc": "适合暗光环境的极客暗色体验",
    "settings.theme.system": "跟随系统",
    "settings.theme.systemDesc": "根据操作系统设置自动切换主题",
    "settings.active": "✓ 已生效",
    "settings.lang.title": "语言 / Language",
    "settings.lang.desc": "选择控制台界面显示的语言（支持中文和英文）",
    "settings.lang.zh": "简体中文",
    "settings.lang.zhDesc": "默认语言 (Simplified Chinese)",
    "settings.lang.en": "English",
    "settings.lang.enDesc": "英文界面 (English Interface)",
    "settings.paths.title": "Agent 技能目录配置",
    "settings.paths.desc": "为每个 Agent 配置自定义技能目录路径，覆盖自动检测路径",
    "settings.paths.resetAll": "一键重置所有路径",
    "settings.paths.default": "默认",
    "settings.paths.overridden": "已覆盖",
    "settings.paths.placeholder": "输入自定义绝对路径",
    "settings.paths.save": "保存",
    "settings.paths.reset": "重置",
    // Skill Card
    "skillCard.upload": "上传至主库",
    "skillCard.managed": "✓ 已在主库",
    "skillCard.uploading": "上传中...",

    // Master Skill Library
    "skillLibrary.title": "Master 技能仓库",
    "skillLibrary.subtitle": "~/.asm/skills 集中存储与 Agent 软链接分发矩阵",
    "skillLibrary.searchPlaceholder": "搜索 Master 技能名称或描述...",
    "skillLibrary.filterAll": "全部",
    "skillLibrary.filterLinked": "已链接",
    "skillLibrary.filterUnlinked": "未链接",
    "skillLibrary.copyPath": "复制路径",
    "skillLibrary.copied": "已复制",
    "skillLibrary.noDescription": "(暂无描述)",
    "skillLibrary.agentMatrixTitle": "Agent 软链接分发矩阵",
    "skillLibrary.linked": "已链接",
    "skillLibrary.unlinked": "未链接",
    "skillLibrary.emptyHint": "在 ~/.asm/skills 中未找到 Master 技能。",
    "skillLibrary.emptySearch": "没有符合筛选条件的 Master 技能。",
    "skillLibrary.refresh": "刷新",

    // Dashboard
    "dashboard.title": "仪表盘",
    "dashboard.subtitle": "Agent 技能全局运维与集中调度概览大屏",
    "dashboard.metricMasterSkills": "主库技能总数",
    "dashboard.metricActiveAgents": "已连接 Agent",
    "dashboard.metricSymlinkCoverage": "软链接托管覆盖率",
    "dashboard.metricSyncStatus": "实时同步状态",
    "dashboard.syncActive": "后台自动同步中",
    "dashboard.lastRefreshed": "上次更新",
    "dashboard.quickLibrary": "主技能仓库",
    "dashboard.quickAgents": "智能体管理",
    "dashboard.agentMonitorTitle": "Agent 技能运行监控与分布矩阵",
    "dashboard.skillsUnit": "个技能",
    "dashboard.managedRatio": "主库托管率",

    // Agent Status
    "agentStatus.detected": "已连接",
    "agentStatus.partial": "部分连接",
    "agentStatus.notDetected": "未连接",

    // Agents Directory Page
    "agents.title": "所有智能体",
    "agents.subtitle": "当前系统上已识别的 Agent 技能工作区",
    "agents.detectedCount": "已检测到 {count} 个 Agent",
    "agents.emptyTitle": "未找到智能体",
    "agents.emptyDesc": "请安装对应的 Agent 软件或在设置中配置其技能目录。",

    // Agent Detail Page
    "agentDetail.installedSkills": "已安装技能",
    "agentDetail.noDescription": "(暂无描述)",
    "agentDetail.emptySkills": "该 Agent 暂未安装任何技能。",
    "agentDetail.fileCount": "{count} 个文件",
  },
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.library": "Skill Library",
    "nav.install": "Install Skills",
    "nav.allAgents": "All Agents",
    "nav.discoveredAgents": "Discovered Agents",
    "nav.settings": "Settings",

    // Master Skill Library
    "skillLibrary.title": "Master Skill Repository",
    "skillLibrary.subtitle": "Canonical storage in ~/.asm/skills & Agent link distribution matrix",
    "skillLibrary.searchPlaceholder": "Search master skills...",
    "skillLibrary.filterAll": "All",
    "skillLibrary.filterLinked": "Linked",
    "skillLibrary.filterUnlinked": "Unlinked",
    "skillLibrary.copyPath": "Copy Path",
    "skillLibrary.copied": "Copied!",
    "skillLibrary.noDescription": "(No description)",
    "skillLibrary.agentMatrixTitle": "Agent Link Distribution Matrix",
    "skillLibrary.linked": "Linked",
    "skillLibrary.unlinked": "Unlinked",
    "skillLibrary.emptyHint": "No master skills found in ~/.asm/skills.",
    "skillLibrary.emptySearch": "No master skills match your filter.",
    "skillLibrary.refresh": "Refresh",

    // Settings
    "settings.title": "Settings",
    "settings.subtitle": "Manage system preferences and agent skill path configurations",
    "settings.appearance.title": "Appearance",
    "settings.appearance.desc": "Select your preferred color theme for the interface",
    "settings.theme.light": "Light Mode",
    "settings.theme.lightDesc": "Bright, clean visual appearance for day time",
    "settings.theme.dark": "Dark Mode",
    "settings.theme.darkDesc": "Sleek dark theme, easy on the eyes in low light",
    "settings.theme.system": "System Preference",
    "settings.theme.systemDesc": "Automatically switch theme based on OS settings",
    "settings.active": "✓ Active",
    "settings.lang.title": "Language",
    "settings.lang.desc": "Select your preferred interface language (Chinese / English)",
    "settings.lang.zh": "简体中文",
    "settings.lang.zhDesc": "Simplified Chinese (Default)",
    "settings.lang.en": "English",
    "settings.lang.enDesc": "English Interface",
    "settings.paths.title": "Agent Skills Directory Configurations",
    "settings.paths.desc": "Configure custom skills directory paths for each Agent to override auto-detection",
    "settings.paths.resetAll": "Reset All Paths",
    "settings.paths.default": "Default",
    "settings.paths.overridden": "Overridden",
    "settings.paths.placeholder": "Enter custom path",
    "settings.paths.save": "Save",
    "settings.paths.reset": "Reset",
    // Skill Card
    "skillCard.upload": "Import to Master",
    "skillCard.managed": "✓ In Master Repo",
    "skillCard.uploading": "Importing...",

    // Dashboard
    "dashboard.title": "Dashboard",
    "dashboard.subtitle": "Agent skill ops overview & central matrix monitor",
    "dashboard.metricMasterSkills": "Master Skills",
    "dashboard.metricActiveAgents": "Active Agents",
    "dashboard.metricSymlinkCoverage": "Symlink Coverage",
    "dashboard.metricSyncStatus": "Sync Status",
    "dashboard.syncActive": "Auto-Sync Active",
    "dashboard.lastRefreshed": "Last updated",
    "dashboard.quickLibrary": "Master Library",
    "dashboard.quickAgents": "Manage Agents",
    "dashboard.agentMonitorTitle": "Agent Skill Monitor & Distribution Matrix",
    "dashboard.skillsUnit": "skills",
    "dashboard.managedRatio": "Managed",

    // Agent Status
    "agentStatus.detected": "Detected",
    "agentStatus.partial": "Partial",
    "agentStatus.notDetected": "Not detected",

    // Agents Directory Page
    "agents.title": "All Agents",
    "agents.subtitle": "Skill workspaces discovered on this machine.",
    "agents.detectedCount": "{count} detected",
    "agents.emptyTitle": "No agents discovered",
    "agents.emptyDesc": "Install an agent or check skill directory configurations.",

    // Agent Detail Page
    "agentDetail.installedSkills": "Installed Skills",
    "agentDetail.noDescription": "(No description provided)",
    "agentDetail.emptySkills": "No installed skills.",
    "agentDetail.fileCount": "{count} files",
  },
} as const;

export type TranslationKey = keyof typeof dict.zh;

export function t(key: TranslationKey, lang: Language): string {
  return dict[lang]?.[key] ?? dict.zh[key] ?? key;
}
