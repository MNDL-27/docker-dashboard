export interface WatchtowerAgentRelease {
  version: string;
  tag: string;
  sourceLabel: string;
  published: boolean;
  releaseUrl: string;
  releaseNotesUrl: string;
  assetBaseUrl: string;
  installerAssetName: string;
  runtimeAssetName: string;
  uninstallAssetName: string;
  installerSha256: string;
  runtimeSha256: string;
  uninstallSha256: string;
}

export interface WatchtowerAgentReleaseResponse {
  latest_agent_version: string;
  agent_update_available: boolean;
  agent_update_status: WatchtowerAgentUpdateStatus;
  current_agent_version: string;
  preflight_command: string;
  upgrade_command: string;
  verify_command: string;
  repair_command: string;
  source_label: string;
  published_release: boolean;
  release_url: string;
  release_notes_url: string;
  checksum: string;
}

export type WatchtowerAgentUpdateStatus =
  | "pending"
  | "update_required"
  | "verification_required"
  | "current";

export interface WatchtowerAgentUpdateCopy {
  dialogDescription: string;
  statusPending: string;
  statusCurrent: string;
  statusUpdateRequired: string;
  statusVerificationRequired: string;
  sourcePrefix: string;
  sourceNotice: string | null;
  preflightCommandLabel: string;
  upgradeCommandLabel: string;
  verifyCommandLabel: string;
  repairCommandLabel: string;
  pendingSummary: string;
  outdatedSummary: (installedVersion: string, latestVersion: string) => string;
  verificationSummary: string;
  supportInstructions: string;
}

const WATCHTOWER_AGENT_GITHUB_OWNER = "MNDL-27";
const WATCHTOWER_AGENT_GITHUB_REPO = "docker-watchtower-dash";
const WATCHTOWER_AGENT_SOURCE_REF = "8ff3fb6d3414933a22eb2fc7cc9d7aaa804caab8";
const WATCHTOWER_AGENT_APP_BASE_URL = "https://app.dockerdash.app";

export const CURRENT_WATCHTOWER_AGENT_RELEASE: WatchtowerAgentRelease = {
  version: "1.0.5",
  tag: "v1.0.5",
  sourceLabel: "Dockerdash hosted installer",
  published: false,
  releaseUrl: `${WATCHTOWER_AGENT_APP_BASE_URL}/watchtower-agent-install.sh?v=1.0.5`,
  releaseNotesUrl: `https://github.com/${WATCHTOWER_AGENT_GITHUB_OWNER}/${WATCHTOWER_AGENT_GITHUB_REPO}/commit/${WATCHTOWER_AGENT_SOURCE_REF}`,
  assetBaseUrl: WATCHTOWER_AGENT_APP_BASE_URL,
  installerAssetName: "watchtower-agent-install.sh",
  runtimeAssetName: "watchtower-agent.sh",
  uninstallAssetName: "watchtower-agent-uninstall.sh",
  installerSha256: "87DF77B73E0C57863A0705FBFE6E17E2D28FF7ED1E886C8CFAFDC9116E0219C0",
  runtimeSha256: "A5CBA0D97618FA0E440EA195337AEE6CC4E144DB1753606A10D0BB026DACE1FC",
  uninstallSha256: "449AFC5FF62742AF0FF15254827E82F120BDD17694C43500C08FAF9926D0985C",
};

function buildAtomicInstallerCommand({
  release,
  action,
}: {
  release: WatchtowerAgentRelease;
  action: "check" | "install";
}) {
  const installerUrl = buildWatchtowerAgentAssetUrl(release.installerAssetName, release);
  const actionArgs = action === "check" ? `--check --expected-version "${release.version}"` : `--expected-version "${release.version}"`;

  return `set -euo pipefail
INSTALLER_URL="${installerUrl}"
INSTALLER_SHA256="${release.installerSha256}"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

curl -fsSL "$INSTALLER_URL" -o "$TMP_FILE"
echo "$INSTALLER_SHA256  $TMP_FILE" | sha256sum -c -
chmod +x "$TMP_FILE"
sudo "$TMP_FILE" ${actionArgs}`;
}

export function buildWatchtowerAgentPreflightCommand(
  release: WatchtowerAgentRelease = CURRENT_WATCHTOWER_AGENT_RELEASE,
) {
  return buildAtomicInstallerCommand({ release, action: "check" });
}

export function buildWatchtowerAgentUpgradeCommand(
  release: WatchtowerAgentRelease = CURRENT_WATCHTOWER_AGENT_RELEASE,
) {
  return buildAtomicInstallerCommand({ release, action: "install" });
}

export function buildWatchtowerAgentAssetUrl(
  assetName: string,
  release: WatchtowerAgentRelease = CURRENT_WATCHTOWER_AGENT_RELEASE,
) {
  return `${release.assetBaseUrl}/${assetName}?v=${encodeURIComponent(release.version)}`;
}

export function buildWatchtowerAgentInstallCommand(
  release: WatchtowerAgentRelease = CURRENT_WATCHTOWER_AGENT_RELEASE,
) {
  return buildWatchtowerAgentUpgradeCommand(release);
}

