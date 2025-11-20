export interface IDateProvider {
  now(): Date;
  nowWithTimezone(timezone: string): Date;
  startOfDay(date: Date): Date;
  endOfDay(date: Date): Date;
  differenceInCalendarDays(dateLeft: Date, dateRight: Date): number;
  differenceInMinutes(dateLeft: Date, dateRight: Date): number;
  getIsoDateString(date: Date): string;

  // Timezone conversion
  toZonedTime(date: Date, timezone: string): Date;
  fromZonedTime(date: Date, timezone: string): Date;

  // Date manipulation
  addDays(date: Date, amount: number): Date;

  // Date comparison
  isBefore(date: Date, dateToCompare: Date): boolean;
  isAfter(date: Date, dateToCompare: Date): boolean;

  // Parsing and formatting
  parseISO(dateString: string): Date;
  format(
    date: Date,
    formatStr: string,
    options?: { timeZone?: string },
  ): string;
}
