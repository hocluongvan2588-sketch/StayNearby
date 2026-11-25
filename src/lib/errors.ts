export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_WALLET'
  | 'UNAVAILABLE';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    status?: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.status =
      status ??
      (code === 'VALIDATION_ERROR'
        ? 400
        : code === 'UNAUTHORIZED'
          ? 401
          : code === 'FORBIDDEN'
            ? 403
            : code === 'NOT_FOUND'
              ? 404
              : code === 'CONFLICT' || code === 'UNAVAILABLE'
                ? 409
                : code === 'INSUFFICIENT_WALLET'
                  ? 402
                  : 500);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
