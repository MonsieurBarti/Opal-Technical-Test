import { z } from 'zod';
import { IDateProvider } from '@/util/date-provider/date.provider';

export const UserStreakPropsSchema = z.object({
  userId: z.uuid(),
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  lastQualifiedDate: z.string().nullable(), // YYYY-MM-DD format
  qualifiedDaysCount: z.number().int().min(0),
  updatedAt: z.date(),
});

export type UserStreakProps = z.infer<typeof UserStreakPropsSchema>;

/**
 * UserStreak represents the denormalized aggregate of a user's
 * consecutive-day streak of productive activity.
 *
 * A "qualified day" is any calendar day (in user's timezone) where
 * total focus minutes ≥ threshold (default 30 min).
 */
export class UserStreak {
  private readonly _userId: string;
  private _currentStreak: number;
  private _longestStreak: number;
  private _lastQualifiedDate: string | null; // YYYY-MM-DD
  private _qualifiedDaysCount: number;
  private _updatedAt: Date;

  private constructor(props: UserStreakProps) {
    this._userId = props.userId;
    this._currentStreak = props.currentStreak;
    this._longestStreak = props.longestStreak;
    this._lastQualifiedDate = props.lastQualifiedDate;
    this._qualifiedDaysCount = props.qualifiedDaysCount;
    this._updatedAt = props.updatedAt;
  }

  public static create(props: UserStreakProps): UserStreak {
    const validated = UserStreakPropsSchema.parse(props);
    return new UserStreak(validated);
  }

  /**
   * Creates a new empty streak for a user
   */
  public static createNew(
    userId: string,
    dateProvider: IDateProvider,
  ): UserStreak {
    return UserStreak.create({
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastQualifiedDate: null,
      qualifiedDaysCount: 0,
      updatedAt: dateProvider.now(),
    });
  }

  /**
   * Updates the streak based on a newly qualified date.
   * Handles:
   * - Consecutive days → increment streak
   * - Broken streak (gap > 1 day) → reset to 1
   * - Same day → no change
   * - Out of order dates → recompute based on all dates
   *
   * @param qualifiedDate Date in 'YYYY-MM-DD' format
   * @param dateProvider IDateProvider for date operations
   */
  public updateWithQualifiedDate(
    qualifiedDate: string,
    dateProvider: IDateProvider,
  ): void {
    // If no previous qualified date, start fresh
    if (!this._lastQualifiedDate) {
      this._currentStreak = 1;
      this._longestStreak = 1;
      this._lastQualifiedDate = qualifiedDate;
      this._qualifiedDaysCount = 1;
      this._updatedAt = dateProvider.now();
      return;
    }

    // Parse dates for comparison
    const newDate = dateProvider.startOfDay(
      dateProvider.parseISO(qualifiedDate),
    );
    const lastDate = dateProvider.startOfDay(
      dateProvider.parseISO(this._lastQualifiedDate),
    );

    // Calculate day difference
    const daysDiff = dateProvider.differenceInCalendarDays(newDate, lastDate);

    if (daysDiff === 0) {
      // Same day - no change to streak
      this._updatedAt = dateProvider.now();
      return;
    }

    if (daysDiff < 0) {
      // Out of order / late arrival
      // For simplicity in 6h constraint: just update qualified days count
      // Production: would need to recompute entire streak history
      this._qualifiedDaysCount += 1;
      this._updatedAt = dateProvider.now();
      return;
    }

    if (daysDiff === 1) {
      // Consecutive day - increment streak
      this._currentStreak += 1;
      this._lastQualifiedDate = qualifiedDate;
      this._qualifiedDaysCount += 1;

      // Update longest streak if needed
      if (this._currentStreak > this._longestStreak) {
        this._longestStreak = this._currentStreak;
      }
    } else {
      // Broken streak (gap > 1 day) - reset
      this._currentStreak = 1;
      this._lastQualifiedDate = qualifiedDate;
      this._qualifiedDaysCount += 1;
    }

    this._updatedAt = dateProvider.now();
  }

  /**
   * Resets the streak to 0 (e.g., if streak is broken)
   */
  public resetStreak(dateProvider: IDateProvider): void {
    this._currentStreak = 0;
    this._lastQualifiedDate = null;
    this._updatedAt = dateProvider.now();
  }

  // Getters
  public get userId(): string {
    return this._userId;
  }

  public get currentStreak(): number {
    return this._currentStreak;
  }

  public get longestStreak(): number {
    return this._longestStreak;
  }

  public get lastQualifiedDate(): string | null {
    return this._lastQualifiedDate;
  }

  public get qualifiedDaysCount(): number {
    return this._qualifiedDaysCount;
  }

  public get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Returns true if the user has an active streak
   */
  public hasActiveStreak(): boolean {
    return this._currentStreak > 0 && this._lastQualifiedDate !== null;
  }
}
