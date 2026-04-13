import { describe, expect, it } from "vitest";

import {
  CURRENT_WATCHTOWER_AGENT_RELEASE,
  buildWatchtowerAgentInstallCommand,
  buildWatchtowerAgentReleaseResponse,
} from "@/lib/agent-release";

describe("watchtower agent release helpers", () => {
  it("builds a pinned install command with a checksum and expected version", () => {
    const command = buildWatchtowerAgentInstallCommand();

    expect(command).toContain(CURRENT_WATCHTOWER_AGENT_RELEASE.assetBaseUrl);
    expect(command).toContain(CURRENT_WATCHTOWER_AGENT_RELEASE.installerSha256);
    expect(command).toContain(`--expected-version "${CURRENT_WATCHTOWER_AGENT_RELEASE.version}"`);
    expect(command).not.toContain("/main/");
  });

  it("builds release response metadata for outdated agents", () => {
    const response = buildWatchtowerAgentReleaseResponse("1.0.0");

    expect(response).toMatchObject({
      latest_agent_version: CURRENT_WATCHTOWER_AGENT_RELEASE.version,
      current_agent_version: CURRENT_WATCHTOWER_AGENT_RELEASE.version,
      agent_update_available: true,
      release_url: CURRENT_WATCHTOWER_AGENT_RELEASE.releaseUrl,
      checksum: CURRENT_WATCHTOWER_AGENT_RELEASE.installerSha256,
    });
    expect(response.upgrade_command).toContain(CURRENT_WATCHTOWER_AGENT_RELEASE.tag);
  });
});
