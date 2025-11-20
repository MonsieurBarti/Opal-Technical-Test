/* eslint-disable no-console */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  setupTestContainer,
  teardownTestContainer,
  cleanDatabase,
  TestContainerSetup,
} from '../../test/e2e/testcontainers-setup';
import { createTestUser } from '../../test/e2e/test-helpers';
import { SqlUserStreakRepository } from './sql-user-streak.repository';
import { UserStreak } from '../../domain/user-streak/user-streak';
import { OsDateProvider } from '@/util/date-provider/os-date.provider';
import { PrismaService } from '@/modules/shared/prisma/prisma.service';

describe('SqlUserStreakRepository Integration Tests', () => {
  let testSetup: TestContainerSetup;
  let prisma: PrismaClient;
  let repository: SqlUserStreakRepository;
  let dateProvider: OsDateProvider;

  beforeAll(async () => {
    console.log('🚀 Starting user streak repository integration tests...');
    testSetup = await setupTestContainer();
    prisma = testSetup.prisma;
    dateProvider = new OsDateProvider();

    // Create repository with Prisma client
    const prismaService = prisma as unknown as PrismaService;
    repository = new SqlUserStreakRepository(prismaService, dateProvider);

    console.log('✅ User streak repository tests initialized');
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await teardownTestContainer();
    console.log('✅ User streak repository tests completed');
  });

  describe('save()', () => {
    it('should save a new user streak to the database', async () => {
      // Arrange
      const user = await createTestUser(prisma);
      const streak = UserStreak.createNew(user.id, dateProvider);

      // Act
      await repository.save(streak);

      // Assert
      const savedStreak = await prisma.userStreak.findUnique({
        where: { user_id: user.id },
      });
      expect(savedStreak).toBeDefined();
      expect(savedStreak?.user_id).toBe(user.id);
      expect(savedStreak?.current_streak).toBe(0);
      expect(savedStreak?.longest_streak).toBe(0);
    });

    it('should update an existing user streak', async () => {
      // Arrange
      const user = await createTestUser(prisma);
      const streak = UserStreak.createNew(user.id, dateProvider);
      await repository.save(streak);

      // Update the streak
      streak.updateWithQualifiedDate('2025-01-15', dateProvider);

      // Act
      await repository.save(streak);

      // Assert
      const updatedStreak = await prisma.userStreak.findUnique({
        where: { user_id: user.id },
      });
      expect(updatedStreak?.current_streak).toBe(1);
      expect(updatedStreak?.qualified_days_count).toBe(1);
    });
  });

  describe('findByUserId()', () => {
    it('should find a user streak by user ID', async () => {
      // Arrange
      const user = await createTestUser(prisma);
      const streak = UserStreak.createNew(user.id, dateProvider);
      await repository.save(streak);

      // Act
      const found = await repository.findByUserId(user.id);

      // Assert
      expect(found).toBeDefined();
      expect(found?.userId).toBe(user.id);
    });

    it('should return null for non-existent user streak', async () => {
      // Arrange
      const user = await createTestUser(prisma);

      // Act
      const found = await repository.findByUserId(user.id);

      // Assert
      expect(found).toBeNull();
    });
  });

  describe('findOrCreate()', () => {
    it('should return existing streak if it exists', async () => {
      // Arrange
      const user = await createTestUser(prisma);
      const streak = UserStreak.createNew(user.id, dateProvider);
      streak.updateWithQualifiedDate('2025-01-15', dateProvider);
      await repository.save(streak);

      // Act
      const found = await repository.findOrCreate(user.id);

      // Assert
      expect(found.userId).toBe(user.id);
      expect(found.currentStreak).toBe(1);
    });

    it('should create new streak if it does not exist', async () => {
      // Arrange
      const user = await createTestUser(prisma);

      // Act
      const streak = await repository.findOrCreate(user.id);

      // Assert
      expect(streak.userId).toBe(user.id);
      expect(streak.currentStreak).toBe(0);
      expect(streak.longestStreak).toBe(0);

      // Verify it was saved to database
      const savedStreak = await prisma.userStreak.findUnique({
        where: { user_id: user.id },
      });
      expect(savedStreak).toBeDefined();
    });
  });

  describe('getTopByQualifiedDays()', () => {
    it('should return top users by qualified days count', async () => {
      // Arrange
      const user1 = await createTestUser(prisma);
      const user2 = await createTestUser(prisma);
      const user3 = await createTestUser(prisma);

      const streak1 = UserStreak.createNew(user1.id, dateProvider);
      streak1.updateWithQualifiedDate('2025-01-15', dateProvider);
      streak1.updateWithQualifiedDate('2025-01-16', dateProvider);
      streak1.updateWithQualifiedDate('2025-01-17', dateProvider);
      await repository.save(streak1);

      const streak2 = UserStreak.createNew(user2.id, dateProvider);
      streak2.updateWithQualifiedDate('2025-01-15', dateProvider);
      streak2.updateWithQualifiedDate('2025-01-16', dateProvider);
      streak2.updateWithQualifiedDate('2025-01-17', dateProvider);
      streak2.updateWithQualifiedDate('2025-01-18', dateProvider);
      streak2.updateWithQualifiedDate('2025-01-19', dateProvider);
      await repository.save(streak2);

      const streak3 = UserStreak.createNew(user3.id, dateProvider);
      streak3.updateWithQualifiedDate('2025-01-15', dateProvider);
      await repository.save(streak3);

      // Act
      const topStreaks = await repository.getTopByQualifiedDays(2);

      // Assert
      expect(topStreaks).toHaveLength(2);
      expect(topStreaks[0].userId).toBe(user2.id);
      expect(topStreaks[0].qualifiedDaysCount).toBe(5);
      expect(topStreaks[1].userId).toBe(user1.id);
      expect(topStreaks[1].qualifiedDaysCount).toBe(3);
    });

    it('should return empty array when no streaks exist', async () => {
      // Act
      const topStreaks = await repository.getTopByQualifiedDays(10);

      // Assert
      expect(topStreaks).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      // Arrange
      const user1 = await createTestUser(prisma);
      const user2 = await createTestUser(prisma);
      const user3 = await createTestUser(prisma);

      for (const userId of [user1.id, user2.id, user3.id]) {
        const streak = UserStreak.createNew(userId, dateProvider);
        streak.updateWithQualifiedDate('2025-01-15', dateProvider);
        await repository.save(streak);
      }

      // Act
      const topStreaks = await repository.getTopByQualifiedDays(2);

      // Assert
      expect(topStreaks).toHaveLength(2);
    });
  });

  describe('Streak calculation logic', () => {
    it('should correctly track consecutive days', async () => {
      // Arrange
      const user = await createTestUser(prisma);
      const streak = UserStreak.createNew(user.id, dateProvider);

      // Act - Add consecutive days
      streak.updateWithQualifiedDate('2025-01-15', dateProvider);
      streak.updateWithQualifiedDate('2025-01-16', dateProvider);
      streak.updateWithQualifiedDate('2025-01-17', dateProvider);
      await repository.save(streak);

      // Assert
      const savedStreak = await repository.findByUserId(user.id);
      expect(savedStreak?.currentStreak).toBe(3);
      expect(savedStreak?.longestStreak).toBe(3);
      expect(savedStreak?.qualifiedDaysCount).toBe(3);
    });

    it('should reset streak when there is a gap', async () => {
      // Arrange
      const user = await createTestUser(prisma);
      const streak = UserStreak.createNew(user.id, dateProvider);

      // Act - Add days with a gap
      streak.updateWithQualifiedDate('2025-01-15', dateProvider);
      streak.updateWithQualifiedDate('2025-01-16', dateProvider);
      // Gap on Jan 17
      streak.updateWithQualifiedDate('2025-01-18', dateProvider);
      await repository.save(streak);

      // Assert
      const savedStreak = await repository.findByUserId(user.id);
      expect(savedStreak?.currentStreak).toBe(1); // Reset to 1
      expect(savedStreak?.longestStreak).toBe(2); // Previous streak was 2
      expect(savedStreak?.qualifiedDaysCount).toBe(3); // Total qualified days
    });

    it('should maintain longest streak correctly', async () => {
      // Arrange
      const user = await createTestUser(prisma);
      const streak = UserStreak.createNew(user.id, dateProvider);

      // Act - Build a 5-day streak, then reset, then build a 3-day streak
      for (let i = 10; i <= 14; i++) {
        streak.updateWithQualifiedDate(`2025-01-${i}`, dateProvider);
      }
      // Gap
      for (let i = 16; i <= 18; i++) {
        streak.updateWithQualifiedDate(`2025-01-${i}`, dateProvider);
      }
      await repository.save(streak);

      // Assert
      const savedStreak = await repository.findByUserId(user.id);
      expect(savedStreak?.currentStreak).toBe(3); // Current is 3
      expect(savedStreak?.longestStreak).toBe(5); // Longest was 5
      expect(savedStreak?.qualifiedDaysCount).toBe(8); // Total 8 days
    });
  });
});
