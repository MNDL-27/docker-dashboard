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
  install_command: string;
  advanced_manual_command: string;
  setup_summary: string;
  verify_summary: string;
  next_step_summary: string;
  mode_label: string;
}

export type WatchtowerAgentConnectionMode = "agent" | "cloudflare_tunnel";

export interface WatchtowerAgentEnrollmentCommandOptions {
  enrollmentToken: string;
  enrollUrl: string;
  connectionMode: WatchtowerAgentConnectionMode;
  bindAddress?: string;
  dockerSocketPath?: string;
  release?: WatchtowerAgentRelease;
}

export interface WatchtowerAgentInstallCommandOptions {
  agentApiKey: string;
  connectionMode: WatchtowerAgentConnectionMode;
  bindAddress?: string;
  dockerSocketPath?: string;
  release?: WatchtowerAgentRelease;
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
const WATCHTOWER_AGENT_SOURCE_REF = "29eff6b6b49e4283492a26c0ae473f92170e4655";
const WATCHTOWER_AGENT_APP_BASE_URL = "https://app.dockerdash.app";

export const CURRENT_WATCHTOWER_AGENT_RELEASE: WatchtowerAgentRelease = {
  version: "1.0.9",
  tag: "v1.0.9",
  sourceLabel: "Dockerdash hosted installer",
  published: false,
  releaseUrl: `${WATCHTOWER_AGENT_APP_BASE_URL}/watchtower-agent-install.sh?v=1.0.9`,
  releaseNotesUrl: `https://github.com/${WATCHTOWER_AGENT_GITHUB_OWNER}/${WATCHTOWER_AGENT_GITHUB_REPO}/commit/${WATCHTOWER_AGENT_SOURCE_REF}`,
  assetBaseUrl: WATCHTOWER_AGENT_APP_BASE_URL,
  installerAssetName: "watchtower-agent-install.sh",
  runtimeAssetName: "watchtower-agent.sh",
  uninstallAssetName: "watchtower-agent-uninstall.sh",
  installerSha256: "FA7CBD6867BF0B441FD007625A2795F2622EE683782DD39D693ADE1DF30EAF9D",
  runtimeSha256: "4980258400D00C177DD99349A1897B27E487C4436BF71404C5607C75F842736E",
  uninstallSha256: "449AFC5FF62742AF0FF15254827E82F120BDD17694C43500C08FAF9926D0985C",
};

function buildAtomicInstallerCommand({
  release,
  action,
  extraArgs = "",
}: {
  release: WatchtowerAgentRelease;
  action: "check" | "install";
  extraArgs?: string;
}) {
  const installerUrl = buildWatchtowerAgentAssetUrl(release.installerAssetName, release);
  const baseArgs = action === "check" ? `--check --expected-version "${release.version}"` : `--expected-version "${release.version}"`;
  const actionArgs = `${baseArgs}${extraArgs ? ` ${extraArgs.trim()}` : ""}`;

  return `curl -fsSL "${installerUrl}" | sudo bash -s -- ${actionArgs}`;
}

export function buildWatchtowerAgentPreflightCommand(
  _release?: WatchtowerAgentRelease,
) {
  return "sudo watchtower-agent-update --check";
}

export function buildWatchtowerAgentUpgradeCommand(
  _release?: WatchtowerAgentRelease,
) {
  return "sudo watchtower-agent-update";
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
  return buildAtomicInstallerCommand({ release, action: "install" });
}

export function getWatchtowerAgentRecommendedBindAddress(
  connectionMode: WatchtowerAgentConnectionMode,
) {
  return connectionMode === "cloudflare_tunnel" ? "0.0.0.0" : "0.0.0.0";
}

export function getWatchtowerAgentModeLabel(
  connectionMode: WatchtowerAgentConnectionMode,
) {
  return connectionMode === "cloudflare_tunnel" ? "Agent via Cloudflare Tunnel" : "Agent (Direct)";
}

function buildInstallerExtraArgs({
  connectionMode,
  bindAddress,
  dockerSocketPath,
}: {
  connectionMode: WatchtowerAgentConnectionMode;
  bindAddress?: string;
  dockerSocketPath?: string;
}) {
  const args: string[] = [`--connection-mode "${connectionMode}"`];

  if (bindAddress) {
    args.push(`--bind-address "${bindAddress}"`);
  }

  if (dockerSocketPath && dockerSocketPath !== "/var/run/docker.sock") {
    args.push(`--docker-socket "${dockerSocketPath}"`);
  }

  return args.join(" ");
}

export function buildWatchtowerAgentEnrollmentInstallCommand({
  enrollmentToken,
  enrollUrl,
  connectionMode,
  bindAddress = getWatchtowerAgentRecommendedBindAddress(connectionMode),
  dockerSocketPath = "/var/run/docker.sock",
  release = CURRENT_WATCHTOWER_AGENT_RELEASE,
}: WatchtowerAgentEnrollmentCommandOptions) {
  const extraArgs = [
    `--enrollment-token "${enrollmentToken}"`,
    `--enroll-url "${enrollUrl}"`,
    buildInstallerExtraArgs({ connectionMode, bindAddress, dockerSocketPath }),
  ].join(" ");

  return buildAtomicInstallerCommand({
    release,
    action: "install",
    extraArgs,
  });
}

export function buildWatchtowerAgentAdvancedInstallCommand({
  agentApiKey,
  connectionMode,
  bindAddress = getWatchtowerAgentRecommendedBindAddress(connectionMode),
  dockerSocketPath = "/var/run/docker.sock",
  release = CURRENT_WATCHTOWER_AGENT_RELEASE,
}: WatchtowerAgentInstallCommandOptions) {
  const extraArgs = [
    `--api-key "${agentApiKey}"`,
    buildInstallerExtraArgs({ connectionMode, bindAddress, dockerSocketPath }),
  ].join(" ");

  return buildAtomicInstallerCommand({
    release,
    action: "install",
    extraArgs,
  });
}

export function buildWatchtowerAgentVerifyCommand(agentApiKeyPlaceholder = "<agent-api-key>") {
  return `curl -i http://127.0.0.1:9876/agent/version
curl -i http://127.0.0.1:9876/metrics -H "X-Agent-Key: ${agentApiKeyPlaceholder}"`;
}

export function buildWatchtowerAgentLocalVerifyCommand() {
  return `sudo bash -lc 'set -euo pipefail
source /etc/watchtower-agent/watchtower-agent.env
curl -i "http://\${AGENT_BIND_ADDRESS}:\${AGENT_PORT}/agent/version"
curl -i "http://\${AGENT_BIND_ADDRESS}:\${AGENT_PORT}/metrics" -H "X-Agent-Key: \${AGENT_API_KEY}"'`;
}

export function buildWatchtowerAgentSetupSummary(connectionMode: WatchtowerAgentConnectionMode) {
  return connectionMode === "cloudflare_tunnel"
    ? "Install the agent locally, keep it on localhost, then route traffic through your Cloudflare Tunnel."
    : "Install the agent on the host, expose it behind HTTPS, then finish the connection test in Dockerdash.";
}

export function buildWatchtowerAgentVerifySummary(connectionMode: WatchtowerAgentConnectionMode) {
  return connectionMode === "cloudflare_tunnel"
    ? "Verify the local agent first, then confirm your tunnel hostname forwards to the same local service."
    : "Verify the local agent first, then confirm your public HTTPS endpoint reaches the same local service.";
}

export function buildWatchtowerAgentNextStepSummary(connectionMode: WatchtowerAgentConnectionMode) {
  return connectionMode === "cloudflare_tunnel"
    ? "After the local verify passes, return to Dockerdash and click Finish setup to test the tunnel URL."
    : "After the local verify passes, return to Dockerdash and click Finish setup to test the HTTPS agent URL.";
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
    dialogDescription: "Run the updater command directly on the host. The dashboard does not execute privileged commands remotely.",
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
      "Running the updater preserves the stored config in /etc/watchtower-agent/watchtower-agent.env. If the host still fails after Update, run Verify and inspect sudo journalctl -u watchtower-agent -n 50 before retrying Troubleshoot / Repair.",
  };
}

export function isAgentVersionOutdated(agentVersion: string | null | undefined): boolean {
  if (!agentVersion) {
    return false;
  }

  const agentParts = agentVersion.trim().replace(/^v/, '').split('.').map(Number);
  const currentParts = CURRENT_WATCHTOWER_AGENT_RELEASE.version.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(agentParts.length, currentParts.length); i++) {
    const a = agentParts[i] || 0;
    const c = currentParts[i] || 0;
    if (a < c) return true;
    if (a > c) return false;
  }

  return false;
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
    install_command: buildWatchtowerAgentInstallCommand(CURRENT_WATCHTOWER_AGENT_RELEASE),
    advanced_manual_command: buildWatchtowerAgentAdvancedInstallCommand({
      agentApiKey: "<agent-api-key>",
      connectionMode: "agent",
      release: CURRENT_WATCHTOWER_AGENT_RELEASE,
    }),
    setup_summary: buildWatchtowerAgentSetupSummary("agent"),
    verify_summary: buildWatchtowerAgentVerifySummary("agent"),
    next_step_summary: buildWatchtowerAgentNextStepSummary("agent"),
    mode_label: getWatchtowerAgentModeLabel("agent"),
  };
}


