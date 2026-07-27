export interface SkillsShItem {
  id: string;
  name: string;
  ownerRepo: string;
  description: string;
  installsText: string;
  skillsShUrl: string;
  githubUrl: string;
}

export function parseSkillsShHtml(html: string): SkillsShItem[] {
  const items: SkillsShItem[] = [];

  // Match href="/owner/repo/skill-name" or href="/owner/repo" with h3, p, span inside card
  const hrefRegex =
    /href="\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?"[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<p[^>]*>([^<]+)<\/p>[\s\S]*?<span[^>]*>([0-9.]+[KKM]? installs|[0-9.]+[KKM]?)<\/span>/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const owner = match[1];
    const repo = match[2];
    const skillPathName = match[3] || match[4].trim();
    const name = match[4].trim();
    const ownerRepo = match[5].trim() || `${owner}/${repo}`;
    const installsStr = match[6].trim();

    items.push({
      id: `${ownerRepo}/${name}`,
      name,
      ownerRepo,
      description: `Official skill from ${ownerRepo} on skills.sh`,
      installsText: installsStr.startsWith("⚡") ? installsStr : `⚡ ${installsStr}`,
      skillsShUrl: `https://skills.sh/${owner}/${repo}/${skillPathName}`,
      githubUrl: `https://github.com/${owner}/${repo}`,
    });
  }

  // Fallback: If regex didn't catch, extract href="/..." links
  if (items.length === 0) {
    const simpleRegex = /href="\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)"/g;
    const seen = new Set<string>();
    while ((match = simpleRegex.exec(html)) !== null) {
      const owner = match[1];
      const repo = match[2];
      const name = match[3];
      const key = `${owner}/${repo}/${name}`;
      if (!seen.has(key) && !["topic", "agent", "official", "audits", "docs"].includes(owner)) {
        seen.add(key);
        items.push({
          id: key,
          name,
          ownerRepo: `${owner}/${repo}`,
          description: `Skill ${name} from ${owner}/${repo} indexed on skills.sh`,
          installsText: "⚡ Installed on skills.sh",
          skillsShUrl: `https://skills.sh/${owner}/${repo}/${name}`,
          githubUrl: `https://github.com/${owner}/${repo}`,
        });
      }
    }
  }

  return items;
}

export async function fetchSkillsShDirectory(query?: string): Promise<SkillsShItem[]> {
  try {
    const resp = await fetch("https://skills.sh");
    if (!resp.ok) return [];
    const html = await resp.text();
    const allItems = parseSkillsShHtml(html);

    if (!query || !query.trim()) {
      return allItems;
    }

    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.ownerRepo.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  } catch {
    return [];
  }
}
