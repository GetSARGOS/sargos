// ---------------------------------------------------------------------------
// Centralized Error Code Registry
// ---------------------------------------------------------------------------
// Every API error response MUST use a code from this registry via errorResponse().
// Naming convention: DOMAIN_ACTION in SCREAMING_SNAKE_CASE.
// See claude-rules.md Section 4 -> API Design -> Error codes.
// ---------------------------------------------------------------------------

// -- Auth -------------------------------------------------------------------
export const AUTH_UNAUTHORIZED = { code: 'AUTH_UNAUTHORIZED', status: 401 } as const;
export const AUTH_SESSION_EXPIRED = { code: 'AUTH_SESSION_EXPIRED', status: 401 } as const;
export const AUTH_FORBIDDEN = { code: 'AUTH_FORBIDDEN', status: 403 } as const;
export const AUTH_NO_ORGANIZATION = { code: 'AUTH_NO_ORGANIZATION', status: 403 } as const;
export const AUTH_RESET_RATE_LIMITED = { code: 'AUTH_RESET_RATE_LIMITED', status: 429 } as const;
export const AUTH_RESET_FAILED = { code: 'AUTH_RESET_FAILED', status: 500 } as const;

// -- Organization -----------------------------------------------------------
export const ORG_SLUG_TAKEN = { code: 'ORG_SLUG_TAKEN', status: 409 } as const;
export const ORG_NOT_FOUND = { code: 'ORG_NOT_FOUND', status: 404 } as const;
export const ORG_MEMBER_NOT_FOUND = { code: 'ORG_MEMBER_NOT_FOUND', status: 404 } as const;

// -- Incident ---------------------------------------------------------------
export const INCIDENT_NOT_FOUND = { code: 'INCIDENT_NOT_FOUND', status: 404 } as const;
export const INCIDENT_CLOSED = { code: 'INCIDENT_CLOSED', status: 409 } as const;
export const INCIDENT_ALREADY_CLOSED = { code: 'INCIDENT_ALREADY_CLOSED', status: 409 } as const;
export const INCIDENT_NOT_ACTIVE = { code: 'INCIDENT_NOT_ACTIVE', status: 422 } as const;
export const INCIDENT_SUSPENDED = { code: 'INCIDENT_SUSPENDED', status: 409 } as const;
export const INCIDENT_INVALID_TRANSITION = { code: 'INCIDENT_INVALID_TRANSITION', status: 422 } as const;
export const LOG_ENTRY_FAILED = { code: 'LOG_ENTRY_FAILED', status: 500 } as const;

// -- Personnel --------------------------------------------------------------
export const PERSONNEL_ALREADY_CHECKED_IN = { code: 'PERSONNEL_ALREADY_CHECKED_IN', status: 409 } as const;
export const PERSONNEL_NOT_FOUND = { code: 'PERSONNEL_NOT_FOUND', status: 404 } as const;
export const PERSONNEL_NONE_ON_INCIDENT = { code: 'PERSONNEL_NONE_ON_INCIDENT', status: 422 } as const;

// -- Resources --------------------------------------------------------------
export const RESOURCE_NOT_FOUND = { code: 'RESOURCE_NOT_FOUND', status: 404 } as const;
export const RESOURCE_ALREADY_DEPLOYED = { code: 'RESOURCE_ALREADY_DEPLOYED', status: 409 } as const;
export const RESOURCE_ALREADY_RETURNED = { code: 'RESOURCE_ALREADY_RETURNED', status: 409 } as const;
export const INCIDENT_RESOURCE_NOT_FOUND = { code: 'INCIDENT_RESOURCE_NOT_FOUND', status: 404 } as const;

// -- QR Tokens --------------------------------------------------------------
export const QR_TOKEN_INVALID = { code: 'QR_TOKEN_INVALID', status: 404 } as const;
export const QR_TOKEN_INACTIVE = { code: 'QR_TOKEN_INACTIVE', status: 410 } as const;
export const QR_TOKEN_NOT_FOUND = { code: 'QR_TOKEN_NOT_FOUND', status: 404 } as const;

