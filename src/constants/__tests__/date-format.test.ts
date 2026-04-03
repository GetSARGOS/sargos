import { describe, it, expect } from 'vitest';
import { formatIncidentTime, formatLocalTime } from '../date-format';

describe('formatIncidentTime', () => {
  it('formats a UTC ISO string in the given timezone', () => {
    // 2026-04-03T21:32:00Z = 2026-04-03 14:32 PDT (UTC-7 during DST)
    const result = formatIncidentTime(
      '2026-04-03T21:32:00Z',
      'America/Los_Angeles',
    );
    // Should contain the date, time, and timezone abbreviation
    expect(result).toContain('2026');
    expect(result).toContain('Apr');
    expect(result).toContain('03');
    expect(result).toContain('14');
    expect(result).toContain('32');
    // PDT during daylight saving time in April
    expect(result).toMatch(/PDT|GMT-7/);
  });

  it('formats a Date object in the given timezone', () => {
    const date = new Date('2026-01-15T12:00:00Z');
    // January = PST (UTC-8), so 12:00 UTC = 04:00 PST
    const result = formatIncidentTime(date, 'America/Los_Angeles');
    expect(result).toContain('04');
    expect(result).toContain('00');
    expect(result).toMatch(/PST|GMT-8/);
  });

  it('works with a different timezone', () => {
    const result = formatIncidentTime(
      '2026-04-03T21:32:00Z',
      'America/New_York',
    );
    // UTC-4 during EDT => 17:32
    expect(result).toContain('17');
    expect(result).toContain('32');
    expect(result).toMatch(/EDT|GMT-4/);
  });
});

describe('formatLocalTime', () => {
  it('returns a non-empty formatted string from ISO string', () => {
    const result = formatLocalTime('2026-04-03T21:32:00Z');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('2026');
    expect(result).toContain('Apr');
  });

  it('returns a non-empty formatted string from Date object', () => {
    const result = formatLocalTime(new Date('2026-06-15T08:00:00Z'));
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('2026');
  });
});
