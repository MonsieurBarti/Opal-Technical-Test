import { UserStreak as PrismaUserStreak } from '@prisma/client';
import { UserStreak } from '../../domain/user-streak/user-streak';
import { format, parseISO } from 'date-fns';

export class SqlUserStreakMapper {
  static toDomain(prisma: PrismaUserStreak): UserStreak {
    return UserStreak.create({
      userId: prisma.user_id,
      currentStreak: prisma.current_streak,
      longestStreak: prisma.longest_streak,
      lastQualifiedDate: prisma.last_qualified_date
        ? format(prisma.last_qualified_date, 'yyyy-MM-dd')
        : null,
      qualifiedDaysCount: prisma.qualified_days_count,
      updatedAt: prisma.updated_at,
    });
  }

  static toPrisma(
    domain: UserStreak,
  ): Omit<PrismaUserStreak, 'updated_at'> & { updated_at?: Date } {
    return {
      user_id: domain.userId,
      current_streak: domain.currentStreak,
      longest_streak: domain.longestStreak,
      last_qualified_date: domain.lastQualifiedDate
        ? parseISO(domain.lastQualifiedDate)
        : null,
      qualified_days_count: domain.qualifiedDaysCount,
      updated_at: domain.updatedAt,
    };
  }
}
