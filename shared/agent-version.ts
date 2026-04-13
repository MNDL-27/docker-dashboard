import { CURRENT_WATCHTOWER_AGENT_RELEASE } from "./watchtower-agent-release.ts";

export {
  CURRENT_WATCHTOWER_AGENT_RELEASE,
  buildWatchtowerAgentAssetUrl,
  buildWatchtowerAgentInstallCommand,
  buildWatchtowerAgentReleaseResponse,
  buildWatchtowerAgentVerifyCommand,
  isAgentVersionOutdated,
} from "./watchtower-agent-release.ts";

export const CURRENT_WATCHTOWER_AGENT_VERSION = CURRENT_WATCHTOWER_AGENT_RELEASE.version;
