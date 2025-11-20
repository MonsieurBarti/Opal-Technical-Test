import { BaseDomainError } from '@/modules/shared/errors/base-domain.error';

export class FocusSessionAlreadyExistsError extends BaseDomainError {
  readonly errorCode = 'FOCUS_SESSION_ALREADY_EXISTS';

  constructor(sessionId: string) {
    super(`Focus session with ID "${sessionId}" already exists`, {
      shouldReport: false,
      metadata: { sessionId },
    });
  }
}

export class FocusSessionNotFoundError extends BaseDomainError {
  readonly errorCode = 'FOCUS_SESSION_NOT_FOUND';

  constructor(sessionId: string) {
    super(`Focus session with ID "${sessionId}" not found`, {
      shouldReport: false,
      metadata: { sessionId },
    });
  }
}

export class InvalidFocusSessionError extends BaseDomainError {
  readonly errorCode = 'INVALID_FOCUS_SESSION';

  constructor(message: string) {
    super(`Invalid focus session: ${message}`, {
      shouldReport: false,
    });
  }
}
