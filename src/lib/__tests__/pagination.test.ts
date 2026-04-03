import { describe, it, expect } from 'vitest';
import {
  parseOffsetParams,
  buildOffsetMeta,
  parseCursorParams,
  buildCursorMeta,
  encodeCursor,
  decodeCursor,
} from '../pagination';

// ---------------------------------------------------------------------------
// parseOffsetParams
// ---------------------------------------------------------------------------
describe('parseOffsetParams', () => {
  it('returns defaults when no params provided', () => {
    const params = new URLSearchParams();
    expect(parseOffsetParams(params)).toEqual({ page: 1, pageSize: 25 });
  });

  it('parses custom page and pageSize', () => {
    const params = new URLSearchParams({ page: '3', pageSize: '10' });
    expect(parseOffsetParams(params)).toEqual({ page: 3, pageSize: 10 });
  });

  it('clamps pageSize to max 100', () => {
    const params = new URLSearchParams({ page: '1', pageSize: '500' });
    expect(parseOffsetParams(params)).toEqual({ page: 1, pageSize: 100 });
  });

  it('falls back to defaults for non-numeric values', () => {
    const params = new URLSearchParams({ page: 'abc', pageSize: 'xyz' });
    expect(parseOffsetParams(params)).toEqual({ page: 1, pageSize: 25 });
  });

  it('falls back to defaults for zero or negative values', () => {
    const params = new URLSearchParams({ page: '0', pageSize: '-5' });
    expect(parseOffsetParams(params)).toEqual({ page: 1, pageSize: 25 });
  });

  it('accepts a custom default pageSize', () => {
    const params = new URLSearchParams();
    expect(parseOffsetParams(params, { pageSize: 50 })).toEqual({
      page: 1,
      pageSize: 50,
    });
  });

  it('floors floating point values', () => {
    const params = new URLSearchParams({ page: '2.7', pageSize: '15.9' });
    expect(parseOffsetParams(params)).toEqual({ page: 2, pageSize: 15 });
  });
});

// ---------------------------------------------------------------------------
// buildOffsetMeta
// ---------------------------------------------------------------------------
describe('buildOffsetMeta', () => {
  it('calculates meta for first page of many', () => {
    const meta = buildOffsetMeta(1, 25, 100);
    expect(meta).toEqual({
      page: 1,
      pageSize: 25,
      totalCount: 100,
      totalPages: 4,
      hasMore: true,
    });
  });

  it('calculates meta for last page', () => {
    const meta = buildOffsetMeta(4, 25, 100);
    expect(meta).toEqual({
      page: 4,
      pageSize: 25,
      totalCount: 100,
      totalPages: 4,
      hasMore: false,
    });
  });

  it('handles single page', () => {
    const meta = buildOffsetMeta(1, 25, 10);
    expect(meta).toEqual({
      page: 1,
      pageSize: 25,
      totalCount: 10,
      totalPages: 1,
      hasMore: false,
    });
  });

  it('handles zero total count', () => {
    const meta = buildOffsetMeta(1, 25, 0);
    expect(meta).toEqual({
      page: 1,
      pageSize: 25,
      totalCount: 0,
      totalPages: 1,
      hasMore: false,
    });
  });

  it('handles partial last page', () => {
    const meta = buildOffsetMeta(1, 25, 30);
    expect(meta).toEqual({
      page: 1,
      pageSize: 25,
      totalCount: 30,
      totalPages: 2,
      hasMore: true,
    });
  });
});

// ---------------------------------------------------------------------------
// parseCursorParams
// ---------------------------------------------------------------------------
describe('parseCursorParams', () => {
  it('returns null cursor and default limit when no params', () => {
    const params = new URLSearchParams();
    expect(parseCursorParams(params)).toEqual({ cursor: null, limit: 25 });
  });

  it('parses cursor and custom limit', () => {
    const encoded = encodeCursor('2026-04-03T10:00:00Z', 'abc-123');
    const params = new URLSearchParams({ cursor: encoded, limit: '50' });
    const result = parseCursorParams(params);
    expect(result.cursor).toBe(encoded);
    expect(result.limit).toBe(50);
  });

  it('clamps limit to max 100', () => {
    const params = new URLSearchParams({ limit: '200' });
    expect(parseCursorParams(params)).toEqual({ cursor: null, limit: 100 });
  });

  it('falls back to default for invalid limit', () => {
    const params = new URLSearchParams({ limit: 'bad' });
    expect(parseCursorParams(params)).toEqual({ cursor: null, limit: 25 });
  });

  it('accepts a custom default limit', () => {
    const params = new URLSearchParams();
    expect(parseCursorParams(params, { limit: 50 })).toEqual({
      cursor: null,
      limit: 50,
    });
  });

  it('treats empty cursor string as null', () => {
    const params = new URLSearchParams({ cursor: '' });
    expect(parseCursorParams(params).cursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// encodeCursor / decodeCursor
// ---------------------------------------------------------------------------
describe('encodeCursor / decodeCursor', () => {
  it('round-trips correctly', () => {
    const createdAt = '2026-04-03T14:30:00.000Z';
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const cursor = encodeCursor(createdAt, id);
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual({ createdAt, id });
  });

  it('returns null for invalid base64', () => {
    expect(decodeCursor('not-valid-base64!!!')).toBeNull();
  });

  it('returns null for base64 without separator', () => {
    expect(decodeCursor(btoa('noseparator'))).toBeNull();
  });

  it('returns null for base64 with empty parts', () => {
    expect(decodeCursor(btoa('|'))).toBeNull();
    expect(decodeCursor(btoa('abc|'))).toBeNull();
    expect(decodeCursor(btoa('|abc'))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildCursorMeta
// ---------------------------------------------------------------------------
describe('buildCursorMeta', () => {
  it('returns null cursor and no more for empty array', () => {
    const meta = buildCursorMeta([], 25);
    expect(meta).toEqual({ cursor: null, hasMore: false });
  });

  it('returns cursor with hasMore=false for partial page', () => {
    const items = [
      { created_at: '2026-04-03T10:00:00Z', id: 'aaa' },
      { created_at: '2026-04-03T09:00:00Z', id: 'bbb' },
    ];
    const meta = buildCursorMeta(items, 25);
    expect(meta.hasMore).toBe(false);
    expect(meta.cursor).not.toBeNull();
    const decoded = decodeCursor(meta.cursor!);
    expect(decoded).toEqual({
      createdAt: '2026-04-03T09:00:00Z',
      id: 'bbb',
    });
  });

  it('returns hasMore=true when items exceed limit (peek row)', () => {
    // Query fetched limit + 1 rows to peek
    const items = Array.from({ length: 4 }, (_, i) => ({
      created_at: `2026-04-03T${String(10 - i).padStart(2, '0')}:00:00Z`,
      id: `id-${i}`,
    }));
    const limit = 3;
    const meta = buildCursorMeta(items, limit);
    expect(meta.hasMore).toBe(true);
    // Cursor points to the last item the client will see (index 2, not 3)
    const decoded = decodeCursor(meta.cursor!);
    expect(decoded).toEqual({
      createdAt: '2026-04-03T08:00:00Z',
      id: 'id-2',
    });
  });

  it('returns hasMore=false when items exactly fill page', () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      created_at: `2026-04-03T${String(10 - i).padStart(2, '0')}:00:00Z`,
      id: `id-${i}`,
    }));
    const meta = buildCursorMeta(items, 3);
    expect(meta.hasMore).toBe(false);
  });
});
