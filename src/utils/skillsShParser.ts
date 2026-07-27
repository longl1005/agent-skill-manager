export function parseSkillsShInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const urlObj = new URL(trimmed);
      if (urlObj.hostname === "skills.sh" || urlObj.hostname === "www.skills.sh") {
        const parts = urlObj.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          return `https://github.com/${parts[0]}/${parts[1]}`;
        }
      }
    } catch {
      // Invalid URL fallback
    }
    return trimmed;
  }

  const ownerRepoMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
  if (ownerRepoMatch) {
    return `https://github.com/${ownerRepoMatch[1]}/${ownerRepoMatch[2]}`;
  }

  return trimmed;
}
