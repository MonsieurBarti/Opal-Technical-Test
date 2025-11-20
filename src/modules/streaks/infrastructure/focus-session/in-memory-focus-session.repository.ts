import { Injectable, Inject } from '@nestjs/common';
import { IFocusSessionRepository } from '../../domain/focus-session/focus-session.repository';
import { FocusSession } from '../../domain/focus-session/focus-session';
import { FocusSessionAlreadyExistsError } from '../../domain/focus-session/focus-session.errors';
import { IDateProvider } from '@/util/date-provider/date.provider';
import { STREAKS_TOKENS } from '../../streaks.tokens';

@Injectable()
export class InMemoryFocusSessionRepository implements IFocusSessionRepository {
  private sessions = new Map<string, FocusSession>();

  constructor(
    @Inject(STREAKS_TOKENS.DATE_PROVIDER)
    private readonly dateProvider: IDateProvider,
  ) {}

  async save(session: FocusSession): Promise<void> {
    if (this.sessions.has(session.sessionId)) {
      throw new FocusSessionAlreadyExistsError(session.sessionId);
    }
    this.sessions.set(session.sessionId, session);
  }

  async findById(sessionId: string): Promise<FocusSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async findByUserAndDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    _timezone: string,
  ): Promise<FocusSession[]> {
    const sessions: FocusSession[] = [];

    for (const session of this.sessions.values()) {
      if (session.userId !== userId) continue;

      const sessionDate = session.getQualifiedDate(this.dateProvider);
      if (sessionDate >= startDate && sessionDate <= endDate) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  async getTotalMinutesForDate(
    userId: string,
    date: string,
    _timezone: string,
  ): Promise<number> {
    let totalMinutes = 0;

    for (const session of this.sessions.values()) {
      if (session.userId !== userId) continue;
      if (session.getQualifiedDate(this.dateProvider) === date) {
        totalMinutes += session.durationMinutes;
      }
    }

    return totalMinutes;
  }

  // Test helper methods
  clear(): void {
    this.sessions.clear();
  }

  getAll(): FocusSession[] {
    return Array.from(this.sessions.values());
  }
}
