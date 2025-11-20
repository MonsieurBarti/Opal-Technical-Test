import { describe, it, expect, beforeEach } from 'vitest';
import {
  GetUserStreakQuery,
  GetUserStreakQueryHandler,
} from './get-user-streak.query';
import { InMemoryUserStreakRepository } from '@/modules/streaks/infrastructure/user-streak/in-memory-user-streak.repository';
import { UserStreak } from '@/modules/streaks/domain/user-streak/user-streak';
import { FakeDateProvider } from '@/util/date-provider/fake-date.provider';

describe('GetUserStreakQuery Handler', () => {
  let handler: GetUserStreakQueryHandler;
  let repository: InMemoryUserStreakRepository;
  let dateProvider: FakeDateProvider;

  const userId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    dateProvider = new FakeDateProvider();
    dateProvider.setNow(new Date('2025-01-15T12:00:00Z'));

    repository = new InMemoryUserStreakRepository(dateProvider);
    handler = new GetUserStreakQueryHandler(repository);
  });

  describe('Successful Retrieval', () => {
    it('should return streak data for existing user', async () => {
      // Setup: Create a streak
      const streak = UserStreak.create({
        userId,
        currentStreak: 5,
        longestStreak: 10,
        lastQualifiedDate: '2025-01-15',
        qualifiedDaysCount: 25,
        updatedAt: new Date('2025-01-15T12:00:00Z'),
      });

      await repository.save(streak);

      // Execute query
      const query = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId,
      });

      const result = await handler.execute(query);

      // Verify result
      expect(result).toEqual({
        userId,
        currentStreak: 5,
        longestStreak: 10,
        lastQualifiedDate: '2025-01-15',
        qualifiedDaysCount: 25,
      });
    });

    it('should return active streak with all metrics', async () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 30,
        longestStreak: 30,
        lastQualifiedDate: '2025-01-15',
        qualifiedDaysCount: 50,
        updatedAt: new Date('2025-01-15T12:00:00Z'),
      });

      await repository.save(streak);

      const query = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId,
      });

      const result = await handler.execute(query);

      expect(result.currentStreak).toBe(30);
      expect(result.longestStreak).toBe(30);
      expect(result.lastQualifiedDate).toBe('2025-01-15');
      expect(result.qualifiedDaysCount).toBe(50);
    });

    it('should return broken streak (currentStreak 0, but has history)', async () => {
      // User had a streak but it's now broken
      const streak = UserStreak.create({
        userId,
        currentStreak: 0,
        longestStreak: 15, // Previous record
        lastQualifiedDate: null,
        qualifiedDaysCount: 20,
        updatedAt: new Date('2025-01-15T12:00:00Z'),
      });

      await repository.save(streak);

      const query = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId,
      });

      const result = await handler.execute(query);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(15); // Historical best preserved
      expect(result.lastQualifiedDate).toBeNull();
      expect(result.qualifiedDaysCount).toBe(20);
    });
  });

  describe('Non-Existent User Handling', () => {
    it('should return zeros for user with no streak data', async () => {
      const nonExistentUserId = '660e8400-e29b-41d4-a716-446655440001';

      const query = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId: nonExistentUserId,
      });

      const result = await handler.execute(query);

      // Should return empty streak data
      expect(result).toEqual({
        userId: nonExistentUserId,
        currentStreak: 0,
        longestStreak: 0,
        lastQualifiedDate: null,
        qualifiedDaysCount: 0,
      });
    });

    it('should handle query for never-active user gracefully', async () => {
      const newUserId = '770e8400-e29b-41d4-a716-446655440002';

      const query = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId: newUserId,
      });

      const result = await handler.execute(query);

      expect(result.currentStreak).toBe(0);
      expect(result.longestStreak).toBe(0);
      expect(result.lastQualifiedDate).toBeNull();
      expect(result.qualifiedDaysCount).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should return fresh streak (first day)', async () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 1,
        longestStreak: 1,
        lastQualifiedDate: '2025-01-15',
        qualifiedDaysCount: 1,
        updatedAt: new Date('2025-01-15T12:00:00Z'),
      });

      await repository.save(streak);

      const query = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId,
      });

      const result = await handler.execute(query);

      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(1);
      expect(result.qualifiedDaysCount).toBe(1);
    });

    it('should handle very long streak (365+ days)', async () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 500,
        longestStreak: 500,
        lastQualifiedDate: '2026-05-15',
        qualifiedDaysCount: 550,
        updatedAt: new Date('2026-05-15T12:00:00Z'),
      });

      await repository.save(streak);

      const query = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId,
      });

      const result = await handler.execute(query);

      expect(result.currentStreak).toBe(500);
      expect(result.longestStreak).toBe(500);
      expect(result.qualifiedDaysCount).toBe(550);
    });

    it('should return streak where longestStreak > currentStreak', async () => {
      // Common scenario: user had long streak, broke it, rebuilding
      const streak = UserStreak.create({
        userId,
        currentStreak: 3,
        longestStreak: 25, // Previous personal best
        lastQualifiedDate: '2025-01-15',
        qualifiedDaysCount: 35,
        updatedAt: new Date('2025-01-15T12:00:00Z'),
      });

      await repository.save(streak);

      const query = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId,
      });

      const result = await handler.execute(query);

      expect(result.currentStreak).toBe(3);
      expect(result.longestStreak).toBe(25);
      expect(result.qualifiedDaysCount).toBe(35);
    });
  });

  describe('Multiple Users', () => {
    it('should return correct streak for each user independently', async () => {
      const user1Id = '550e8400-e29b-41d4-a716-446655440000';
      const user2Id = '660e8400-e29b-41d4-a716-446655440001';

      // Setup: Two users with different streaks
      const streak1 = UserStreak.create({
        userId: user1Id,
        currentStreak: 5,
        longestStreak: 10,
        lastQualifiedDate: '2025-01-15',
        qualifiedDaysCount: 20,
        updatedAt: new Date('2025-01-15T12:00:00Z'),
      });

      const streak2 = UserStreak.create({
        userId: user2Id,
        currentStreak: 15,
        longestStreak: 20,
        lastQualifiedDate: '2025-01-14',
        qualifiedDaysCount: 40,
        updatedAt: new Date('2025-01-14T12:00:00Z'),
      });

      await repository.save(streak1);
      await repository.save(streak2);

      // Query user 1
      const query1 = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId: user1Id,
      });
      const result1 = await handler.execute(query1);

      expect(result1.currentStreak).toBe(5);
      expect(result1.longestStreak).toBe(10);

      // Query user 2
      const query2 = new GetUserStreakQuery({
        correlationId: 'corr-2',
        userId: user2Id,
      });
      const result2 = await handler.execute(query2);

      expect(result2.currentStreak).toBe(15);
      expect(result2.longestStreak).toBe(20);
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent data across multiple queries', async () => {
      const streak = UserStreak.create({
        userId,
        currentStreak: 7,
        longestStreak: 12,
        lastQualifiedDate: '2025-01-15',
        qualifiedDaysCount: 30,
        updatedAt: new Date('2025-01-15T12:00:00Z'),
      });

      await repository.save(streak);

      // Execute same query multiple times
      const query = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId,
      });

      const result1 = await handler.execute(query);
      const result2 = await handler.execute(query);
      const result3 = await handler.execute(query);

      // All results should be identical (query is read-only)
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('should not modify repository state when querying', async () => {
      const initialStreak = UserStreak.create({
        userId,
        currentStreak: 10,
        longestStreak: 10,
        lastQualifiedDate: '2025-01-15',
        qualifiedDaysCount: 15,
        updatedAt: new Date('2025-01-15T12:00:00Z'),
      });

      await repository.save(initialStreak);

      // Query multiple times
      const query = new GetUserStreakQuery({
        correlationId: 'corr-1',
        userId,
      });

      await handler.execute(query);
      await handler.execute(query);
      await handler.execute(query);

      // Verify repository state unchanged
      const streakAfter = await repository.findByUserId(userId);
      expect(streakAfter?.currentStreak).toBe(10);
      expect(streakAfter?.longestStreak).toBe(10);
      expect(streakAfter?.lastQualifiedDate).toBe('2025-01-15');
    });
  });
});
