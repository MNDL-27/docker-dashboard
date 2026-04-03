export const CURRENT_WATCHTOWER_AGENT_VERSION = "1.0.0";

export function isAgentVersionOutdated(agentVersion: string | null | undefined): boolean {
  if (!agentVersion) {
    return true;
  }

  return agentVersion.trim() !== CURRENT_WATCHTOWER_AGENT_VERSION;
}
