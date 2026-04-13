import type { Config } from '@netlify/functions';
import { generateOpenAPI } from '../../shared/schema/api.js';

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  const spec = generateOpenAPI();

  return new Response(JSON.stringify(spec), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    }
  });
};

export const config: Config = {
  path: '/api/api-docs',
};
