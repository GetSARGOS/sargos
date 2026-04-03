import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_FORCE_ENABLED === 'true',

  // Never log PII to Sentry — log IDs only (claude-rules.md rule #8).
  beforeSend(event) {
    if (event.user) {
      const { id } = event.user
      event.user = id ? { id } : {}
    }
    return event
  },
})
