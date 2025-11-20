import { TypedQuery } from '@/modules/shared/cqrs';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { STREAKS_TOKENS } from '@/modules/streaks/streaks.tokens';
import { IUserStreakRepository } from '@/modules/streaks/domain/user-streak/user-streak.repository';

export type GetUserStreakQueryProps = {
  correlationId: string;
  userId: string;
};

export type UserStreakResult = {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastQualifiedDate: string | null;
  qualifiedDaysCount: number;
};

export class GetUserStreakQuery extends TypedQuery<UserStreakResult> {
  constructor(public readonly props: GetUserStreakQueryProps) {
    super();
  }
}

@QueryHandler(GetUserStreakQuery)
export class GetUserStreakQueryHandler
  implements IQueryHandler<GetUserStreakQuery>
{
  constructor(
    @Inject(STREAKS_TOKENS.USER_STREAK_REPOSITORY)
    private readonly streakRepository: IUserStreakRepository,
  ) {}

  async execute(query: GetUserStreakQuery): Promise<UserStreakResult> {
    const { userId } = query.props;

    // Find user streak
    const streak = await this.streakRepository.findByUserId(userId);

    // If no streak exists, return empty/zero values
    if (!streak) {
      return {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastQualifiedDate: null,
        qualifiedDaysCount: 0,
      };
    }

    // Return streak data
    return {
      userId: streak.userId,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      lastQualifiedDate: streak.lastQualifiedDate,
      qualifiedDaysCount: streak.qualifiedDaysCount,
    };
  }
}
