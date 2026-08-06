import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const platformSuffixes = {
  "darwin-aarch64": "darwin-aarch64.app.tar.gz",
  "darwin-x86_64": "darwin-x86_64.app.tar.gz",
  "windows-x86_64": "windows-x86_64-setup.exe",
};

export function createReleaseManifest({ version, tag, repository, pubDate, assets }) {
  const baseUrl = `https://github.com/${repository}/releases/download/${tag}`;
  const platforms = Object.fromEntries(Object.keys(platformSuffixes).map((platform) => {
    const asset = assets[platform];
    if (!asset?.name || !asset.signature) {
      throw new Error(`Missing signed updater asset for ${platform}.`);
    }
    return [platform, { signature: asset.signature, url: `${baseUrl}/${asset.name}` }];
  }));

  return {
    version,
    notes: "See the release notes on GitHub.",
    pub_date: pubDate,
    platforms,
  };
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value) throw new Error("Expected --version, --tag, --repository, --asset-dir and --output arguments.");
    parsed[key.slice(2)] = value;
  }
  return parsed;
}

function main() {
  const { version, tag, repository, "asset-dir": assetDir, output } = parseArgs(process.argv.slice(2));
  const releaseVersion = version.replace(/^v/, "");
  const files = walk(resolve(assetDir));
  const assets = Object.fromEntries(Object.entries(platformSuffixes).map(([platform, suffix]) => {
    const updaterPath = files.find((path) => basename(path).endsWith(suffix));
    if (!updaterPath) throw new Error(`Could not find the updater artifact ending in ${suffix}.`);
    const signaturePath = `${updaterPath}.sig`;
    return [platform, { name: basename(updaterPath), signature: readFileSync(signaturePath, "utf8").trim() }];
  }));
  const manifest = createReleaseManifest({ version: releaseVersion, tag, repository, pubDate: new Date().toISOString(), assets });
  mkdirSync(resolve(output, ".."), { recursive: true });
  writeFileSync(resolve(output), `${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
