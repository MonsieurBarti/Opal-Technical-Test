import { Injectable, Inject } from '@nestjs/common';
import { IUserStreakRepository } from '../../domain/user-streak/user-streak.repository';
import { UserStreak } from '../../domain/user-streak/user-streak';
import { IDateProvider } from '@/util/date-provider/date.provider';
import { STREAKS_TOKENS } from '../../streaks.tokens';

@Injectable()
export class InMemoryUserStreakRepository implements IUserStreakRepository {
  private streaks = new Map<string, UserStreak>();

  constructor(
    @Inject(STREAKS_TOKENS.DATE_PROVIDER)
    private readonly dateProvider: IDateProvider,
  ) {}

  async save(streak: UserStreak): Promise<void> {
    this.streaks.set(streak.userId, streak);
  }

  async findByUserId(userId: string): Promise<UserStreak | null> {
    return this.streaks.get(userId) || null;
  }

  async findOrCreate(userId: string): Promise<UserStreak> {
    const existing = this.streaks.get(userId);
    if (existing) {
      return existing;
    }

    const newStreak = UserStreak.createNew(userId, this.dateProvider);
    this.streaks.set(userId, newStreak);
    return newStreak;
  }

  async getTopByQualifiedDays(limit: number): Promise<UserStreak[]> {
    const allStreaks = Array.from(this.streaks.values());
    return allStreaks
      .sort((a, b) => b.qualifiedDaysCount - a.qualifiedDaysCount)
      .slice(0, limit);
  }

  // Test helper methods
  clear(): void {
    this.streaks.clear();
  }

  getAll(): UserStreak[] {
    return Array.from(this.streaks.values());
  }
}
