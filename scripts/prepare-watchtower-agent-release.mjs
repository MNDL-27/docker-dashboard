import { createHash } from "node:crypto";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const publicDir = path.join(repoRoot, "public");
const releaseDir = path.join(repoRoot, ".release", "watchtower-agent");
const versionFile = path.join(repoRoot, "shared", "watchtower-agent-release.ts");

const versionSource = await readFile(versionFile, "utf8");
const versionMatch = versionSource.match(/version:\s*"([^"]+)"/);
const version = versionMatch?.[1];

if (!version) {
  throw new Error(`Could not determine release version from ${versionFile}`);
}

const tag = `v${version}`;
const outputDir = path.join(releaseDir, tag);
const assetNames = [
  "watchtower-agent-install.sh",
  "watchtower-agent.sh",
  "watchtower-agent-uninstall.sh",
];

await mkdir(outputDir, { recursive: true });

const checksumLines = [];

for (const assetName of assetNames) {
  const sourcePath = path.join(publicDir, assetName);
  const buffer = await readFile(sourcePath);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  checksumLines.push(`${sha256}  ${assetName}`);
  await copyFile(sourcePath, path.join(outputDir, assetName));
}

await writeFile(path.join(outputDir, "SHA256SUMS.txt"), `${checksumLines.join("\n")}\n`, "utf8");

console.log(`Prepared watchtower-agent release assets in ${outputDir}`);
console.log("Checksums:");
for (const line of checksumLines) {
  console.log(`  ${line}`);
}
console.log("");
console.log("Suggested GitHub CLI release command:");
console.log(
  `gh release create ${tag} "${path.join(outputDir, "watchtower-agent-install.sh")}" "${path.join(outputDir, "watchtower-agent.sh")}" "${path.join(outputDir, "watchtower-agent-uninstall.sh")}" "${path.join(outputDir, "SHA256SUMS.txt")}" --title "Watchtower Agent ${version}" --notes "Host agent release ${version}"`,
);
