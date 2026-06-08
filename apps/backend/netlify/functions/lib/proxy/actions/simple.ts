import { sanitizeContainerId } from '../utils';

export interface SimpleActionConfig {
  dockerPath: string;
  method?: string;
  timeoutMs?: number;
}

export function resolveSimpleAction(
  action: string,
  containerId: string | undefined,
  createProblemResponse: (status: number, title: string) => Response,
): SimpleActionConfig | Response {
  switch (action) {
    case 'ping':
      return { dockerPath: '/_ping', timeoutMs: 3000 };
    case 'info':
      return { dockerPath: '/info', timeoutMs: 3000 };
    case 'version':
      return { dockerPath: '/version', timeoutMs: 3000 };
    case 'containers':
      return { dockerPath: '/containers/json?all=true', timeoutMs: 5000 };
    case 'container-inspect': {
      if (!containerId) return createProblemResponse(400, "containerId required");
      return { dockerPath: `/containers/${sanitizeContainerId(containerId)}/json`, timeoutMs: 5000 };
    }
    case 'container-stats': {
      if (!containerId) return createProblemResponse(400, "containerId required");
      return { dockerPath: `/containers/${sanitizeContainerId(containerId)}/stats?stream=false`, timeoutMs: 5000 };
    }
    default:
      return createProblemResponse(400, `Unknown action: ${action}`);
  }
}
