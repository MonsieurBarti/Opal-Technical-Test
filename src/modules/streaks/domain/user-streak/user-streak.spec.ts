import { describe, it, expect, beforeEach } from 'vitest';
import { UserStreak } from './user-streak';
import { FakeDateProvider } from '@/util/date-provider/fake-date.provider';

describe('UserStreak Domain Entity', () => {
  let dateProvider: FakeDateProvider;
  const userId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    dateProvider = new FakeDateProvider();
    dateProvider.setNow(new Date('2025-01-15T12:00:00Z'));
  });

  describe('Validation Rules', () => {
    it('should reject invalid UUID format', () => {
      expect(() =>
        UserStreak.create({
          userId: 'not-a-uuid',
          currentStreak: 5,
          longestStreak: 10,
          lastQualifiedDate: '2025-01-15',
          qualifiedDaysCount: 25,
          updatedAt: new Date(),
        }),
      ).toThrow();
    });

    it('should reject negative streak values', () => {
      expect(() =>
        UserStreak.create({
          userId,
          currentStreak: -1,
          longestStreak: 10,
          lastQualifiedDate: '2025-01-15',
          qualifiedDaysCount: 25,
          updatedAt: new Date(),
        }),
      ).toThrow();
    });

    it('should allow null lastQualifiedDate for new users', () => {
      const streak = UserStreak.createNew(userId, dateProvider);

      expect(streak.lastQualifiedDate).toBeNull();
      expect(streak.currentStreak).toBe(0);
      expect(streak.hasActiveStreak()).toBe(false);
    });
  });

  describe('Streak Calculation - Core Business Logic', () => {
    describe('First qualified day', () => {
      it('should initialize streak to 1 on first qualified date', () => {
        const streak = UserStreak.createNew(userId, dateProvider);

        streak.updateWithQualifiedDate('2025-01-15', dateProvider);

        expect(streak.currentStreak).toBe(1);
        expect(streak.longestStreak).toBe(1);
        expect(streak.lastQualifiedDate).toBe('2025-01-15');
        expect(streak.qualifiedDaysCount).toBe(1);
        expect(streak.hasActiveStreak()).toBe(true);
      });
    });

    describe('Consecutive days - streak increment', () => {
      it('should increment streak for consecutive day', () => {
        const streak = UserStreak.createNew(userId, dateProvider);

        streak.updateWithQualifiedDate('2025-01-15', dateProvider);
        expect(streak.currentStreak).toBe(1);

        streak.updateWithQualifiedDate('2025-01-16', dateProvider);
        expect(streak.currentStreak).toBe(2);
        expect(streak.longestStreak).toBe(2);
        expect(streak.lastQualifiedDate).toBe('2025-01-16');
      });

      it('should continue incrementing for multiple consecutive days', () => {
        const streak = UserStreak.createNew(userId, dateProvider);

        for (let day = 10; day <= 17; day++) {
          streak.updateWithQualifiedDate(`2025-01-${day}`, dateProvider);
        }

        expect(streak.currentStreak).toBe(8);
        expect(streak.longestStreak).toBe(8);
        expect(streak.qualifiedDaysCount).toBe(8);
      });

      it('should update longestStreak when currentStreak exceeds it', () => {
        const streak = UserStreak.create({
          userId,
          currentStreak: 8,
          longestStreak: 10, // Previous record
          lastQualifiedDate: '2025-01-10',
          qualifiedDaysCount: 20,
          updatedAt: new Date(),
        });

        // Continue to beat record
        for (let day = 11; day <= 14; day++) {
          streak.updateWithQualifiedDate(`2025-01-${day}`, dateProvider);
        }

        expect(streak.currentStreak).toBe(12);
        expect(streak.longestStreak).toBe(12); // New record
      });

      it('should NOT update longestStreak if still below previous record', () => {
        const streak = UserStreak.create({
          userId,
          currentStreak: 3,
          longestStreak: 20, // High record
          lastQualifiedDate: '2025-01-13',
          qualifiedDaysCount: 30,
          updatedAt: new Date(),
        });

        streak.updateWithQualifiedDate('2025-01-14', dateProvider);

        expect(streak.currentStreak).toBe(4);
        expect(streak.longestStreak).toBe(20); // Unchanged
      });
    });

    describe('Broken streaks - reset logic', () => {
      it('should reset streak to 1 when gap is 2 days', () => {
        const streak = UserStreak.create({
          userId,
          currentStreak: 5,
          longestStreak: 5,
          lastQualifiedDate: '2025-01-10',
          qualifiedDaysCount: 10,
          updatedAt: new Date(),
        });

        // Gap: Jan 11 missing, resume Jan 12
        streak.updateWithQualifiedDate('2025-01-12', dateProvider);

        expect(streak.currentStreak).toBe(1); // Reset
        expect(streak.longestStreak).toBe(5); // Previous record preserved
        expect(streak.lastQualifiedDate).toBe('2025-01-12');
        expect(streak.qualifiedDaysCount).toBe(11); // Still increments
      });

      it('should reset streak to 1 when gap is multiple days', () => {
        const streak = UserStreak.create({
          userId,
          currentStreak: 10,
          longestStreak: 10,
          lastQualifiedDate: '2025-01-05',
          qualifiedDaysCount: 20,
          updatedAt: new Date(),
        });

        // Gap of 10 days
        streak.updateWithQualifiedDate('2025-01-15', dateProvider);

        expect(streak.currentStreak).toBe(1);
        expect(streak.lastQualifiedDate).toBe('2025-01-15');
        expect(streak.qualifiedDaysCount).toBe(21);
      });

      it('should preserve longestStreak after reset', () => {
        const streak = UserStreak.create({
          userId,
          currentStreak: 5,
          longestStreak: 15, // Personal best
          lastQualifiedDate: '2025-01-10',
          qualifiedDaysCount: 30,
          updatedAt: new Date(),
        });

        // Break streak
        streak.updateWithQualifiedDate('2025-01-20', dateProvider);

        expect(streak.currentStreak).toBe(1);
        expect(streak.longestStreak).toBe(15); // Preserved
      });
    });

    describe('Same-day idempotency', () => {
      it('should NOT change streak for same day update', () => {
        const streak = UserStreak.create({
          userId,
          currentStreak: 7,
          longestStreak: 7,
          lastQualifiedDate: '2025-01-15',
          qualifiedDaysCount: 15,
          updatedAt: new Date('2025-01-15T10:00:00Z'),
        });

        // Update again with same date
        streak.updateWithQualifiedDate('2025-01-15', dateProvider);

        expect(streak.currentStreak).toBe(7); // No change
        expect(streak.longestStreak).toBe(7);
        expect(streak.lastQualifiedDate).toBe('2025-01-15');
        expect(streak.qualifiedDaysCount).toBe(15); // No increment
      });

      it('should update timestamp even for same-day duplicate', () => {
        const oldTimestamp = new Date('2025-01-15T08:00:00Z');
        const newTimestamp = new Date('2025-01-15T16:00:00Z');

        const streak = UserStreak.create({
          userId,
          currentStreak: 5,
          longestStreak: 5,
          lastQualifiedDate: '2025-01-15',
          qualifiedDaysCount: 10,
          updatedAt: oldTimestamp,
        });

        dateProvider.setNow(newTimestamp);
        streak.updateWithQualifiedDate('2025-01-15', dateProvider);

        expect(streak.updatedAt).toEqual(newTimestamp);
      });
    });

    describe('Late/out-of-order data handling', () => {
      it('should increment qualified count but NOT change streak for late data', () => {
        const streak = UserStreak.create({
          userId,
          currentStreak: 5,
          longestStreak: 5,
          lastQualifiedDate: '2025-01-15',
          qualifiedDaysCount: 10,
          updatedAt: new Date(),
        });

        // Late data from Jan 12 (before Jan 15)
        streak.updateWithQualifiedDate('2025-01-12', dateProvider);

        expect(streak.currentStreak).toBe(5); // Unchanged
        expect(streak.lastQualifiedDate).toBe('2025-01-15'); // Unchanged
        expect(streak.qualifiedDaysCount).toBe(11); // Incremented
      });

      it('should NOT update lastQualifiedDate for out-of-order data', () => {
        const streak = UserStreak.create({
          userId,
          currentStreak: 3,
          longestStreak: 5,
          lastQualifiedDate: '2025-01-20',
          qualifiedDaysCount: 15,
          updatedAt: new Date(),
        });

        // Very late data from Jan 5
        streak.updateWithQualifiedDate('2025-01-05', dateProvider);

        expect(streak.lastQualifiedDate).toBe('2025-01-20');
        expect(streak.qualifiedDaysCount).toBe(16);
      });
    });
  });

  describe('Date Boundary Edge Cases', () => {
    it('should handle year boundary correctly', () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastQualifiedDate: '2024-12-31',
        qualifiedDaysCount: 1,
        updatedAt: new Date(),
      });

      streak.updateWithQualifiedDate('2025-01-01', dateProvider);

      expect(streak.currentStreak).toBe(2);
      expect(streak.lastQualifiedDate).toBe('2025-01-01');
    });

    it('should handle month boundary correctly', () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastQualifiedDate: '2025-01-31',
        qualifiedDaysCount: 1,
        updatedAt: new Date(),
      });

      streak.updateWithQualifiedDate('2025-02-01', dateProvider);

      expect(streak.currentStreak).toBe(2);
      expect(streak.lastQualifiedDate).toBe('2025-02-01');
    });

    it('should handle leap year February 29th', () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastQualifiedDate: '2024-02-28', // 2024 is leap year
        qualifiedDaysCount: 1,
        updatedAt: new Date(),
      });

      streak.updateWithQualifiedDate('2024-02-29', dateProvider);

      expect(streak.currentStreak).toBe(2);
      expect(streak.lastQualifiedDate).toBe('2024-02-29');
    });

    it('should handle transition from Feb 29 to Mar 1', () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastQualifiedDate: '2024-02-29',
        qualifiedDaysCount: 1,
        updatedAt: new Date(),
      });

      streak.updateWithQualifiedDate('2024-03-01', dateProvider);

      expect(streak.currentStreak).toBe(2);
    });
  });

  describe('resetStreak behavior', () => {
    it('should reset current streak to 0 and clear lastQualifiedDate', () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 10,
        longestStreak: 15,
        lastQualifiedDate: '2025-01-15',
        qualifiedDaysCount: 25,
        updatedAt: new Date('2025-01-15T10:00:00Z'),
      });

      streak.resetStreak(dateProvider);

      expect(streak.currentStreak).toBe(0);
      expect(streak.lastQualifiedDate).toBeNull();
      expect(streak.longestStreak).toBe(15); // Preserved
      expect(streak.qualifiedDaysCount).toBe(25); // Preserved
      expect(streak.hasActiveStreak()).toBe(false);
    });

    it('should update timestamp on reset', () => {
      const oldTime = new Date('2025-01-10T12:00:00Z');
      const newTime = new Date('2025-01-15T14:00:00Z');

      const streak = UserStreak.create({
        userId,
        currentStreak: 5,
        longestStreak: 5,
        lastQualifiedDate: '2025-01-10',
        qualifiedDaysCount: 5,
        updatedAt: oldTime,
      });

      dateProvider.setNow(newTime);
      streak.resetStreak(dateProvider);

      expect(streak.updatedAt).toEqual(newTime);
    });
  });

  describe('Real-World Streak Scenarios', () => {
    it('should handle typical progression: 7-day streak → break → 5-day streak → new record', () => {
      const streak = UserStreak.createNew(userId, dateProvider);

      // Week 1: Perfect 7 days
      for (let day = 1; day <= 7; day++) {
        streak.updateWithQualifiedDate(
          `2025-01-${day.toString().padStart(2, '0')}`,
          dateProvider,
        );
      }
      expect(streak.currentStreak).toBe(7);
      expect(streak.longestStreak).toBe(7);

      // Miss 2 days (Jan 8-9)

      // Week 2: Restart on Jan 10
      for (let day = 10; day <= 14; day++) {
        streak.updateWithQualifiedDate(`2025-01-${day}`, dateProvider);
      }
      expect(streak.currentStreak).toBe(5); // Reset after gap
      expect(streak.longestStreak).toBe(7); // Previous record

      // Continue to beat previous record
      for (let day = 15; day <= 22; day++) {
        streak.updateWithQualifiedDate(`2025-01-${day}`, dateProvider);
      }
      expect(streak.currentStreak).toBe(13); // Jan 10-22
      expect(streak.longestStreak).toBe(13); // New record
    });

    it('should handle "weekend warrior" pattern (weekday only)', () => {
      const streak = UserStreak.createNew(userId, dateProvider);

      // Mon-Wed (Jan 6-8)
      streak.updateWithQualifiedDate('2025-01-06', dateProvider);
      streak.updateWithQualifiedDate('2025-01-07', dateProvider);
      streak.updateWithQualifiedDate('2025-01-08', dateProvider);

      expect(streak.currentStreak).toBe(3);

      // Skip weekend (Jan 11-12 Sat-Sun)
      // Resume Monday (Jan 13)
      streak.updateWithQualifiedDate('2025-01-13', dateProvider);

      expect(streak.currentStreak).toBe(1); // Streak broken
    });

    it('should handle comeback after long break', () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 30,
        longestStreak: 30,
        lastQualifiedDate: '2024-12-01',
        qualifiedDaysCount: 50,
        updatedAt: new Date(),
      });

      // Long break - return 45 days later
      streak.updateWithQualifiedDate('2025-01-15', dateProvider);

      expect(streak.currentStreak).toBe(1); // Fresh start
      expect(streak.longestStreak).toBe(30); // Record preserved
      expect(streak.qualifiedDaysCount).toBe(51);
    });

    it('should handle perfect month (31 consecutive days)', () => {
      const streak = UserStreak.createNew(userId, dateProvider);

      // January 1-31
      for (let day = 1; day <= 31; day++) {
        streak.updateWithQualifiedDate(
          `2025-01-${day.toString().padStart(2, '0')}`,
          dateProvider,
        );
      }

      expect(streak.currentStreak).toBe(31);
      expect(streak.longestStreak).toBe(31);
      expect(streak.qualifiedDaysCount).toBe(31);
      expect(streak.lastQualifiedDate).toBe('2025-01-31');
    });
  });

  describe('Edge Cases & Boundary Conditions', () => {
    it('should handle multiple updates in single day (idempotent)', () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 5,
        longestStreak: 5,
        lastQualifiedDate: '2025-01-14',
        qualifiedDaysCount: 10,
        updatedAt: new Date(),
      });

      // User has 3 separate 15-min sessions on Jan 15
      // Each qualifies the day, but streak should only increment once
      streak.updateWithQualifiedDate('2025-01-15', dateProvider);
      streak.updateWithQualifiedDate('2025-01-15', dateProvider);
      streak.updateWithQualifiedDate('2025-01-15', dateProvider);

      expect(streak.currentStreak).toBe(6); // Only incremented once
      expect(streak.qualifiedDaysCount).toBe(11);
    });

    it('should handle very long streak (365+ days)', () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 400,
        longestStreak: 400,
        lastQualifiedDate: '2026-01-14',
        qualifiedDaysCount: 450,
        updatedAt: new Date(),
      });

      streak.updateWithQualifiedDate('2026-01-15', dateProvider);

      expect(streak.currentStreak).toBe(401);
      expect(streak.longestStreak).toBe(401);
    });

    it('should correctly identify active vs inactive streaks', () => {
      const activeStreak = UserStreak.create({
        userId,
        currentStreak: 5,
        longestStreak: 5,
        lastQualifiedDate: '2025-01-15',
        qualifiedDaysCount: 5,
        updatedAt: new Date(),
      });

      const inactiveStreak = UserStreak.create({
        userId: '660e8400-e29b-41d4-a716-446655440001',
        currentStreak: 0,
        longestStreak: 10,
        lastQualifiedDate: null,
        qualifiedDaysCount: 20,
        updatedAt: new Date(),
      });

      expect(activeStreak.hasActiveStreak()).toBe(true);
      expect(inactiveStreak.hasActiveStreak()).toBe(false);
    });
  });
});
