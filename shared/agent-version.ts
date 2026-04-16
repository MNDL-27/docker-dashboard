import { CURRENT_WATCHTOWER_AGENT_RELEASE } from "./watchtower-agent-release.ts";

export {
  CURRENT_WATCHTOWER_AGENT_RELEASE,
  buildWatchtowerAgentAssetUrl,
  buildWatchtowerAgentPreflightCommand,
  buildWatchtowerAgentInstallCommand,
  buildWatchtowerAgentReleaseResponse,
  buildWatchtowerAgentRepairCommand,
  buildWatchtowerAgentUpgradeCommand,
  buildWatchtowerAgentVerifyCommand,
  getWatchtowerAgentUpdateStatus,
  getWatchtowerAgentUpdateStatusCopy,
  isAgentVersionOutdated,
  type WatchtowerAgentUpdateStatus,
} from "./watchtower-agent-release.ts";

export const CURRENT_WATCHTOWER_AGENT_VERSION = CURRENT_WATCHTOWER_AGENT_RELEASE.version;
