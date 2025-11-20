import { BaseDomainError } from '@/modules/shared/errors/base-domain.error';

export class UserStreakNotFoundError extends BaseDomainError {
  readonly errorCode = 'USER_STREAK_NOT_FOUND';

  constructor(userId: string) {
    super(`User streak for user "${userId}" not found`, {
      shouldReport: false,
      metadata: { userId },
    });
  }
}

export class InvalidUserStreakError extends BaseDomainError {
  readonly errorCode = 'INVALID_USER_STREAK';

  constructor(message: string) {
    super(`Invalid user streak: ${message}`, {
      shouldReport: false,
    });
  }
}
