#!/usr/bin/env node
// Generate a release manifest for the watchtower-agent artifacts.
//
// Usage:  node scripts/generate-watchtower-agent-manifest.mjs > public/watchtower-agent-manifest.json
//
// The manifest lists SHA-256 digests of the runtime script. The
// self-update helper (`watchtower-agent-update.sh`, installed by
// `watchtower-agent-install.sh`) downloads this manifest from
// app.dockerdash.app and verifies the downloaded runtime against the
// published digest before executing it.
//
// To make this end-to-end trustworthy, publish the manifest on a SECOND
// channel (e.g. GitHub release asset or a signed tag) so an attacker
// would need to compromise both the CDN and the second channel to ship
// a tampered update.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

const runtimePath = resolve(publicDir, "watchtower-agent.sh");
const runtimeData = readFileSync(runtimePath);
const runtimeEntry = {
  name: "watchtower-agent.sh",
  role: "runtime",
  size: runtimeData.length,
  sha256: sha256(runtimeData),
};

const manifest = {
  generated_at: new Date().toISOString(),
  artifacts: [runtimeEntry],
};

process.stdout.write(JSON.stringify(manifest, null, 2) + "\n");

