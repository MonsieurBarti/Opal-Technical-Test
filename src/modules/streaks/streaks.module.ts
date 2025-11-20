import { Module } from '@nestjs/common';
import { PrismaModule } from '@/modules/shared/prisma/prisma.module';
import { STREAKS_TOKENS } from './streaks.tokens';

// Controllers
import { StreaksController } from './presentation/controllers/streaks.controller';

// Command Handlers
import { AcceptFocusSessionCommandHandler } from './application/commands/accept-focus-session/accept-focus-session.command';

// Query Handlers
import { GetUserStreakQueryHandler } from './application/queries/get-user-streak/get-user-streak.query';

// Repositories
import { SqlFocusSessionRepository } from './infrastructure/focus-session/sql-focus-session.repository';
import { SqlUserStreakRepository } from './infrastructure/user-streak/sql-user-streak.repository';

// Date Provider
import { OsDateProvider } from '@/util/date-provider/os-date.provider';

const commandHandlers = [AcceptFocusSessionCommandHandler];
const queryHandlers = [GetUserStreakQueryHandler];

@Module({
  imports: [PrismaModule],
  controllers: [StreaksController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    {
      provide: STREAKS_TOKENS.FOCUS_SESSION_REPOSITORY,
      useClass: SqlFocusSessionRepository,
    },
    {
      provide: STREAKS_TOKENS.USER_STREAK_REPOSITORY,
      useClass: SqlUserStreakRepository,
    },
    {
      provide: STREAKS_TOKENS.DATE_PROVIDER,
      useClass: OsDateProvider,
    },
  ],
  exports: [
    STREAKS_TOKENS.FOCUS_SESSION_REPOSITORY,
    STREAKS_TOKENS.USER_STREAK_REPOSITORY,
  ],
})
export class StreaksModule {}
