import type { Config } from '@netlify/functions';
import { routeProxyRequest } from './lib/proxy/router';

export default async (req: Request) => {
  return routeProxyRequest(req);
};

export const config: Config = {
  path: '/api/docker-proxy',
};
