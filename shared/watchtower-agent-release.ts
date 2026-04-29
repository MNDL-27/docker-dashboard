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
const WATCHTOWER_AGENT_SOURCE_REF = "a788b98d70d3d8b9a342b32f28eef365e7ccde3d";
const WATCHTOWER_AGENT_APP_BASE_URL = "https://app.dockerdash.app";

export const CURRENT_WATCHTOWER_AGENT_RELEASE: WatchtowerAgentRelease = {
  version: "1.0.6",
  tag: "v1.0.6",
  sourceLabel: "Dockerdash hosted installer",
  published: false,
  releaseUrl: `${WATCHTOWER_AGENT_APP_BASE_URL}/watchtower-agent-install.sh?v=1.0.6`,
  releaseNotesUrl: `https://github.com/${WATCHTOWER_AGENT_GITHUB_OWNER}/${WATCHTOWER_AGENT_GITHUB_REPO}/commit/${WATCHTOWER_AGENT_SOURCE_REF}`,
  assetBaseUrl: WATCHTOWER_AGENT_APP_BASE_URL,
  installerAssetName: "watchtower-agent-install.sh",
  runtimeAssetName: "watchtower-agent.sh",
  uninstallAssetName: "watchtower-agent-uninstall.sh",
  installerSha256: "B955475C9699D9CFF433926E98C0197509C236820EB72AA740BA9C2F9AAA9F16",
  runtimeSha256: "9ED554803D2647FA9C34B931788B64BDA03546AF0A98AFFF048A45DDC47C111C",
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

  return `( set -euo pipefail
INSTALLER_URL="${installerUrl}"
EXPECTED_INSTALLER_SHA256="${release.installerSha256}"
TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

echo "Downloading Dockerdash installer..."
curl -fsSL "$INSTALLER_URL" -o "$TMP_FILE"

echo "Verifying installer..."
ACTUAL_INSTALLER_SHA256="$(sha256sum "$TMP_FILE" | awk '{print toupper($1)}')"
if [ "$ACTUAL_INSTALLER_SHA256" != "$EXPECTED_INSTALLER_SHA256" ]; then
  echo "ERROR: Installer verification failed." >&2
  echo "Expected SHA256: $EXPECTED_INSTALLER_SHA256" >&2
  echo "Actual SHA256:   $ACTUAL_INSTALLER_SHA256" >&2
  echo "Refresh Dockerdash, copy a fresh command, and try again." >&2
  exit 1
fi

chmod +x "$TMP_FILE"
if [ "$(id -u)" -eq 0 ]; then
  "$TMP_FILE" ${actionArgs}
else
  sudo "$TMP_FILE" ${actionArgs}
fi )`;
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
        description: `Agent is behind ${release.version}. Run sudo watchtower-agent-update on the host, or use the Update command below.`,
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
