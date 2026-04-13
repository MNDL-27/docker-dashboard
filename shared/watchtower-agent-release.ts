export interface WatchtowerAgentRelease {
  version: string;
  tag: string;
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
  current_agent_version: string;
  upgrade_command: string;
  release_url: string;
  release_notes_url: string;
  checksum: string;
}

const WATCHTOWER_AGENT_GITHUB_OWNER = "MNDL-27";
const WATCHTOWER_AGENT_GITHUB_REPO = "docker-watchtower-dash";

export const CURRENT_WATCHTOWER_AGENT_RELEASE: WatchtowerAgentRelease = {
  version: "1.0.1",
  tag: "v1.0.1",
  releaseUrl: `https://github.com/${WATCHTOWER_AGENT_GITHUB_OWNER}/${WATCHTOWER_AGENT_GITHUB_REPO}/releases/tag/v1.0.1`,
  releaseNotesUrl: `https://github.com/${WATCHTOWER_AGENT_GITHUB_OWNER}/${WATCHTOWER_AGENT_GITHUB_REPO}/releases/tag/v1.0.1`,
  assetBaseUrl: `https://github.com/${WATCHTOWER_AGENT_GITHUB_OWNER}/${WATCHTOWER_AGENT_GITHUB_REPO}/releases/download/v1.0.1`,
  installerAssetName: "watchtower-agent-install.sh",
  runtimeAssetName: "watchtower-agent.sh",
  uninstallAssetName: "watchtower-agent-uninstall.sh",
  installerSha256: "31E75B953E258CF90F5DE12BBAC6F4B80C268CB05A9E09EE657CA887C2B6FC43",
  runtimeSha256: "F2F7B4F37E61E79EDD98BF1F9F5C540D0A252536049D830158356E7E19DAEB33",
  uninstallSha256: "449AFC5FF62742AF0FF15254827E82F120BDD17694C43500C08FAF9926D0985C",
};

export function buildWatchtowerAgentAssetUrl(
  assetName: string,
  release: WatchtowerAgentRelease = CURRENT_WATCHTOWER_AGENT_RELEASE,
) {
  return `${release.assetBaseUrl}/${assetName}`;
}

export function buildWatchtowerAgentInstallCommand(
  release: WatchtowerAgentRelease = CURRENT_WATCHTOWER_AGENT_RELEASE,
) {
  const installerUrl = buildWatchtowerAgentAssetUrl(release.installerAssetName, release);

  return `VERSION="${release.tag}"
INSTALLER_URL="${installerUrl}"
INSTALLER_SHA256="${release.installerSha256}"

curl -fsSL "$INSTALLER_URL" -o watchtower-agent-install.sh
echo "$INSTALLER_SHA256  watchtower-agent-install.sh" | sha256sum -c -
chmod +x watchtower-agent-install.sh
sudo ./watchtower-agent-install.sh --expected-version "${release.version}"`;
}

export function buildWatchtowerAgentVerifyCommand(agentApiKeyPlaceholder = "<agent-api-key>") {
  return `curl -i http://127.0.0.1:9876/agent/version
curl -i http://127.0.0.1:9876/metrics -H "X-Agent-Key: ${agentApiKeyPlaceholder}"`;
}

export function isAgentVersionOutdated(agentVersion: string | null | undefined): boolean {
  if (!agentVersion) {
    return true;
  }

  return agentVersion.trim() !== CURRENT_WATCHTOWER_AGENT_RELEASE.version;
}

export function buildWatchtowerAgentReleaseResponse(
  installedAgentVersion: string | null | undefined,
): WatchtowerAgentReleaseResponse {
  return {
    latest_agent_version: CURRENT_WATCHTOWER_AGENT_RELEASE.version,
    agent_update_available: isAgentVersionOutdated(installedAgentVersion),
    current_agent_version: CURRENT_WATCHTOWER_AGENT_RELEASE.version,
    upgrade_command: buildWatchtowerAgentInstallCommand(CURRENT_WATCHTOWER_AGENT_RELEASE),
    release_url: CURRENT_WATCHTOWER_AGENT_RELEASE.releaseUrl,
    release_notes_url: CURRENT_WATCHTOWER_AGENT_RELEASE.releaseNotesUrl,
    checksum: CURRENT_WATCHTOWER_AGENT_RELEASE.installerSha256,
  };
}
