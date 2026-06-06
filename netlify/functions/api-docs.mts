import type { Config } from '@netlify/functions';
import { buildCorsHeaders } from './lib/security.mjs';
import { generateOpenAPI } from '../../shared/schema/api.js';


const buildHeaders = (req: Request) => buildCorsHeaders(req);
export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: buildHeaders(req),
    });
  }

  const spec = generateOpenAPI();

  const headers = {
    ...buildHeaders(req),
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600',
  };

  return new Response(JSON.stringify(spec), { headers });
};

export const config: Config = {
  path: '/api/api-docs',
};
