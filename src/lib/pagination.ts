// ---------------------------------------------------------------------------
// Pagination Utilities
// ---------------------------------------------------------------------------
// Two patterns per claude-rules.md Section 4 -> API Design -> Pagination:
//   - Offset-based: stable/low-write tables (members, teams, incidents, resources)
//   - Cursor-based: high-write/append-only tables (incident_log, audit_log, notifications)
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Offset-based pagination
// ---------------------------------------------------------------------------

export interface OffsetMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Parse offset pagination params from URL search params.
 *
 * @param searchParams - URLSearchParams from the request URL
 * @param defaults     - Optional overrides (e.g. `{ pageSize: 50 }` for incident_log)
 */
export function parseOffsetParams(
  searchParams: URLSearchParams,
  defaults?: { pageSize?: number },
): { page: number; pageSize: number } {
  const defaultSize = defaults?.pageSize ?? DEFAULT_PAGE_SIZE;

  const rawPage = Number(searchParams.get('page'));
  const rawSize = Number(searchParams.get('pageSize'));

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const pageSize =
    Number.isFinite(rawSize) && rawSize >= 1
      ? Math.min(Math.floor(rawSize), MAX_PAGE_SIZE)
      : defaultSize;

  return { page, pageSize };
}

/**
 * Build the meta object for an offset-paginated response.
 */
export function buildOffsetMeta(
  page: number,
  pageSize: number,
  totalCount: number,
): OffsetMeta {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    hasMore: page < totalPages,
  };
}

// ---------------------------------------------------------------------------
// Cursor-based pagination
// ---------------------------------------------------------------------------

export interface CursorMeta {
  cursor: string | null;
  hasMore: boolean;
}

/**
 * Parse cursor pagination params from URL search params.
 *
 * @param searchParams - URLSearchParams from the request URL
 * @param defaults     - Optional overrides (e.g. `{ limit: 50 }` for incident_log)
 */
export function parseCursorParams(
  searchParams: URLSearchParams,
  defaults?: { limit?: number },
): { cursor: string | null; limit: number } {
  const defaultLimit = defaults?.limit ?? DEFAULT_PAGE_SIZE;

  const rawCursor = searchParams.get('cursor');
  const rawLimit = Number(searchParams.get('limit'));

  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), MAX_PAGE_SIZE)
      : defaultLimit;

  return { cursor: rawCursor || null, limit };
}

/**
 * Decode a cursor string into its `created_at` and `id` components.
 * Returns `null` if the cursor is invalid.
 */
export function decodeCursor(
  cursor: string,
): { createdAt: string; id: string } | null {
  try {
    const decoded = atob(cursor);
    const separatorIndex = decoded.indexOf('|');
    if (separatorIndex === -1) return null;

    const createdAt = decoded.slice(0, separatorIndex);
    const id = decoded.slice(separatorIndex + 1);
    if (!createdAt || !id) return null;

    return { createdAt, id };
  } catch {
    return null;
  }
}

/**
 * Encode a cursor from an item's `created_at` and `id`.
 */
export function encodeCursor(createdAt: string, id: string): string {
  return btoa(`${createdAt}|${id}`);
}

/**
 * Build the meta object for a cursor-paginated response.
 *
 * Pass the items returned from the query (which should fetch `limit + 1` rows
 * to detect hasMore). If `items.length > limit`, there are more pages.
 *
 * The cursor is built from the **last item that will be returned to the client**
 * (i.e. `items[limit - 1]`), not the extra peek item.
 */
export function buildCursorMeta(
  items: Array<{ created_at: string; id: string }>,
  limit: number,
): CursorMeta {
  const hasMore = items.length > limit;
  if (items.length === 0) {
    return { cursor: null, hasMore: false };
  }

  // The last item the client will actually see
  const lastItem = items[Math.min(items.length, limit) - 1];
  return {
    cursor: encodeCursor(lastItem.created_at, lastItem.id),
    hasMore,
  };
}
