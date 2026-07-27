import { SKILLS_SH_LEADERBOARD } from "./skillsShApi";

export interface GlobalSkillItem {
  id: string;
  name: string;
  ownerRepo: string;
  description: string;
  installsText: string;
  repoUrl: string;
  skillsShUrl?: string;
  isVerifiedSkillsSh?: boolean;
}

export interface GlobalSkillsSearchOptions {
  query?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "stars" | "updated";
}

export interface GlobalSkillsSearchResult {
  items: GlobalSkillItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function searchGlobalSkills(
  options: GlobalSkillsSearchOptions = {}
): Promise<GlobalSkillsSearchResult> {
  const { query = "", page = 1, pageSize = 20, sortBy = "stars" } = options;
  const q = query.trim().toLowerCase();

  // 1. Filter local/skills.sh directory items first
  const skillsShItems: GlobalSkillItem[] = SKILLS_SH_LEADERBOARD.map((item) => ({
    id: item.id,
    name: item.name,
    ownerRepo: item.ownerRepo,
    description: item.description,
    installsText: item.installsText,
    repoUrl: item.githubUrl,
    skillsShUrl: item.skillsShUrl,
    isVerifiedSkillsSh: true,
  })).filter(
    (item) =>
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.ownerRepo.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
  );

  // 2. Fetch live GitHub topic API items
  let gitHubItems: GlobalSkillItem[] = [];
  let gitHubTotal = 0;

  try {
    const sortParam = sortBy === "updated" ? "updated" : "stars";
    const queryParam = q ? `${encodeURIComponent(q)}+` : "";
    const url = `https://api.github.com/search/repositories?q=${queryParam}topic:agent-skills+sort:${sortParam}&page=${page}&per_page=${pageSize}`;

    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      gitHubTotal = data.total_count || 0;
      if (Array.isArray(data.items)) {
        gitHubItems = data.items.map((item: any) => {
          const stars = item.stargazers_count ?? 0;
          let starsFormatted = `${stars}`;
          if (stars >= 1000000) {
            starsFormatted = `${(stars / 1000000).toFixed(1)}M`;
          } else if (stars >= 1000) {
            starsFormatted = `${(stars / 1000).toFixed(1)}K`;
          }

          return {
            id: String(item.full_name || item.id),
            name: item.name,
            ownerRepo: item.full_name || item.name,
            description: item.description || `Open-source agent skill from ${item.full_name}`,
            installsText: `★ ${starsFormatted}`,
            repoUrl: item.html_url,
            isVerifiedSkillsSh: false,
          };
        });
      }
    }
  } catch {
    // Ignore fetch network errors
  }

  // 3. Deduplicate and merge items
  const seenIds = new Set<string>();
  const seenRepos = new Set<string>();
  const mergedItems: GlobalSkillItem[] = [];

  // Add skills.sh verified items first for page 1
  if (page === 1) {
    for (const item of skillsShItems) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        if (item.ownerRepo) seenRepos.add(item.ownerRepo.toLowerCase());
        if (item.repoUrl) seenRepos.add(item.repoUrl.toLowerCase());
        mergedItems.push(item);
      }
    }
  }

  for (const item of gitHubItems) {
    const isRepoSeen =
      (item.ownerRepo && seenRepos.has(item.ownerRepo.toLowerCase())) ||
      (item.repoUrl && seenRepos.has(item.repoUrl.toLowerCase()));

    if (!seenIds.has(item.id) && !isRepoSeen) {
      seenIds.add(item.id);
      if (item.ownerRepo) seenRepos.add(item.ownerRepo.toLowerCase());
      if (item.repoUrl) seenRepos.add(item.repoUrl.toLowerCase());
      mergedItems.push(item);
    }
  }

  const totalCount = Math.max(gitHubTotal, skillsShItems.length);

  return {
    items: mergedItems,
    totalCount,
    page,
    pageSize,
  };
}
