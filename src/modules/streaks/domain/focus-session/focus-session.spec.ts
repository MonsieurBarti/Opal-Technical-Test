import { describe, it, expect, beforeEach } from 'vitest';
import { FocusSession } from './focus-session';
import { FakeDateProvider } from '@/util/date-provider/fake-date.provider';

describe('FocusSession Domain Entity', () => {
  let dateProvider: FakeDateProvider;
  const validUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    dateProvider = new FakeDateProvider();
    dateProvider.setNow(new Date('2025-01-15T12:00:00Z'));
  });

  describe('Validation Rules', () => {
    it('should reject endTime before or equal to startTime', () => {
      const startTime = new Date('2025-01-15T10:30:00Z');

      expect(() =>
        FocusSession.create({
          sessionId: 'session-1',
          userId: validUserId,
          startTime,
          endTime: new Date('2025-01-15T10:00:00Z'), // Before start
          durationMinutes: 30,
          timezone: 'America/New_York',
          createdAt: new Date(),
        }),
      ).toThrow(); // Will throw for invalid time relationship

      expect(() =>
        FocusSession.create({
          sessionId: 'session-2',
          userId: validUserId,
          startTime,
          endTime: startTime, // Equal to start
          durationMinutes: 1, // Need positive duration for zod validation
          timezone: 'America/New_York',
          createdAt: new Date(),
        }),
      ).toThrow(); // Will throw for invalid time relationship
    });

    it('should reject invalid UUID format for userId', () => {
      expect(() =>
        FocusSession.create({
          sessionId: 'session-1',
          userId: 'not-a-uuid',
          startTime: new Date('2025-01-15T10:00:00Z'),
          endTime: new Date('2025-01-15T10:30:00Z'),
          durationMinutes: 30,
          timezone: 'UTC',
          createdAt: new Date(),
        }),
      ).toThrow();
    });

    it('should reject negative or zero duration', () => {
      expect(() =>
        FocusSession.create({
          sessionId: 'session-1',
          userId: validUserId,
          startTime: new Date('2025-01-15T10:00:00Z'),
          endTime: new Date('2025-01-15T10:30:00Z'),
          durationMinutes: -10,
          timezone: 'UTC',
          createdAt: new Date(),
        }),
      ).toThrow();

      expect(() =>
        FocusSession.create({
          sessionId: 'session-2',
          userId: validUserId,
          startTime: new Date('2025-01-15T10:00:00Z'),
          endTime: new Date('2025-01-15T10:30:00Z'),
          durationMinutes: 0,
          timezone: 'UTC',
          createdAt: new Date(),
        }),
      ).toThrow();
    });

    it('should calculate duration correctly using dateProvider', () => {
      const session = FocusSession.createNew(
        'session-1',
        validUserId,
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-15T11:45:00Z'),
        'UTC',
        dateProvider,
      );

      expect(session.durationMinutes).toBe(105); // 1h 45min
    });
  });

  describe('Multi-Day Session Splitting - Critical Business Logic', () => {
    it('should NOT split session within single calendar day', () => {
      // 2-hour session on same day in America/New_York
      const session = FocusSession.create({
        sessionId: 'session-single-day',
        userId: validUserId,
        startTime: new Date('2025-01-15T15:00:00Z'), // 10:00 AM EST
        endTime: new Date('2025-01-15T17:00:00Z'), // 12:00 PM EST
        durationMinutes: 120,
        timezone: 'America/New_York',
        createdAt: new Date(),
      });

      const segments = session.splitByDay(dateProvider);

      expect(segments).toHaveLength(1);
      expect(segments[0]).toBe(session); // Should return same instance
    });

    it('should split session crossing midnight in user timezone', () => {
      // Session from 11:30 PM Jan 15 to 12:30 AM Jan 16 (EST)
      // Jan 15 11:30 PM EST = Jan 16 04:30 UTC
      // Jan 16 12:30 AM EST = Jan 16 05:30 UTC
      const session = FocusSession.create({
        sessionId: 'midnight-session',
        userId: validUserId,
        startTime: new Date('2025-01-16T04:30:00Z'),
        endTime: new Date('2025-01-16T05:30:00Z'),
        durationMinutes: 60,
        timezone: 'America/New_York',
        createdAt: new Date(),
      });

      const segments = session.splitByDay(dateProvider);

      expect(segments).toHaveLength(2);
      expect(segments[0].sessionId).toBe('midnight-session-day0');
      expect(segments[1].sessionId).toBe('midnight-session-day1');

      // Verify segments span correct days
      expect(segments[0].getQualifiedDate(dateProvider)).toBe('2025-01-15');
      expect(segments[1].getQualifiedDate(dateProvider)).toBe('2025-01-16');

      // Total duration preserved (within rounding tolerance)
      const totalDuration =
        segments[0].durationMinutes + segments[1].durationMinutes;
      expect(totalDuration).toBeGreaterThanOrEqual(59);
      expect(totalDuration).toBeLessThanOrEqual(60);
    });

    it('should split session spanning 3 calendar days', () => {
      // 50-hour session from Jan 15 11:00 PM to Jan 18 1:00 AM (EST)
      const session = FocusSession.create({
        sessionId: 'multi-day',
        userId: validUserId,
        startTime: new Date('2025-01-16T04:00:00Z'), // Jan 15 11:00 PM EST
        endTime: new Date('2025-01-18T06:00:00Z'), // Jan 18 1:00 AM EST
        durationMinutes: 3000, // 50 hours
        timezone: 'America/New_York',
        createdAt: new Date(),
      });

      const segments = session.splitByDay(dateProvider);

      expect(segments.length).toBeGreaterThanOrEqual(3);

      // Verify each segment has unique ID
      const sessionIds = segments.map((s) => s.sessionId);
      expect(new Set(sessionIds).size).toBe(segments.length);

      // All segments same user and timezone
      segments.forEach((segment) => {
        expect(segment.userId).toBe(validUserId);
        expect(segment.timezone).toBe('America/New_York');
      });
    });

    it('should handle DST boundary without splitting (same day)', () => {
      // Session during DST transition: Mar 9, 2025 1:30 AM - 4:30 AM EST/EDT
      // Clock jumps forward at 2:00 AM (Spring forward)
      const session = FocusSession.create({
        sessionId: 'dst-session',
        userId: validUserId,
        startTime: new Date('2025-03-09T06:30:00Z'), // 1:30 AM EST
        endTime: new Date('2025-03-09T08:30:00Z'), // 4:30 AM EDT
        durationMinutes: 120,
        timezone: 'America/New_York',
        createdAt: new Date(),
      });

      const segments = session.splitByDay(dateProvider);

      // Should NOT split - same calendar day despite DST
      expect(segments).toHaveLength(1);
    });
  });

  describe('Timezone Handling - Edge Cases', () => {
    it('should correctly identify qualified date in America/New_York', () => {
      // UTC time that is Jan 15 in EST but Jan 16 in UTC
      const session = FocusSession.create({
        sessionId: 'session-1',
        userId: validUserId,
        startTime: new Date('2025-01-16T03:00:00Z'), // Jan 15 10:00 PM EST
        endTime: new Date('2025-01-16T04:00:00Z'),
        durationMinutes: 60,
        timezone: 'America/New_York',
        createdAt: new Date(),
      });

      expect(session.getQualifiedDate(dateProvider)).toBe('2025-01-15');
    });

    it('should correctly identify qualified date in Asia/Tokyo', () => {
      // UTC time that is different day in Japan (+9 hours)
      const session = FocusSession.create({
        sessionId: 'session-1',
        userId: validUserId,
        startTime: new Date('2025-01-15T16:00:00Z'), // Jan 16 1:00 AM JST
        endTime: new Date('2025-01-15T17:00:00Z'),
        durationMinutes: 60,
        timezone: 'Asia/Tokyo',
        createdAt: new Date(),
      });

      expect(session.getQualifiedDate(dateProvider)).toBe('2025-01-16');
    });

    it('should split session at midnight in UTC timezone', () => {
      const session = FocusSession.create({
        sessionId: 'utc-midnight',
        userId: validUserId,
        startTime: new Date('2025-01-15T23:30:00Z'),
        endTime: new Date('2025-01-16T00:30:00Z'),
        durationMinutes: 60,
        timezone: 'UTC',
        createdAt: new Date(),
      });

      const segments = session.splitByDay(dateProvider);

      expect(segments).toHaveLength(2);
      expect(segments[0].getQualifiedDate(dateProvider)).toBe('2025-01-15');
      expect(segments[1].getQualifiedDate(dateProvider)).toBe('2025-01-16');
    });
  });

  describe('Date Boundary Edge Cases', () => {
    it('should handle year boundary correctly', () => {
      // Session crossing New Year midnight
      const session = FocusSession.create({
        sessionId: 'new-year',
        userId: validUserId,
        startTime: new Date('2024-12-31T23:30:00Z'),
        endTime: new Date('2025-01-01T00:30:00Z'),
        durationMinutes: 60,
        timezone: 'UTC',
        createdAt: new Date(),
      });

      const segments = session.splitByDay(dateProvider);

      expect(segments).toHaveLength(2);
      expect(segments[0].getQualifiedDate(dateProvider)).toBe('2024-12-31');
      expect(segments[1].getQualifiedDate(dateProvider)).toBe('2025-01-01');
    });

    it('should handle month boundary correctly', () => {
      const session = FocusSession.create({
        sessionId: 'month-end',
        userId: validUserId,
        startTime: new Date('2025-01-31T23:30:00Z'),
        endTime: new Date('2025-02-01T00:30:00Z'),
        durationMinutes: 60,
        timezone: 'UTC',
        createdAt: new Date(),
      });

      const segments = session.splitByDay(dateProvider);

      expect(segments).toHaveLength(2);
      expect(segments[0].getQualifiedDate(dateProvider)).toBe('2025-01-31');
      expect(segments[1].getQualifiedDate(dateProvider)).toBe('2025-02-01');
    });

    it('should handle leap year February 29th', () => {
      const session = FocusSession.create({
        sessionId: 'leap-day',
        userId: validUserId,
        startTime: new Date('2024-02-29T10:00:00Z'), // 2024 is leap year
        endTime: new Date('2024-02-29T11:00:00Z'),
        durationMinutes: 60,
        timezone: 'UTC',
        createdAt: new Date(),
      });

      expect(session.getQualifiedDate(dateProvider)).toBe('2024-02-29');
    });
  });

  describe('Late Data & Idempotency Scenarios', () => {
    it('should preserve immutability of focus session', () => {
      const session = FocusSession.create({
        sessionId: 'immutable-session',
        userId: validUserId,
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T11:00:00Z'),
        durationMinutes: 60,
        timezone: 'UTC',
        createdAt: new Date('2025-01-15T11:00:00Z'),
      });

      // Properties should be read-only
      expect(session.sessionId).toBe('immutable-session');
      expect(session.userId).toBe(validUserId);
      expect(session.durationMinutes).toBe(60);

      // Attempting to split should return new instances, not modify original
      session.splitByDay(dateProvider);
      expect(session.sessionId).toBe('immutable-session'); // Original unchanged
    });

    it('should handle very short sessions (1 minute)', () => {
      const session = FocusSession.createNew(
        'short-session',
        validUserId,
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-15T10:01:00Z'),
        'UTC',
        dateProvider,
      );

      expect(session.durationMinutes).toBe(1);
    });

    it('should handle very long sessions (24+ hours)', () => {
      const session = FocusSession.createNew(
        'marathon-session',
        validUserId,
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-16T10:00:00Z'),
        'UTC',
        dateProvider,
      );

      expect(session.durationMinutes).toBe(1440); // 24 hours
    });
  });
});