export function buildWatchtowerAgentVerifyCommand(agentApiKeyPlaceholder = "<agent-api-key>") {
  return `curl -i http://127.0.0.1:9876/agent/version
curl -i http://127.0.0.1:9876/metrics -H "X-Agent-Key: ${agentApiKeyPlaceholder}"`;
}

export function buildWatchtowerAgentRepairCommand(
  agentApiKeyPlaceholder = "<agent-api-key>",
  release: WatchtowerAgentRelease = CURRENT_WATCHTOWER_AGENT_RELEASE,
) {
  return `${buildWatchtowerAgentUpgradeCommand(release)}

${buildWatchtowerAgentVerifyCommand(agentApiKeyPlaceholder)}`;
}

export function getWatchtowerAgentUpdateStatus(options: {
  installedVersion?: string | null;
  capabilityGap?: boolean;
}): WatchtowerAgentUpdateStatus {
  const { installedVersion, capabilityGap = false } = options;
  if (!installedVersion) {
    return "pending";
  }
  if (isAgentVersionOutdated(installedVersion)) {
    return "update_required";
  }
  if (capabilityGap) {
    return "verification_required";
  }
  return "current";
}

export function getWatchtowerAgentUpdateStatusCopy(
  status: WatchtowerAgentUpdateStatus,
  release: WatchtowerAgentRelease = CURRENT_WATCHTOWER_AGENT_RELEASE,
) {
  switch (status) {
    case "pending":
      return {
        title: "Version pending",
        description: `The host is reachable, but it has not reported agent version ${release.version} yet. Run Preflight, then Update.`,
      };
    case "update_required":
      return {
        title: "Update required",
        description: `Agent is behind ${release.version}. Run Preflight, Update, then Verify.`,
      };
    case "verification_required":
      return {
        title: "Verification required",
        description: "The current agent version is installed, but uptime and per-disk metrics still need to be confirmed. Run Verify or Troubleshoot / Repair.",
      };
    case "current":
    default:
      return {
        title: "Current",
        description: `Agent ${release.version} is current and the capability checks look healthy.`,
      };
  }
}

export function buildWatchtowerAgentUpdateCopy(
  release: WatchtowerAgentRelease = CURRENT_WATCHTOWER_AGENT_RELEASE,
): WatchtowerAgentUpdateCopy {
  return {
    dialogDescription: "Use the hosted installer command for this host. The dashboard does not run privileged commands remotely.",
    statusPending: "Version pending",
    statusCurrent: "Current",
    statusUpdateRequired: "Update required",
    statusVerificationRequired: "Verification required",
    sourcePrefix: "Source:",
    sourceNotice: release.published
      ? null
      : "This command currently uses the Dockerdash-hosted installer asset instead of a published GitHub release bundle.",
    preflightCommandLabel: "Preflight",
    upgradeCommandLabel: "Update",
    verifyCommandLabel: "Verify",
    repairCommandLabel: "Troubleshoot / Repair",
    verificationSummary: "Current version is installed, but the host still needs capability verification for uptime and disk details.",
    outdatedSummary: (installedVersion: string, latestVersion: string) =>
      `Agent ${installedVersion} is behind ${latestVersion}.`,
    pendingSummary: "This host has not reported an installed agent version yet.",
    supportInstructions:
      "Re-running the installer preserves the stored config in /etc/watchtower-agent/watchtower-agent.env. If the host still fails after Update, run Verify and inspect sudo journalctl -u watchtower-agent -n 50 before retrying Troubleshoot / Repair.",
  };
}

export function isAgentVersionOutdated(agentVersion: string | null | undefined): boolean {
  if (!agentVersion) {
    return false;
  }

  return agentVersion.trim() !== CURRENT_WATCHTOWER_AGENT_RELEASE.version;
}

export function buildWatchtowerAgentReleaseResponse(
  installedAgentVersion: string | null | undefined,
  capabilityGap = false,
): WatchtowerAgentReleaseResponse {
  const agentUpdateStatus = getWatchtowerAgentUpdateStatus({
    installedVersion: installedAgentVersion,
    capabilityGap,
  });
  return {
    latest_agent_version: CURRENT_WATCHTOWER_AGENT_RELEASE.version,
    agent_update_available: agentUpdateStatus === "update_required",
    agent_update_status: agentUpdateStatus,
    current_agent_version: CURRENT_WATCHTOWER_AGENT_RELEASE.version,
    preflight_command: buildWatchtowerAgentPreflightCommand(CURRENT_WATCHTOWER_AGENT_RELEASE),
    upgrade_command: buildWatchtowerAgentUpgradeCommand(CURRENT_WATCHTOWER_AGENT_RELEASE),
    verify_command: buildWatchtowerAgentVerifyCommand(),
    repair_command: buildWatchtowerAgentRepairCommand("<agent-api-key>", CURRENT_WATCHTOWER_AGENT_RELEASE),
    source_label: CURRENT_WATCHTOWER_AGENT_RELEASE.sourceLabel,
    published_release: CURRENT_WATCHTOWER_AGENT_RELEASE.published,
    release_url: CURRENT_WATCHTOWER_AGENT_RELEASE.releaseUrl,
    release_notes_url: CURRENT_WATCHTOWER_AGENT_RELEASE.releaseNotesUrl,
    checksum: CURRENT_WATCHTOWER_AGENT_RELEASE.installerSha256,
  };
}
