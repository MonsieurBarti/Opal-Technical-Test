import { z } from 'zod';
import { IDateProvider } from '@/util/date-provider/date.provider';

export const FocusSessionPropsSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.uuid(),
  startTime: z.date(),
  endTime: z.date(),
  durationMinutes: z.number().int().positive(),
  timezone: z.string().min(1), // IANA timezone
  createdAt: z.date(),
});

export type FocusSessionProps = z.infer<typeof FocusSessionPropsSchema>;

/**
 * FocusSession represents a single focus/productivity session
 * recorded by a user. Sessions are immutable events that get
 * split across calendar day boundaries in the user's timezone.
 */
export class FocusSession {
  private readonly _sessionId: string;
  private readonly _userId: string;
  private readonly _startTime: Date; // UTC
  private readonly _endTime: Date; // UTC
  private readonly _durationMinutes: number;
  private readonly _timezone: string; // IANA timezone
  private readonly _createdAt: Date;

  private constructor(props: FocusSessionProps) {
    this._sessionId = props.sessionId;
    this._userId = props.userId;
    this._startTime = props.startTime;
    this._endTime = props.endTime;
    this._durationMinutes = props.durationMinutes;
    this._timezone = props.timezone;
    this._createdAt = props.createdAt;
  }

  public static create(props: FocusSessionProps): FocusSession {
    const validated = FocusSessionPropsSchema.parse(props);

    // Business rule: endTime must be after startTime
    if (validated.endTime <= validated.startTime) {
      throw new Error('End time must be after start time');
    }

    return new FocusSession(validated);
  }

  /**
   * Creates a new FocusSession from user input.
   * Calculates duration using the provided dateProvider.
   */
  public static createNew(
    sessionId: string,
    userId: string,
    startTime: Date,
    endTime: Date,
    timezone: string,
    dateProvider: IDateProvider,
  ): FocusSession {
    const durationMinutes = dateProvider.differenceInMinutes(
      endTime,
      startTime,
    );

    return FocusSession.create({
      sessionId,
      userId,
      startTime, // Assuming already in UTC from client
      endTime, // Assuming already in UTC from client
      durationMinutes,
      timezone,
      createdAt: dateProvider.now(),
    });
  }

  /**
   * Splits a focus session across calendar day boundaries in the user's timezone.
   * Example: A session from 11:30 PM to 12:30 AM becomes two sessions:
   * - Session 1: 11:30 PM - 11:59:59 PM (Day 1)
   * - Session 2: 12:00 AM - 12:30 AM (Day 2)
   *
   * Returns array of sessions, each confined to a single calendar day.
   */
  public splitByDay(dateProvider: IDateProvider): FocusSession[] {
    // Convert UTC times to user's timezone for day boundary logic
    const zonedStart = dateProvider.toZonedTime(
      this._startTime,
      this._timezone,
    );
    const zonedEnd = dateProvider.toZonedTime(this._endTime, this._timezone);

    // Get day boundaries in user's timezone
    const startDayEnd = dateProvider.endOfDay(zonedStart);

    // Check if session spans multiple calendar days
    const spansMultipleDays = dateProvider.isAfter(zonedEnd, startDayEnd);

    if (!spansMultipleDays) {
      // Session is within a single calendar day
      return [this];
    }

    // Split session across day boundaries
    const sessions: FocusSession[] = [];
    let currentStart = zonedStart;
    let segmentIndex = 0;

    while (dateProvider.isBefore(currentStart, zonedEnd)) {
      const currentDayEnd = dateProvider.endOfDay(currentStart);
      const currentEnd = dateProvider.isBefore(currentDayEnd, zonedEnd)
        ? currentDayEnd
        : zonedEnd;

      // Convert back to UTC for storage
      const utcSegmentStart = dateProvider.fromZonedTime(
        currentStart,
        this._timezone,
      );
      const utcSegmentEnd = dateProvider.fromZonedTime(
        currentEnd,
        this._timezone,
      );
      const segmentDuration = dateProvider.differenceInMinutes(
        utcSegmentEnd,
        utcSegmentStart,
      );

      // Create session segment with unique ID
      const segmentSessionId = `${this._sessionId}-day${segmentIndex}`;

      sessions.push(
        FocusSession.create({
          sessionId: segmentSessionId,
          userId: this._userId,
          startTime: utcSegmentStart,
          endTime: utcSegmentEnd,
          durationMinutes: segmentDuration,
          timezone: this._timezone,
          createdAt: this._createdAt,
        }),
      );

      // Move to next day
      currentStart = dateProvider.addDays(
        dateProvider.startOfDay(currentStart),
        1,
      );
      segmentIndex++;
    }

    return sessions;
  }

  /**
   * Returns the calendar date (YYYY-MM-DD) in the user's timezone
   * for this session's start time.
   */
  public getQualifiedDate(dateProvider: IDateProvider): string {
    const zonedStart = dateProvider.toZonedTime(
      this._startTime,
      this._timezone,
    );
    return dateProvider.format(zonedStart, 'yyyy-MM-dd', {
      timeZone: this._timezone,
    });
  }

  // Getters
  public get sessionId(): string {
    return this._sessionId;
  }

  public get userId(): string {
    return this._userId;
  }

  public get startTime(): Date {
    return this._startTime;
  }

  public get endTime(): Date {
    return this._endTime;
  }

  public get durationMinutes(): number {
    return this._durationMinutes;
  }

  public get timezone(): string {
    return this._timezone;
  }

  public get createdAt(): Date {
    return this._createdAt;
  }
}
