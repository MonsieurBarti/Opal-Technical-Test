import { UserStreak } from './user-streak';

export interface IUserStreakRepository {
  /**
   * Saves or updates a user streak
   */
  save(streak: UserStreak): Promise<void>;

  /**
   * Finds a user's streak by user ID
   */
  findByUserId(userId: string): Promise<UserStreak | null>;

  /**
   * Finds or creates a user streak (convenience method)
   */
  findOrCreate(userId: string): Promise<UserStreak>;

  /**
   * Gets top N users by qualified days count (for leaderboard)
   */
  getTopByQualifiedDays(limit: number): Promise<UserStreak[]>;
}
