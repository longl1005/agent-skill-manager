import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const artifactDetails = {
  "darwin-aarch64": {
    artifacts: [
      { extension: ".app.tar.gz", output: "darwin-aarch64.app.tar.gz", bundleDirectory: "macos", signed: true },
      { extension: ".dmg", output: "darwin-aarch64.dmg", bundleDirectory: "dmg", signed: false },
    ],
  },
  "darwin-x86_64": {
    artifacts: [
      { extension: ".app.tar.gz", output: "darwin-x86_64.app.tar.gz", bundleDirectory: "macos", signed: true },
      { extension: ".dmg", output: "darwin-x86_64.dmg", bundleDirectory: "dmg", signed: false },
    ],
  },
  "windows-x86_64": {
    artifacts: [
      { extension: ".exe", output: "windows-x86_64-setup.exe", bundleDirectory: "nsis", signed: true },
    ],
  },
};

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 2) parsed[args[index]?.replace(/^--/, "")] = args[index + 1];
  return parsed;
}

function main() {
  const { platform, version, "source-dir": sourceDir, "output-dir": outputDir = "release-assets" } = parseArgs(process.argv.slice(2));
  const details = artifactDetails[platform];
  if (!details || !version || !sourceDir) throw new Error("Usage: node scripts/prepare-release-asset.mjs --platform <platform> --version <version> --source-dir <dir> [--output-dir <dir>]");

  const files = walk(resolve(sourceDir));
  const destinationDirectory = resolve(outputDir);
  const releaseVersion = version.replace(/^v/, "");
  mkdirSync(destinationDirectory, { recursive: true });

  for (const details of artifactDetails[platform].artifacts) {
    const artifact = files.find((path) => path.replaceAll("\\", "/").includes(`${details.bundleDirectory}/`) && path.endsWith(details.extension));
    if (!artifact) throw new Error(`Could not find a ${details.extension} bundle for ${platform}.`);
    const destination = join(destinationDirectory, `Agent-Skill-Manager_${releaseVersion}_${details.output}`);
    cpSync(artifact, destination);
    if (details.signed) cpSync(`${artifact}.sig`, `${destination}.sig`);
    process.stdout.write(`Prepared ${basename(destination)}.\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
