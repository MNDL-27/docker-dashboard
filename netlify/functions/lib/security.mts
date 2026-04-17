/**
 * Security utilities for CORS, rate limiting, and request logging
 */

// Trusted origins for CORS
export const TRUSTED_ORIGINS = new Set([
  'https://app.dockerdash.app',
  'https://dockerdash.app',
  'https://www.dockerdash.app',
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:8888',
]);

/**
 * Validate and return allowed origin for CORS
 * Returns null if origin is not trusted
 */
export function getAllowedOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;
  
  try {
    const origin = new URL(requestOrigin).origin;
    if (TRUSTED_ORIGINS.has(origin)) {
      return origin;
    }
  } catch {
    // Invalid URL format
    return null;
  }
  
  return null;
}

/**
 * Build secure CORS headers
 * Only allows trusted origins, never uses wildcard
 */
export function buildCorsHeaders(req: Request, allowCredentials = true): Record<string, string> {
  const requestOrigin = req.headers.get('origin');
  const allowedOrigin = getAllowedOrigin(requestOrigin);
  
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Content-Type': 'application/json',
  };
  
  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    if (allowCredentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  } else {
    // Don't set Access-Control-Allow-Origin for untrusted origins
    // This effectively blocks cross-origin requests from unknown sites
    console.warn(`[CORS] Blocked untrusted origin: ${requestOrigin}`);
  }
  
  headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Idempotency-Key, X-Idempotency-Key, X-Test-Bypass, X-Test-User-Id, X-Test-Org-Id, X-Test-Platform-Admin, X-Test-Email';
  headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
  
  return headers;
}

/**
 * Build CORS headers for preflight OPTIONS requests
 */
export function buildCorsPreflightHeaders(req: Request): Record<string, string> {
  return buildCorsHeaders(req, true);
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

/**
 * Default rate limit configurations
 */
export const RATE_LIMITS = {
  // Strict limits for auth endpoints
  AUTH: { windowMs: 15 * 60 * 1000, maxRequests: 10 },     // 10 requests per 15 minutes
  // Very strict for webhooks (should only come from provider)
  WEBHOOK: { windowMs: 60 * 1000, maxRequests: 30 },        // 30 requests per minute
  // Standard API limits
  API: { windowMs: 60 * 1000, maxRequests: 100 },           // 100 requests per minute
  // More permissive for proxy operations
  PROXY: { windowMs: 60 * 1000, maxRequests: 200 },         // 200 requests per minute
};

/**
 * In-memory rate limit store (for single-instance deployments)
 * For production with multiple instances, use Redis or similar
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up expired entries from rate limit store
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every minute
setInterval(cleanupRateLimitStore, 60 * 1000);

/**
 * Generate a rate limit key based on request
 */
export function getRateLimitKey(req: Request, endpoint: string): string {
  // Use IP address if available, otherwise fall back to other identifiers
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
          || req.headers.get('x-real-ip')
          || req.headers.get('cf-connecting-ip')
          || 'unknown';
  return `${endpoint}:${ip}`;
}

/**
 * Check and update rate limit
 * Returns { allowed: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number; retryAfter?: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(key);
  
  if (!existing || existing.resetAt < now) {
    // New window
    const resetAt = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }
  
  if (existing.count >= config.maxRequests) {
    // Rate limited
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  
  // Increment counter
  existing.count++;
  rateLimitStore.set(key, existing);
  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Create rate limit headers for response
 */
export function buildRateLimitHeaders(
  remaining: number,
  resetAt: number,
  limit: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  };
}

/**
 * Apply rate limiting to a request
 * Returns response if rate limited, null if OK to proceed
 */
export function applyRateLimit(
  req: Request,
  endpoint: string,
  config: RateLimitConfig
): Response | null {
  const key = getRateLimitKey(req, endpoint);
  const result = checkRateLimit(key, config);
  
  if (!result.allowed) {
    console.warn(`[RateLimit] Exceeded limit for ${endpoint}: ${key}`);
    const headers = {
      ...buildRateLimitHeaders(result.remaining, result.resetAt, config.maxRequests),
      'Retry-After': String(result.retryAfter || 60),
      'Content-Type': 'application/json',
    };
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please try again after ${result.retryAfter} seconds.`,
        retry_after: result.retryAfter,
      }),
      { status: 429, headers }
    );
  }
  
  return null;
}

/**
 * Webhook replay attack protection
 */
export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
  nonce?: string;
}

/**
 * Store for processed webhook nonces (to prevent replay attacks)
 * Keys expire after the timestamp window
 */
const processedNonces = new Map<string, number>();

/**
 * Clean up expired nonces
 */
function cleanupNonces() {
  const now = Date.now();
  for (const [nonce, expiresAt] of processedNonces.entries()) {
    if (expiresAt < now) {
      processedNonces.delete(nonce);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupNonces, 5 * 60 * 1000);

/**
 * Verify webhook timestamp and nonce to prevent replay attacks
 * @param timestampHeader - Unix timestamp from webhook header
 * @param nonceHeader - Unique nonce from webhook header
 * @param maxAge - Maximum allowed age in seconds (default: 5 minutes)
 */
export function verifyWebhookTimestamp(
  timestampHeader: string | null,
  nonceHeader: string | null,
  maxAge = 300
): WebhookVerificationResult {
  if (!timestampHeader) {
    return { valid: false, error: 'Missing timestamp header' };
  }
  
  const timestamp = parseInt(timestampHeader, 10);
  if (Number.isNaN(timestamp)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }
  
  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;
  
  if (age > maxAge) {
    console.warn(`[Webhook] Replay attack detected: timestamp too old (${age}s)`);
    return { valid: false, error: 'Timestamp too old' };
  }
  
  if (age < -60) {
    // Allow some clock skew but reject future timestamps
    console.warn(`[Webhook] Invalid timestamp: appears to be in the future`);
    return { valid: false, error: 'Timestamp in future' };
  }
  
  // Check nonce if provided
  if (nonceHeader) {
    if (processedNonces.has(nonceHeader)) {
      console.warn(`[Webhook] Replay attack detected: duplicate nonce`);
      return { valid: false, error: 'Duplicate nonce' };
    }
    
    // Store nonce with expiration
    const expiresAt = Date.now() + (maxAge * 1000);
    processedNonces.set(nonceHeader, expiresAt);
  }
  
  return { valid: true, timestamp, nonce: nonceHeader || undefined };
}

/**
 * Log security-relevant events
 */
export interface SecurityLogEvent {
  type: 'auth_failure' | 'webhook_signature_failure' | 'rate_limit_exceeded' | 'cors_blocked' | 'replay_attack';
  endpoint: string;
  ip?: string;
  userId?: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log security event for monitoring
 */
export function logSecurityEvent(event: SecurityLogEvent): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'WARN',
    category: 'SECURITY',
    ...event,
  };
  
  // Always log security events
  console.warn('[SECURITY]', JSON.stringify(logEntry));
  
  // In production, you might want to send these to a SIEM or monitoring service
  // Example: sendToMonitoringService(logEntry);
}

/**
 * Get client IP from request headers
 */
export function getClientIp(req: Request): string | undefined {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip')
      || req.headers.get('cf-connecting-ip')
      || undefined;
}
