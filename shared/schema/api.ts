import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { ProxyRequestParamsSchema, ProxyActionSchema, LogQueryParamsSchema, IdempotencyHeaderSchema } from "./proxy.js";
import { ProblemDetailsSchema } from "./error.js";

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

registry.registerPath({
  method: 'post',
  path: '/api/docker-proxy',
  summary: 'Proxy Docker commands to a host',
  tags: ['Docker'],
  security: [{ bearerAuth: [] }],
  request: {
    headers: IdempotencyHeaderSchema,
    body: {
      content: {
        'application/json': {
          schema: ProxyRequestParamsSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Successful proxy response',
      content: {
        'application/json': {
          schema: {
            type: 'object'
          }
        }
      }
    },
    400: {
      description: 'Bad request or missing required fields',
      content: {
        'application/problem+json': {
          schema: ProblemDetailsSchema
        }
      }
    },
    403: {
      description: 'Access denied',
      content: {
        'application/problem+json': {
          schema: ProblemDetailsSchema
        }
      }
    },
    404: {
      description: 'Resource not found',
      content: {
        'application/problem+json': {
          schema: ProblemDetailsSchema
        }
      }
    },
    500: {
      description: 'Internal Server Error',
      content: {
        'application/problem+json': {
          schema: ProblemDetailsSchema
        }
      }
    },
    502: {
      description: 'Proxy downstream error',
      content: {
        'application/problem+json': {
          schema: ProblemDetailsSchema
        }
      }
    }
  }
});

export function generateOpenAPI() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Docker Watchtower Dashboard APIs',
      description: 'Proxy and control endpoints for remote Docker management',
    },
    servers: [{ url: 'https://docker.watchtower.dash.local' }]
  });
}
