import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const ProxyActionSchema = z.enum([
  "ping", "info", "version", "containers", 
  "container-inspect", "container-stats", "container-logs",
  "container-start", "container-stop", "container-restart",
  "host-metrics", "all-containers", "all-container-stats",
  "container-fs-list", "container-fs-read"
]).openapi("ProxyAction");

export const ProxyRequestParamsSchema = z.object({
  action: ProxyActionSchema,
  hostId: z.string().optional().openapi({ description: "Host ID to target" }),
  containerId: z.string().optional().openapi({ description: "Container ID to perform action on" }),
  params: z.record(z.any()).optional().openapi({ description: "Additional parameters depending on action" }),
}).openapi("ProxyRequestParams");

export const LogQueryParamsSchema = z.object({
  since: z.coerce.number().optional().openapi({ description: "Return logs since a UNIX timestamp" }),
  limit: z.coerce.number().optional().openapi({ description: "Max lines of logs to return" }),
}).openapi("LogQueryParams");

// Generic Idempotency Header
export const IdempotencyHeaderSchema = z.object({
  "x-idempotency-key": z.string().optional().openapi({ description: "Idempotency key for mutations" }),
}).openapi("IdempotencyHeader");
