import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/modules/shared/prisma/prisma.service';
import { IFocusSessionRepository } from '../../domain/focus-session/focus-session.repository';
import { FocusSession } from '../../domain/focus-session/focus-session';
import { SqlFocusSessionMapper } from './sql-focus-session.mapper';
import { FocusSessionAlreadyExistsError } from '../../domain/focus-session/focus-session.errors';
import { Prisma } from '@prisma/client';
import { IDateProvider } from '@/util/date-provider/date.provider';
import { STREAKS_TOKENS } from '../../streaks.tokens';

@Injectable()
export class SqlFocusSessionRepository implements IFocusSessionRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STREAKS_TOKENS.DATE_PROVIDER)
    private readonly dateProvider: IDateProvider,
  ) {}

  async save(session: FocusSession): Promise<void> {
    try {
      const data = SqlFocusSessionMapper.toPrisma(session);
      await this.prisma.focusSession.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new FocusSessionAlreadyExistsError(session.sessionId);
      }
      throw error;
    }
  }

  async findById(sessionId: string): Promise<FocusSession | null> {
    const prismaSession = await this.prisma.focusSession.findUnique({
      where: { session_id: sessionId },
    });

    return prismaSession ? SqlFocusSessionMapper.toDomain(prismaSession) : null;
  }

  async findByUserAndDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    timezone: string,
  ): Promise<FocusSession[]> {
    // Convert date strings to UTC boundaries
    const startDayStart = this.dateProvider.fromZonedTime(
      this.dateProvider.startOfDay(this.dateProvider.parseISO(startDate)),
      timezone,
    );
    const endDayEnd = this.dateProvider.fromZonedTime(
      this.dateProvider.endOfDay(this.dateProvider.parseISO(endDate)),
      timezone,
    );

    const prismaSessions = await this.prisma.focusSession.findMany({
      where: {
        user_id: userId,
        start_time: {
          gte: startDayStart,
          lte: endDayEnd,
        },
      },
      orderBy: { start_time: 'asc' },
    });

    return prismaSessions.map(SqlFocusSessionMapper.toDomain);
  }

  async getTotalMinutesForDate(
    userId: string,
    date: string,
    timezone: string,
  ): Promise<number> {
    // Convert date to UTC boundaries for the given timezone
    const dayStart = this.dateProvider.fromZonedTime(
      this.dateProvider.startOfDay(this.dateProvider.parseISO(date)),
      timezone,
    );
    const dayEnd = this.dateProvider.fromZonedTime(
      this.dateProvider.endOfDay(this.dateProvider.parseISO(date)),
      timezone,
    );

    const result = await this.prisma.focusSession.aggregate({
      where: {
        user_id: userId,
        start_time: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      _sum: {
        duration_minutes: true,
      },
    });

    return result._sum.duration_minutes || 0;
  }
}
