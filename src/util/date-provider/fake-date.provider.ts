import { Injectable } from '@nestjs/common';
import { IDateProvider } from './date.provider';
import {
  differenceInCalendarDays,
  differenceInMinutes,
  formatISO,
  startOfDay,
  endOfDay,
  addDays,
  isBefore,
  isAfter,
  parseISO,
  format,
} from 'date-fns';
import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';

@Injectable()
export class FakeDateProvider implements IDateProvider {
  private _now: Date = new Date();

  setNow(now: Date): void {
    this._now = now;
  }

  now(): Date {
    return this._now;
  }

  nowWithTimezone(timezone: string): Date {
    return toZonedTime(this._now, timezone);
  }

  startOfDay(date: Date): Date {
    return startOfDay(date);
  }

  endOfDay(date: Date): Date {
    return endOfDay(date);
  }

  differenceInCalendarDays(dateLeft: Date, dateRight: Date): number {
    return differenceInCalendarDays(dateLeft, dateRight);
  }

  differenceInMinutes(dateLeft: Date, dateRight: Date): number {
    return differenceInMinutes(dateLeft, dateRight);
  }

  getIsoDateString(date: Date): string {
    return formatISO(date);
  }

  toZonedTime(date: Date, timezone: string): Date {
    return toZonedTime(date, timezone);
  }

  fromZonedTime(date: Date, timezone: string): Date {
    return fromZonedTime(date, timezone);
  }

  addDays(date: Date, amount: number): Date {
    return addDays(date, amount);
  }

  isBefore(date: Date, dateToCompare: Date): boolean {
    return isBefore(date, dateToCompare);
  }

  isAfter(date: Date, dateToCompare: Date): boolean {
    return isAfter(date, dateToCompare);
  }

  parseISO(dateString: string): Date {
    return parseISO(dateString);
  }

  format(
    date: Date,
    formatStr: string,
    options?: { timeZone?: string },
  ): string {
    if (options?.timeZone) {
      return formatTz(date, formatStr, { timeZone: options.timeZone });
    }
    return format(date, formatStr);
  }
}
