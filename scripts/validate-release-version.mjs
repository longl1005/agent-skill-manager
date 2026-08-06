import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function assertReleaseVersion(tag, packageVersion, tauriVersion) {
  if (packageVersion !== tauriVersion) {
    throw new Error(`package.json (${packageVersion}) and tauri.conf.json (${tauriVersion}) versions must match.`);
  }

  if (!/^\d+\.\d+\.\d+$/.test(packageVersion)) {
    throw new Error(`Release version ${packageVersion} must be a stable semantic version.`);
  }

  if (tag !== `v${packageVersion}`) {
    throw new Error(`Release tag ${tag} must match v${packageVersion}.`);
  }
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

function main() {
  const tag = process.argv[2];
  if (!tag) throw new Error("Usage: node scripts/validate-release-version.mjs <tag>");

  const packageJson = readJson("../package.json");
  const tauriConfig = readJson("../src-tauri/tauri.conf.json");
  assertReleaseVersion(tag, packageJson.version, tauriConfig.version);
  process.stdout.write(`Validated stable release ${tag}.\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
