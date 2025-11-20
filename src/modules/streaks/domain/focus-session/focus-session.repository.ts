import { FocusSession } from './focus-session';

export interface IFocusSessionRepository {
  /**
   * Saves a focus session. Throws error if sessionId already exists.
   */
  save(session: FocusSession): Promise<void>;

  /**
   * Finds a session by its ID (for idempotency checking).
   */
  findById(sessionId: string): Promise<FocusSession | null>;

  /**
   * Finds all sessions for a user within a date range (inclusive).
   * Dates should be in 'YYYY-MM-DD' format in the user's timezone.
   */
  findByUserAndDateRange(
    userId: string,
    startDate: string,
    endDate: string,
    timezone: string,
  ): Promise<FocusSession[]>;

  /**
   * Gets total focus minutes for a specific user on a specific date.
   * Date should be in 'YYYY-MM-DD' format in the user's timezone.
   */
  getTotalMinutesForDate(
    userId: string,
    date: string,
    timezone: string,
  ): Promise<number>;
}
