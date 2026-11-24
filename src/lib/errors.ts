export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PRICE_CHANGED'
  | 'DATES_UNAVAILABLE'
  | 'REQUEST_EXPIRED'
  | 'INVALID_TRANSITION'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface StructuredErrorPayload {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

const DEFAULT_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PRICE_CHANGED: 409,
  DATES_UNAVAILABLE: 409,
  REQUEST_EXPIRED: 409,
  INVALID_TRANSITION: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
    status?: number
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status ?? DEFAULT_HTTP_STATUS[code];
    this.details = details;
  }

  toJSON(): StructuredErrorPayload {
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {}),
      },
    };
  }
}

const ERROR_MESSAGES: Record<ErrorCode, { en: string; vi: string }> = {
  VALIDATION_ERROR: {
    en: 'Please check your selected dates, guest count, or form fields.',
    vi: 'Vui lòng kiểm tra lại ngày, số khách hoặc thông tin đã nhập.',
  },
  UNAUTHORIZED: {
    en: 'Please sign in to continue with this action.',
    vi: 'Vui lòng đăng nhập để tiếp tục thao tác này.',
  },
  FORBIDDEN: {
    en: 'You do not have permission to view or modify this record.',
    vi: 'Bạn không có quyền xem hoặc chỉnh sửa dữ liệu này.',
  },
  NOT_FOUND: {
    en: 'The requested stay or record could not be found.',
    vi: 'Không tìm thấy chỗ ở hoặc bản ghi được yêu cầu.',
  },
  PRICE_CHANGED: {
    en: 'The host updated pricing since you opened review. Please confirm the updated breakdown before submitting.',
    vi: 'Giá phòng đã thay đổi sau bước xem lại. Vui lòng xác nhận lại bảng giá mới trước khi gửi.',
  },
  DATES_UNAVAILABLE: {
    en: 'Dates no longer available. Please choose different check-in and check-out dates.',
    vi: 'Các đêm bạn chọn không còn trống. Vui lòng chọn khoảng ngày khác.',
  },
  REQUEST_EXPIRED: {
    en: 'This booking request has passed its response deadline and can no longer be confirmed.',
    vi: 'Yêu cầu đặt phòng đã quá hạn phản hồi nên không thể xác nhận.',
  },
  INVALID_TRANSITION: {
    en: 'This booking status can no longer transition to the requested state.',
    vi: 'Trạng thái đơn hiện tại không thể thực hiện chuyển đổi này.',
  },
  RATE_LIMITED: {
    en: 'Too many requests in a short window. Please wait a moment and try again.',
    vi: 'Bạn thao tác quá nhanh. Vui lòng đợi giây lát rồi thử lại.',
  },
  INTERNAL_ERROR: {
    en: 'An unexpected server error occurred. Your inputs have been preserved; please try again.',
    vi: 'Đã xảy ra lỗi hệ thống. Dữ liệu bạn nhập vẫn được giữ lại, vui lòng thử lại.',
  },
};

export function localizeError(
  code: ErrorCode,
  locale: 'en' | 'vi' = 'en',
  fallbackMessage?: string
): string {
  return ERROR_MESSAGES[code]?.[locale] ?? fallbackMessage ?? ERROR_MESSAGES.INTERNAL_ERROR[locale];
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
