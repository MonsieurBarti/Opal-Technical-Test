import { describe, it, expect, beforeEach } from 'vitest';
import {
  AcceptFocusSessionCommand,
  AcceptFocusSessionCommandHandler,
} from './accept-focus-session.command';
import { InMemoryFocusSessionRepository } from '@/modules/streaks/infrastructure/focus-session/in-memory-focus-session.repository';
import { InMemoryUserStreakRepository } from '@/modules/streaks/infrastructure/user-streak/in-memory-user-streak.repository';
import { FakeDateProvider } from '@/util/date-provider/fake-date.provider';

describe('AcceptFocusSessionCommand Handler', () => {
  let handler: AcceptFocusSessionCommandHandler;
  let sessionRepository: InMemoryFocusSessionRepository;
  let streakRepository: InMemoryUserStreakRepository;
  let dateProvider: FakeDateProvider;

  const userId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    dateProvider = new FakeDateProvider();
    dateProvider.setNow(new Date('2025-01-15T12:00:00Z'));

    sessionRepository = new InMemoryFocusSessionRepository(dateProvider);
    streakRepository = new InMemoryUserStreakRepository(dateProvider);

    handler = new AcceptFocusSessionCommandHandler(
      sessionRepository,
      streakRepository,
      dateProvider,
    );
  });

  describe('Idempotency - Critical for Distributed Systems', () => {
    it('should return early if session already exists', async () => {
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'session-duplicate',
        userId,
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T11:00:00Z'),
        timezone: 'UTC',
      });

      // First execution - should process
      await handler.execute(command);

      const initialSessions = sessionRepository.getAll();
      const initialStreak = await streakRepository.findByUserId(userId);

      // Second execution - should be idempotent
      await handler.execute(command);

      const finalSessions = sessionRepository.getAll();
      const finalStreak = await streakRepository.findByUserId(userId);

      // Should have same state after second execution
      expect(finalSessions).toHaveLength(initialSessions.length);
      expect(finalStreak?.currentStreak).toBe(initialStreak?.currentStreak);
    });

    it('should not create duplicate sessions with same sessionId', async () => {
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'session-unique',
        userId,
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T11:00:00Z'),
        timezone: 'UTC',
      });

      await handler.execute(command);
      await handler.execute(command);
      await handler.execute(command);

      const sessions = sessionRepository.getAll();
      expect(sessions).toHaveLength(1);
    });
  });

  describe('Single-Day Session Processing', () => {
    it('should save session and update streak when duration >= 30 minutes', async () => {
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'session-qualified',
        userId,
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T10:30:00Z'), // Exactly 30 min
        timezone: 'UTC',
      });

      await handler.execute(command);

      // Verify session saved
      const session = await sessionRepository.findById('session-qualified');
      expect(session).toBeDefined();
      expect(session?.durationMinutes).toBe(30);

      // Verify streak updated
      const streak = await streakRepository.findByUserId(userId);
      expect(streak).toBeDefined();
      expect(streak?.currentStreak).toBe(1);
      expect(streak?.lastQualifiedDate).toBe('2025-01-15');
    });

    it('should NOT update streak when duration < 30 minutes', async () => {
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'session-unqualified',
        userId,
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T10:29:00Z'), // Only 29 min
        timezone: 'UTC',
      });

      await handler.execute(command);

      // Session should be saved
      const session = await sessionRepository.findById('session-unqualified');
      expect(session).toBeDefined();

      // But streak should NOT update
      const streak = await streakRepository.findByUserId(userId);
      expect(streak).toBeDefined();
      expect(streak?.currentStreak).toBe(0); // No streak yet
      expect(streak?.lastQualifiedDate).toBeNull();
    });

    it('should update streak when multiple sessions on same day total >= 30 min', async () => {
      // First session: 15 minutes (doesn't qualify alone)
      const command1 = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'session-1',
        userId,
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T10:15:00Z'),
        timezone: 'UTC',
      });

      await handler.execute(command1);

      let streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(0); // Not qualified yet

      // Second session: 20 minutes (total now 35 min - qualifies!)
      const command2 = new AcceptFocusSessionCommand({
        correlationId: 'corr-2',
        sessionId: 'session-2',
        userId,
        startTime: new Date('2025-01-15T14:00:00Z'),
        endTime: new Date('2025-01-15T14:20:00Z'),
        timezone: 'UTC',
      });

      await handler.execute(command2);

      streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(1); // Now qualified!
      expect(streak?.lastQualifiedDate).toBe('2025-01-15');
    });
  });

  describe('Multi-Day Session Splitting', () => {
    it('should split session across midnight and process both days', async () => {
      // Session from 11:00 PM to 1:00 AM (2 hours crossing midnight in UTC)
      // Each day should get ~1 hour, so both qualify (>= 30 min)
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'midnight-session',
        userId,
        startTime: new Date('2025-01-15T23:00:00Z'),
        endTime: new Date('2025-01-16T01:00:00Z'),
        timezone: 'UTC',
      });

      await handler.execute(command);

      // Should have 2 session segments
      const sessions = sessionRepository.getAll();
      expect(sessions.length).toBeGreaterThanOrEqual(2);

      // Check that segments have correct day markers
      const day1Sessions = sessions.filter(
        (s) => s.getQualifiedDate(dateProvider) === '2025-01-15',
      );
      const day2Sessions = sessions.filter(
        (s) => s.getQualifiedDate(dateProvider) === '2025-01-16',
      );

      expect(day1Sessions.length).toBeGreaterThan(0);
      expect(day2Sessions.length).toBeGreaterThan(0);

      // Streak should be 2 (both days qualified with 30+ min each)
      const streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(2);
      expect(streak?.lastQualifiedDate).toBe('2025-01-16');
    });

    it('should handle session split where only one day qualifies (< 30 min each)', async () => {
      // Short session crossing midnight: 11:50 PM to 12:10 AM (20 min total)
      // Each day gets < 30 min, so neither qualifies
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'short-midnight',
        userId,
        startTime: new Date('2025-01-15T23:50:00Z'),
        endTime: new Date('2025-01-16T00:10:00Z'),
        timezone: 'UTC',
      });

      await handler.execute(command);

      // Sessions should be split and saved
      const sessions = sessionRepository.getAll();
      expect(sessions.length).toBeGreaterThanOrEqual(2);

      // But streak should NOT update (neither day has 30+ min)
      const streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(0);
      expect(streak?.lastQualifiedDate).toBeNull();
    });
  });

  describe('Timezone-Aware Processing', () => {
    it('should correctly identify qualified date in America/New_York timezone', async () => {
      // UTC time that is Jan 15 in EST
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'est-session',
        userId,
        startTime: new Date('2025-01-16T03:00:00Z'), // Jan 15 10:00 PM EST
        endTime: new Date('2025-01-16T04:00:00Z'), // Jan 15 11:00 PM EST
        timezone: 'America/New_York',
      });

      await handler.execute(command);

      const streak = await streakRepository.findByUserId(userId);
      expect(streak?.lastQualifiedDate).toBe('2025-01-15'); // Jan 15 in EST
    });

    it('should split session at midnight in user timezone, not UTC', async () => {
      // Session crossing midnight in EST (11:30 PM to 12:30 AM EST)
      // In UTC: Jan 16 04:30 to Jan 16 05:30
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'est-midnight',
        userId,
        startTime: new Date('2025-01-16T04:30:00Z'), // Jan 15 11:30 PM EST
        endTime: new Date('2025-01-16T05:30:00Z'), // Jan 16 12:30 AM EST
        timezone: 'America/New_York',
      });

      await handler.execute(command);

      // Should be split into 2 days in EST timezone
      const sessions = sessionRepository.getAll();
      expect(sessions.length).toBeGreaterThanOrEqual(2);

      const dates = sessions.map((s) => s.getQualifiedDate(dateProvider));
      expect(dates).toContain('2025-01-15');
      expect(dates).toContain('2025-01-16');
    });
  });

  describe('Consecutive Day Streak Building', () => {
    it('should build 3-day streak with consecutive qualified days', async () => {
      // Day 1
      await handler.execute(
        new AcceptFocusSessionCommand({
          correlationId: 'corr-1',
          sessionId: 'session-day1',
          userId,
          startTime: new Date('2025-01-13T10:00:00Z'),
          endTime: new Date('2025-01-13T10:35:00Z'),
          timezone: 'UTC',
        }),
      );

      let streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(1);

      // Day 2 (consecutive)
      await handler.execute(
        new AcceptFocusSessionCommand({
          correlationId: 'corr-2',
          sessionId: 'session-day2',
          userId,
          startTime: new Date('2025-01-14T10:00:00Z'),
          endTime: new Date('2025-01-14T10:35:00Z'),
          timezone: 'UTC',
        }),
      );

      streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(2);

      // Day 3 (consecutive)
      await handler.execute(
        new AcceptFocusSessionCommand({
          correlationId: 'corr-3',
          sessionId: 'session-day3',
          userId,
          startTime: new Date('2025-01-15T10:00:00Z'),
          endTime: new Date('2025-01-15T10:35:00Z'),
          timezone: 'UTC',
        }),
      );

      streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(3);
      expect(streak?.lastQualifiedDate).toBe('2025-01-15');
    });

    it('should reset streak when day is skipped', async () => {
      // Day 1
      await handler.execute(
        new AcceptFocusSessionCommand({
          correlationId: 'corr-1',
          sessionId: 'session-1',
          userId,
          startTime: new Date('2025-01-10T10:00:00Z'),
          endTime: new Date('2025-01-10T10:35:00Z'),
          timezone: 'UTC',
        }),
      );

      let streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(1);

      // Skip Day 11, resume on Day 12
      await handler.execute(
        new AcceptFocusSessionCommand({
          correlationId: 'corr-2',
          sessionId: 'session-2',
          userId,
          startTime: new Date('2025-01-12T10:00:00Z'),
          endTime: new Date('2025-01-12T10:35:00Z'),
          timezone: 'UTC',
        }),
      );

      streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(1); // Reset due to gap
      expect(streak?.lastQualifiedDate).toBe('2025-01-12');
    });
  });

  describe('Late Data Handling', () => {
    it('should handle late-arriving session data correctly', async () => {
      // Process session for Jan 15
      await handler.execute(
        new AcceptFocusSessionCommand({
          correlationId: 'corr-1',
          sessionId: 'session-jan15',
          userId,
          startTime: new Date('2025-01-15T10:00:00Z'),
          endTime: new Date('2025-01-15T10:35:00Z'),
          timezone: 'UTC',
        }),
      );

      let streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(1);
      expect(streak?.lastQualifiedDate).toBe('2025-01-15');

      // Late data arrives for Jan 12 (before Jan 15)
      await handler.execute(
        new AcceptFocusSessionCommand({
          correlationId: 'corr-2',
          sessionId: 'session-jan12-late',
          userId,
          startTime: new Date('2025-01-12T10:00:00Z'),
          endTime: new Date('2025-01-12T10:35:00Z'),
          timezone: 'UTC',
        }),
      );

      streak = await streakRepository.findByUserId(userId);
      // Streak should remain 1 (late data doesn't change current streak)
      expect(streak?.currentStreak).toBe(1);
      expect(streak?.lastQualifiedDate).toBe('2025-01-15');
      // But qualified days count should increment
      expect(streak?.qualifiedDaysCount).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle year boundary correctly', async () => {
      // Dec 31, 2024
      await handler.execute(
        new AcceptFocusSessionCommand({
          correlationId: 'corr-1',
          sessionId: 'session-dec31',
          userId,
          startTime: new Date('2024-12-31T10:00:00Z'),
          endTime: new Date('2024-12-31T10:35:00Z'),
          timezone: 'UTC',
        }),
      );

      // Jan 1, 2025 (consecutive)
      await handler.execute(
        new AcceptFocusSessionCommand({
          correlationId: 'corr-2',
          sessionId: 'session-jan1',
          userId,
          startTime: new Date('2025-01-01T10:00:00Z'),
          endTime: new Date('2025-01-01T10:35:00Z'),
          timezone: 'UTC',
        }),
      );

      const streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(2); // Should cross year boundary
      expect(streak?.lastQualifiedDate).toBe('2025-01-01');
    });

    it('should handle very long session (multi-hour)', async () => {
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'marathon-session',
        userId,
        startTime: new Date('2025-01-15T08:00:00Z'),
        endTime: new Date('2025-01-15T14:00:00Z'), // 6 hours
        timezone: 'UTC',
      });

      await handler.execute(command);

      const session = await sessionRepository.findById('marathon-session');
      expect(session?.durationMinutes).toBe(360);

      const streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(1); // Qualifies
    });

    it('should handle minimum qualifying session (exactly 30 min)', async () => {
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'exact-30min',
        userId,
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T10:30:00Z'),
        timezone: 'UTC',
      });

      await handler.execute(command);

      const streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(1); // Exactly 30 min qualifies
    });

    it('should handle just-below-threshold session (29 min)', async () => {
      const command = new AcceptFocusSessionCommand({
        correlationId: 'corr-1',
        sessionId: 'just-under',
        userId,
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T10:29:00Z'),
        timezone: 'UTC',
      });

      await handler.execute(command);

      const streak = await streakRepository.findByUserId(userId);
      expect(streak?.currentStreak).toBe(0); // Does NOT qualify
    });
  });
});
