import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@/modules/shared/prisma/prisma.service';
import { IUserStreakRepository } from '../../domain/user-streak/user-streak.repository';
import { UserStreak } from '../../domain/user-streak/user-streak';
import { SqlUserStreakMapper } from './sql-user-streak.mapper';
import { IDateProvider } from '@/util/date-provider/date.provider';
import { STREAKS_TOKENS } from '../../streaks.tokens';

@Injectable()
export class SqlUserStreakRepository implements IUserStreakRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STREAKS_TOKENS.DATE_PROVIDER)
    private readonly dateProvider: IDateProvider,
  ) {}

  async save(streak: UserStreak): Promise<void> {
    const data = SqlUserStreakMapper.toPrisma(streak);

    await this.prisma.userStreak.upsert({
      where: { user_id: streak.userId },
      create: data,
      update: data,
    });
  }

  async findByUserId(userId: string): Promise<UserStreak | null> {
    const prismaStreak = await this.prisma.userStreak.findUnique({
      where: { user_id: userId },
    });

    return prismaStreak ? SqlUserStreakMapper.toDomain(prismaStreak) : null;
  }

  async findOrCreate(userId: string): Promise<UserStreak> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const newStreak = UserStreak.createNew(userId, this.dateProvider);
    await this.save(newStreak);
    return newStreak;
  }

  async getTopByQualifiedDays(limit: number): Promise<UserStreak[]> {
    const prismaStreaks = await this.prisma.userStreak.findMany({
      orderBy: { qualified_days_count: 'desc' },
      take: limit,
    });

    return prismaStreaks.map(SqlUserStreakMapper.toDomain);
  }
}
