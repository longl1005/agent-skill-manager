export interface OnlineSkillResult {
  id: string;
  name: string;
  ownerRepo: string;
  description: string;
  stars: number;
  repoUrl: string;
  installsText: string;
}

export async function searchOnlineSkills(query: string): Promise<OnlineSkillResult[]> {
  const cleanQuery = query.trim();
  const searchParam = cleanQuery ? `${encodeURIComponent(cleanQuery)}+` : "";
  const url = `https://api.github.com/search/repositories?q=${searchParam}topic:agent-skills+sort:stars`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data.items)) return [];

    return data.items.map((item: any) => {
      const stars = item.stargazers_count ?? 0;
      let starsFormatted = `${stars}`;
      if (stars >= 1000000) {
        starsFormatted = `${(stars / 1000000).toFixed(1)}M`;
      } else if (stars >= 1000) {
        starsFormatted = `${(stars / 1000).toFixed(1)}K`;
      }

      return {
        id: String(item.id || item.full_name),
        name: item.name,
        ownerRepo: item.full_name,
        description: item.description || "(No description)",
        stars,
        repoUrl: item.html_url,
        installsText: `★ ${starsFormatted}`,
      };
    });
  } catch {
    return [];
  }
}
