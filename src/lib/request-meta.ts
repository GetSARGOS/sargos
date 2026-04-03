// Extracts request metadata (IP address, user agent) for audit log entries.
// IP and UA go to the audit_log only — never to Sentry (PII scrubbing rule).

export interface RequestMeta {
  ipAddress: string | null
  userAgent: string | null
}

export function getRequestMeta(request: Request): RequestMeta {
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? null

  const userAgent = request.headers.get('user-agent') ?? null

  return { ipAddress, userAgent }
}
