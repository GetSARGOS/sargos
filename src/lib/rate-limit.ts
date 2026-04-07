import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// ─── Rate Limiting Utility ──────────────────────────────────────────────────
// Uses Upstash Redis for serverless-compatible rate limiting.
// Gracefully degrades when Upstash credentials are missing (local dev).
// See claude-rules.md Section 17 for the full strategy.

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

const PASS_THROUGH: RateLimitResult = {
  success: true,
  limit: 0,
  remaining: 0,
  reset: 0,
}

function isUpstashConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  )
}

function createRedis(): Redis | null {
  if (!isUpstashConfigured()) {
    return null
  }
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })
}

// ─── Singleton State ────────────────────────────────────────────────────────
// Lazy-initialized — avoids crashing at import time when env vars are missing.
// All singletons live in one object so _resetForTesting can wipe everything.

const singletons: {
  redis: Redis | null | undefined
  public: Ratelimit | null | undefined
  authenticated: Ratelimit | null | undefined
  expensive: Ratelimit | null | undefined
  forgotPassword: Ratelimit | null | undefined
} = { redis: undefined, public: undefined, authenticated: undefined, expensive: undefined, forgotPassword: undefined }

function getRedis(): Redis | null {
  if (singletons.redis === undefined) {
    singletons.redis = isUpstashConfigured()
      ? new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        })
      : null
    if (!singletons.redis) {
      console.warn(
        '[rate-limit] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — rate limiting disabled',
      )
    }
  }
  return singletons.redis
}

// ─── Limiter Factories ──────────────────────────────────────────────────────

function createLimiter(
  prefix: string,
  tokens: number,
  window: `${number} ${'s' | 'm' | 'h' | 'd'}`,
): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    prefix: `ratelimit:${prefix}`,
    analytics: false,
  })
}

function getPublicLimiter(): Ratelimit | null {
  if (singletons.public === undefined) {
    singletons.public = createLimiter('public', 10, '1 m')
  }
  return singletons.public
}

function getAuthenticatedLimiter(): Ratelimit | null {
  if (singletons.authenticated === undefined) {
    singletons.authenticated = createLimiter('authenticated', 60, '1 m')
  }
  return singletons.authenticated
}

function getExpensiveLimiter(): Ratelimit | null {
  if (singletons.expensive === undefined) {
    singletons.expensive = createLimiter('expensive', 20, '1 m')
  }
  return singletons.expensive
}

function getForgotPasswordLimiter(): Ratelimit | null {
  if (singletons.forgotPassword === undefined) {
    singletons.forgotPassword = createLimiter('forgot-password', 3, '1 h')
  }
  return singletons.forgotPassword
}

// ─── Rate Limit Check Functions ─────────────────────────────────────────────

/**
 * Check rate limit for public endpoints (per IP address).
 * 10 requests per minute.
 */
export async function checkPublicRateLimit(
  ip: string,
): Promise<RateLimitResult> {
  const limiter = getPublicLimiter()
  if (!limiter) return PASS_THROUGH
  const result = await limiter.limit(ip)
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

/**
 * Check rate limit for authenticated endpoints (per user ID).
 * 60 requests per minute.
 */
export async function checkAuthenticatedRateLimit(
  userId: string,
): Promise<RateLimitResult> {
  const limiter = getAuthenticatedLimiter()
  if (!limiter) return PASS_THROUGH
  const result = await limiter.limit(userId)
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

/**
 * Check rate limit for expensive operations (per organization ID).
 * 20 requests per minute.
 */
export async function checkExpensiveRateLimit(
  organizationId: string,
): Promise<RateLimitResult> {
  const limiter = getExpensiveLimiter()
  if (!limiter) return PASS_THROUGH
  const result = await limiter.limit(organizationId)
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

/**
 * Check rate limit for forgot-password requests (per email address).
 * 3 requests per hour.
 */
export async function checkForgotPasswordRateLimit(
  email: string,
): Promise<RateLimitResult> {
  const limiter = getForgotPasswordLimiter()
  if (!limiter) return PASS_THROUGH
  const result = await limiter.limit(email.toLowerCase())
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

/**
 * Build a 429 Too Many Requests response with standard shape and Retry-After header.
 */
export function rateLimitExceededResponse(reset: number): NextResponse {
  const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000)
  const retryAfter = Math.max(retryAfterSeconds, 1)
  return NextResponse.json(
    {
      data: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Try again in ${retryAfter} seconds.`,
      },
      meta: { retryAfter },
    },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  )
}

/**
 * Extract the client IP address from a Next.js request.
 * Uses x-forwarded-for (set by Vercel/reverse proxy), falls back to x-real-ip,
 * then to '127.0.0.1' for local dev.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') ?? '127.0.0.1'
}

// ─── Test Helpers ───────────────────────────────────────────────────────────
// Exported for unit tests to reset singleton state between test runs.

export function _resetForTesting(): void {
  singletons.redis = undefined
  singletons.public = undefined
  singletons.authenticated = undefined
  singletons.expensive = undefined
  singletons.forgotPassword = undefined
}
