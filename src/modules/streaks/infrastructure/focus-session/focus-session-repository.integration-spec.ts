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
import { SqlFocusSessionRepository } from './sql-focus-session.repository';
import { FocusSession } from '../../domain/focus-session/focus-session';
import { OsDateProvider } from '@/util/date-provider/os-date.provider';
import { PrismaService } from '@/modules/shared/prisma/prisma.service';

describe('SqlFocusSessionRepository Integration Tests', () => {
  let testSetup: TestContainerSetup;
  let prisma: PrismaClient;
  let repository: SqlFocusSessionRepository;
  let dateProvider: OsDateProvider;

  beforeAll(async () => {
    console.log('🚀 Starting repository integration tests...');
    testSetup = await setupTestContainer();
    prisma = testSetup.prisma;
    dateProvider = new OsDateProvider();

    // Create repository with Prisma client
    const prismaService = prisma as unknown as PrismaService;
    repository = new SqlFocusSessionRepository(prismaService, dateProvider);

    console.log('✅ Repository tests initialized');
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await teardownTestContainer();
    console.log('✅ Repository tests completed');
  });

  describe('save()', () => {
    it('should save a focus session to the database', async () => {
      // Arrange
      const user = await createTestUser(prisma);
      const session = FocusSession.createNew(
        'session-123',
        user.id,
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-15T11:00:00Z'),
        'America/New_York',
        dateProvider,
      );

      // Act
      await repository.save(session);

      // Assert
      const savedSession = await prisma.focusSession.findUnique({
        where: { session_id: 'session-123' },
      });
      expect(savedSession).toBeDefined();
      expect(savedSession?.user_id).toBe(user.id);
      expect(savedSession?.duration_minutes).toBe(60);
    });

    it('should throw error when saving duplicate session ID', async () => {
      // Arrange
      const user = await createTestUser(prisma);
      const session1 = FocusSession.createNew(
        'session-duplicate',
        user.id,
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-15T11:00:00Z'),
        'America/New_York',
        dateProvider,
      );
      const session2 = FocusSession.createNew(
        'session-duplicate',
        user.id,
        new Date('2025-01-15T12:00:00Z'),
        new Date('2025-01-15T13:00:00Z'),
        'America/New_York',
        dateProvider,
      );

      // Act
      await repository.save(session1);

      // Assert
      await expect(repository.save(session2)).rejects.toThrow();
    });
  });

  describe('findById()', () => {
    it('should find a session by ID', async () => {
      // Arrange
      const user = await createTestUser(prisma);
      const session = FocusSession.createNew(
        'session-find-123',
        user.id,
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-15T11:00:00Z'),
        'America/New_York',
        dateProvider,
      );
      await repository.save(session);

      // Act
      const found = await repository.findById('session-find-123');

      // Assert
      expect(found).toBeDefined();
      expect(found?.sessionId).toBe('session-find-123');
      expect(found?.userId).toBe(user.id);
    });

    it('should return null for non-existent session', async () => {
      // Act
      const found = await repository.findById('non-existent');

      // Assert
      expect(found).toBeNull();
    });
  });

  describe('getTotalMinutesForDate()', () => {
    it('should calculate total minutes for a specific date', async () => {
      // Arrange
      const user = await createTestUser(prisma, {
        timezone: 'America/New_York',
      });

      // Create two sessions on the same day
      const session1 = FocusSession.createNew(
        'session-1',
        user.id,
        new Date('2025-01-15T10:00:00-05:00'), // 10 AM EST
        new Date('2025-01-15T10:30:00-05:00'), // 10:30 AM EST (30 min)
        'America/New_York',
        dateProvider,
      );

      const session2 = FocusSession.createNew(
        'session-2',
        user.id,
        new Date('2025-01-15T14:00:00-05:00'), // 2 PM EST
        new Date('2025-01-15T14:45:00-05:00'), // 2:45 PM EST (45 min)
        'America/New_York',
        dateProvider,
      );

      await repository.save(session1);
      await repository.save(session2);

      // Act
      const totalMinutes = await repository.getTotalMinutesForDate(
        user.id,
        '2025-01-15',
        'America/New_York',
      );

      // Assert
      expect(totalMinutes).toBe(75); // 30 + 45 = 75 minutes
    });

    it('should return 0 for date with no sessions', async () => {
      // Arrange
      const user = await createTestUser(prisma);

      // Act
      const totalMinutes = await repository.getTotalMinutesForDate(
        user.id,
        '2025-01-15',
        'America/New_York',
      );

      // Assert
      expect(totalMinutes).toBe(0);
    });

    it('should only count sessions for the specific date in the given timezone', async () => {
      // Arrange
      const user = await createTestUser(prisma, {
        timezone: 'America/New_York',
      });

      // Session on Jan 15
      const session1 = FocusSession.createNew(
        'session-jan15',
        user.id,
        new Date('2025-01-15T10:00:00-05:00'),
        new Date('2025-01-15T11:00:00-05:00'), // 60 min
        'America/New_York',
        dateProvider,
      );

      // Session on Jan 16
      const session2 = FocusSession.createNew(
        'session-jan16',
        user.id,
        new Date('2025-01-16T10:00:00-05:00'),
        new Date('2025-01-16T11:00:00-05:00'), // 60 min
        'America/New_York',
        dateProvider,
      );

      await repository.save(session1);
      await repository.save(session2);

      // Act
      const totalMinutesJan15 = await repository.getTotalMinutesForDate(
        user.id,
        '2025-01-15',
        'America/New_York',
      );

      // Assert
      expect(totalMinutesJan15).toBe(60); // Only Jan 15 session
    });
  });

  describe('findByUserAndDateRange()', () => {
    it('should find sessions within a date range', async () => {
      // Arrange
      const user = await createTestUser(prisma);

      const session1 = FocusSession.createNew(
        'session-1',
        user.id,
        new Date('2025-01-10T10:00:00-05:00'),
        new Date('2025-01-10T11:00:00-05:00'),
        'America/New_York',
        dateProvider,
      );

      const session2 = FocusSession.createNew(
        'session-2',
        user.id,
        new Date('2025-01-12T10:00:00-05:00'),
        new Date('2025-01-12T11:00:00-05:00'),
        'America/New_York',
        dateProvider,
      );

      const session3 = FocusSession.createNew(
        'session-3',
        user.id,
        new Date('2025-01-15T10:00:00-05:00'),
        new Date('2025-01-15T11:00:00-05:00'),
        'America/New_York',
        dateProvider,
      );

      await repository.save(session1);
      await repository.save(session2);
      await repository.save(session3);

      // Act
      const sessions = await repository.findByUserAndDateRange(
        user.id,
        '2025-01-10',
        '2025-01-12',
        'America/New_York',
      );

      // Assert
      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionId).sort()).toEqual([
        'session-1',
        'session-2',
      ]);
    });

    it('should return empty array when no sessions in range', async () => {
      // Arrange
      const user = await createTestUser(prisma);

      // Act
      const sessions = await repository.findByUserAndDateRange(
        user.id,
        '2025-01-10',
        '2025-01-12',
        'America/New_York',
      );

      // Assert
      expect(sessions).toEqual([]);
    });
  });
});
