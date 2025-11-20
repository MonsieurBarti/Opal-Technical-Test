import { FocusSession as PrismaFocusSession } from '@prisma/client';
import { FocusSession } from '../../domain/focus-session/focus-session';

export class SqlFocusSessionMapper {
  static toDomain(prisma: PrismaFocusSession): FocusSession {
    return FocusSession.create({
      sessionId: prisma.session_id,
      userId: prisma.user_id,
      startTime: prisma.start_time,
      endTime: prisma.end_time,
      durationMinutes: prisma.duration_minutes,
      timezone: prisma.timezone,
      createdAt: prisma.created_at,
    });
  }

  static toPrisma(
    domain: FocusSession,
  ): Omit<PrismaFocusSession, 'created_at'> & { created_at?: Date } {
    return {
      session_id: domain.sessionId,
      user_id: domain.userId,
      start_time: domain.startTime,
      end_time: domain.endTime,
      duration_minutes: domain.durationMinutes,
      timezone: domain.timezone,
      created_at: domain.createdAt,
    };
  }
}
