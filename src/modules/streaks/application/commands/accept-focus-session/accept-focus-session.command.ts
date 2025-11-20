import { TypedCommand } from '@/modules/shared/cqrs';
import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { STREAKS_TOKENS } from '@/modules/streaks/streaks.tokens';
import { IFocusSessionRepository } from '@/modules/streaks/domain/focus-session/focus-session.repository';
import { IUserStreakRepository } from '@/modules/streaks/domain/user-streak/user-streak.repository';
import { FocusSession } from '@/modules/streaks/domain/focus-session/focus-session';
import { IDateProvider } from '@/util/date-provider/date.provider';

export type AcceptFocusSessionCommandProps = {
  correlationId: string;
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
};

export class AcceptFocusSessionCommand extends TypedCommand<void> {
  constructor(public readonly props: AcceptFocusSessionCommandProps) {
    super();
  }
}

@CommandHandler(AcceptFocusSessionCommand)
export class AcceptFocusSessionCommandHandler
  implements ICommandHandler<AcceptFocusSessionCommand>
{
  private readonly QUALIFIED_DAY_THRESHOLD_MINUTES = 30;

  constructor(
    @Inject(STREAKS_TOKENS.FOCUS_SESSION_REPOSITORY)
    private readonly sessionRepository: IFocusSessionRepository,
    @Inject(STREAKS_TOKENS.USER_STREAK_REPOSITORY)
    private readonly streakRepository: IUserStreakRepository,
    @Inject(STREAKS_TOKENS.DATE_PROVIDER)
    private readonly dateProvider: IDateProvider,
  ) {}

  async execute(command: AcceptFocusSessionCommand): Promise<void> {
    const { sessionId, userId, startTime, endTime, timezone } = command.props;

    // 1. Check idempotency - if session already exists, return early
    const existingSession = await this.sessionRepository.findById(sessionId);
    if (existingSession) {
      // Already processed - idempotent return
      return;
    }

    // 2. Create focus session entity
    const session = FocusSession.createNew(
      sessionId,
      userId,
      startTime,
      endTime,
      timezone,
      this.dateProvider,
    );

    // 3. Split session across day boundaries if needed
    const sessionSegments = session.splitByDay(this.dateProvider);

    // 4. Save all session segments
    for (const segment of sessionSegments) {
      await this.sessionRepository.save(segment);
    }

    // 5. Update user streak based on qualified days
    await this.updateUserStreak(userId, sessionSegments, timezone);
  }

  /**
   * Updates the user's streak based on newly qualified days from the session segments.
   * A qualified day is any day where total focus time >= 30 minutes.
   */
  private async updateUserStreak(
    userId: string,
    sessionSegments: FocusSession[],
    timezone: string,
  ): Promise<void> {
    // Get or create user streak
    const userStreak = await this.streakRepository.findOrCreate(userId);

    // Group sessions by date and check if each date qualifies
    const dateSet = new Set<string>();
    for (const segment of sessionSegments) {
      dateSet.add(segment.getQualifiedDate(this.dateProvider));
    }

    const uniqueDates = Array.from(dateSet).sort();

    // For each unique date, check if total minutes >= threshold
    for (const date of uniqueDates) {
      const totalMinutes = await this.sessionRepository.getTotalMinutesForDate(
        userId,
        date,
        timezone,
      );

      if (totalMinutes >= this.QUALIFIED_DAY_THRESHOLD_MINUTES) {
        // This date qualifies - update streak
        userStreak.updateWithQualifiedDate(date, this.dateProvider);
      }
    }

    // Save updated streak
    await this.streakRepository.save(userStreak);
  }
}
