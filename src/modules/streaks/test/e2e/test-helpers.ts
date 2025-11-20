import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

/**
 * Factory for creating test users in the database
 */
export async function createTestUser(
  prisma: PrismaClient,
  overrides?: { id?: string; timezone?: string },
): Promise<{ id: string; timezone: string }> {
  const user = await prisma.user.create({
    data: {
      id: overrides?.id || randomUUID(),
      timezone: overrides?.timezone || 'America/New_York',
    },
  });

  return user;
}

/**
 * Test data factory for focus session requests
 */
export function createFocusSessionRequest(overrides?: {
  sessionId?: string;
  userId?: string;
  startTime?: string;
  endTime?: string;
  timezone?: string;
}): {
  sessionId: string;
  userId: string;
  startTime: string;
  endTime: string;
  timezone: string;
} {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    sessionId: overrides?.sessionId || `session-${randomUUID()}`,
    userId: overrides?.userId || randomUUID(),
    startTime: overrides?.startTime || now.toISOString(),
    endTime: overrides?.endTime || oneHourLater.toISOString(),
    timezone: overrides?.timezone || 'America/New_York',
  };
}

/**
 * Create a focus session that crosses midnight (multi-day session)
 */
export function createMultiDaySessionRequest(
  userId: string,
  timezone: string = 'America/New_York',
): {
  sessionId: string;
  userId: string;
  startTime: string;
  endTime: string;
  timezone: string;
} {
  // 11:00 PM to 1:00 AM (crosses midnight)
  const startTime = new Date('2025-01-15T23:00:00-05:00'); // 11 PM EST
  const endTime = new Date('2025-01-16T01:00:00-05:00'); // 1 AM EST next day

  return {
    sessionId: `multi-day-${randomUUID()}`,
    userId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    timezone,
  };
}

/**
 * Create sessions for consecutive days to build a streak
 */
export function createConsecutiveDaysSessions(
  userId: string,
  days: number,
  startDate: Date = new Date('2025-01-10T10:00:00-05:00'),
  timezone: string = 'America/New_York',
): Array<{
  sessionId: string;
  userId: string;
  startTime: string;
  endTime: string;
  timezone: string;
}> {
  const sessions = [];

  for (let i = 0; i < days; i++) {
    const sessionStart = new Date(startDate);
    sessionStart.setDate(sessionStart.getDate() + i);

    const sessionEnd = new Date(sessionStart);
    sessionEnd.setMinutes(sessionEnd.getMinutes() + 45); // 45 minutes (above threshold)

    sessions.push({
      sessionId: `consecutive-day-${i}-${randomUUID()}`,
      userId,
      startTime: sessionStart.toISOString(),
      endTime: sessionEnd.toISOString(),
      timezone,
    });
  }

  return sessions;
}

/**
 * Create a session below the 30-minute threshold
 */
export function createBelowThresholdSession(
  userId: string,
  timezone: string = 'America/New_York',
): {
  sessionId: string;
  userId: string;
  startTime: string;
  endTime: string;
  timezone: string;
} {
  const startTime = new Date('2025-01-15T10:00:00-05:00');
  const endTime = new Date(startTime);
  endTime.setMinutes(endTime.getMinutes() + 25); // 25 minutes (below threshold)

  return {
    sessionId: `below-threshold-${randomUUID()}`,
    userId,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    timezone,
  };
}

/**
 * Create sessions with a gap (to break streak)
 */
export function createSessionsWithGap(
  userId: string,
  timezone: string = 'America/New_York',
): Array<{
  sessionId: string;
  userId: string;
  startTime: string;
  endTime: string;
  timezone: string;
}> {
  // Day 1
  const day1Start = new Date('2025-01-10T10:00:00-05:00');
  const day1End = new Date(day1Start);
  day1End.setMinutes(day1End.getMinutes() + 45);

  // Day 2
  const day2Start = new Date('2025-01-11T10:00:00-05:00');
  const day2End = new Date(day2Start);
  day2End.setMinutes(day2End.getMinutes() + 45);

  // Gap: Day 3 missing

  // Day 4 (should reset streak)
  const day4Start = new Date('2025-01-13T10:00:00-05:00');
  const day4End = new Date(day4Start);
  day4End.setMinutes(day4End.getMinutes() + 45);

  return [
    {
      sessionId: `gap-day1-${randomUUID()}`,
      userId,
      startTime: day1Start.toISOString(),
      endTime: day1End.toISOString(),
      timezone,
    },
    {
      sessionId: `gap-day2-${randomUUID()}`,
      userId,
      startTime: day2Start.toISOString(),
      endTime: day2End.toISOString(),
      timezone,
    },
    {
      sessionId: `gap-day4-${randomUUID()}`,
      userId,
      startTime: day4Start.toISOString(),
      endTime: day4End.toISOString(),
      timezone,
    },
  ];
}

/**
 * Helper to wait for a short period (useful for async operations)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
