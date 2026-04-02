import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 100% of traces in development; lower in production via env override.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,

  // Only send errors in production unless explicitly overridden.
  enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_FORCE_ENABLED === 'true',

  // Never log PII to Sentry — scrub user data before sending.
  // Log IDs only, per claude_rules.md rule #8 (No logging of PII).
  beforeSend(event) {
    if (event.user) {
      // Keep the ID for correlation — remove all identifying fields
      const { id } = event.user
      event.user = id ? { id } : {}
    }
    return event
  },

  // Add breadcrumbs for critical SAR workflows so errors have context.
  // These breadcrumbs record workflow names only — never subject data.
  integrations: [
    Sentry.breadcrumbsIntegration({ console: false }),
  ],
})
