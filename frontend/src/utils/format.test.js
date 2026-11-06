import { describe, expect, it } from 'vitest';
import { daysAgoISO, greeting, initials, localISODate } from './format';

describe('format helpers', () => {
  it('builds a local calendar date rather than a UTC one', () => {
    expect(localISODate(new Date(2026, 10, 5, 0, 30))).toBe('2026-11-05');
    expect(localISODate(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09');
  });

  it('returns ISO dates for relative days', () => {
    expect(daysAgoISO(0)).toBe(localISODate());
    expect(daysAgoISO(3)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(daysAgoISO(3) < daysAgoISO(1)).toBe(true);
  });

  it('chooses a greeting for the time of day', () => {
    expect(greeting(new Date(2026, 10, 5, 8))).toBe('Good morning');
    expect(greeting(new Date(2026, 10, 5, 14))).toBe('Good afternoon');
    expect(greeting(new Date(2026, 10, 5, 21))).toBe('Good evening');
  });

  it('derives avatar initials from the signed-in name', () => {
    expect(initials('Rishav Kumar Singh')).toBe('RK');
    expect(initials('  priya  ')).toBe('P');
    expect(initials('')).toBe('U');
    expect(initials(undefined)).toBe('U');
  });
});