// -- Billing (Feature 8a) --------------------------------------------------
export const TIER_SEAT_LIMIT = { code: 'TIER_SEAT_LIMIT', status: 403 } as const;
export const TIER_INCIDENT_LIMIT = { code: 'TIER_INCIDENT_LIMIT', status: 403 } as const;
export const TIER_FEATURE_GATED = { code: 'TIER_FEATURE_GATED', status: 403 } as const;
export const SUBSCRIPTION_LAPSED = { code: 'SUBSCRIPTION_LAPSED', status: 403 } as const;

// -- Subjects ---------------------------------------------------------------
export const SUBJECT_NOT_FOUND = { code: 'SUBJECT_NOT_FOUND', status: 404 } as const;
export const SUBJECT_CREATE_FAILED = { code: 'SUBJECT_CREATE_FAILED', status: 500 } as const;
export const SUBJECT_UPDATE_FAILED = { code: 'SUBJECT_UPDATE_FAILED', status: 500 } as const;
export const SUBJECT_DELETE_FAILED = { code: 'SUBJECT_DELETE_FAILED', status: 500 } as const;

// -- Command Structure ------------------------------------------------------
export const ROLE_ALREADY_ASSIGNED = { code: 'ROLE_ALREADY_ASSIGNED', status: 409 } as const;
export const ROLE_ASSIGNMENT_FAILED = { code: 'ROLE_ASSIGNMENT_FAILED', status: 500 } as const;
export const HANDOFF_NOT_IC = { code: 'HANDOFF_NOT_IC', status: 403 } as const;
export const HANDOFF_FAILED = { code: 'HANDOFF_FAILED', status: 500 } as const;

// -- Operational Periods ----------------------------------------------------
export const PERIOD_START_FAILED = { code: 'PERIOD_START_FAILED', status: 500 } as const;
export const PERIOD_UPDATE_FAILED = { code: 'PERIOD_UPDATE_FAILED', status: 500 } as const;
export const PERIOD_NOT_FOUND = { code: 'PERIOD_NOT_FOUND', status: 404 } as const;

// -- Rate Limiting ----------------------------------------------------------
export const RATE_LIMIT_EXCEEDED = { code: 'RATE_LIMIT_EXCEEDED', status: 429 } as const;

// -- CSRF -------------------------------------------------------------------
export const CSRF_ORIGIN_MISMATCH = { code: 'CSRF_ORIGIN_MISMATCH', status: 403 } as const;

// -- Validation -------------------------------------------------------------
export const VALIDATION_FAILED = { code: 'VALIDATION_FAILED', status: 400 } as const;
export const VALIDATION_INVALID_JSON = { code: 'VALIDATION_INVALID_JSON', status: 400 } as const;

// -- Generic ----------------------------------------------------------------
export const INTERNAL_ERROR = { code: 'INTERNAL_ERROR', status: 500 } as const;
export const DB_ERROR = { code: 'DB_ERROR', status: 500 } as const;
export const FETCH_FAILED = { code: 'FETCH_FAILED', status: 500 } as const;

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

/** Shape of every error code entry in the registry. */
export type ErrorCode = {
  readonly code: string;
  readonly status: number;
};

/**
 * Build a standard JSON error Response from an ErrorCode entry.
 *
 * @example
 *   return errorResponse(AUTH_UNAUTHORIZED, 'Authentication required');
 *   return errorResponse(VALIDATION_FAILED, 'Invalid input', { issues });
 */
export function errorResponse(
  errorCode: ErrorCode,
  message: string,
  meta?: Record<string, unknown>,
): Response {
  return Response.json(
    {
      data: null,
      error: { code: errorCode.code, message },
      meta: meta ?? null,
    },
    { status: errorCode.status },
  );
}
