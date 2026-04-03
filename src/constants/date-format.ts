// ---------------------------------------------------------------------------
// Date Format Constants
// ---------------------------------------------------------------------------
// Project-wide display format: "03 Apr 2026 14:32 PST"
// See claude-rules.md Section 4 -> Timezone Convention.
// ---------------------------------------------------------------------------

/**
 * Shared Intl.DateTimeFormat options for the project-wide display format.
 * Example output: "03 Apr 2026 14:32 PST"
 */
export const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
  hour12: false,
};

/**
 * Format a date using the incident's timezone.
 * All incident-scoped timestamps use this function.
 */
export function formatIncidentTime(date: Date | string, timezone: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    ...DATE_FORMAT_OPTIONS,
    timeZone: timezone,
  }).format(d);
}

/**
 * Format a date using the user's browser timezone.
 * For non-incident-scoped timestamps (org settings, billing, audit log viewer).
 */
export function formatLocalTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', DATE_FORMAT_OPTIONS).format(d);
}
