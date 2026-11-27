import type { Locale } from './i18n';

/**
 * Guest-facing server error localization.
 *
 * APIs return English AppError messages; guest UI maps them to natural
 * Vietnamese copy (and to canonical English wording where the content specs
 * mandate it) — see docs/content-design/MICROCOPY_PATTERNS.md §4 and
 * CONTENT_QA_CHECKLIST.md §5. Unmapped messages pass through unchanged.
 */

type ErrorCopyRule = {
  test: RegExp;
  vi: (m: RegExpMatchArray) => string;
  /** EN override when the spec wording differs from the server message. */
  en?: (m: RegExpMatchArray) => string;
};

const RULES: ErrorCopyRule[] = [
  // — Minimum stay (MICROCOPY §4) —
  {
    test: /^Selected dates require a minimum stay of (\d+) nights\.$/,
    vi: (m) => `Thời gian ở tối thiểu trên VietNomad là ${m[1]} đêm.`,
    en: (m) => `Stays on VietNomad require at least ${m[1]} nights.`,
  },
  // — Promotions (MICROCOPY §4) —
  {
    test: /^Promotion "([^"]+)" requires a stay of at least (\d+) nights\.$/,
    vi: (m) => `Mã ${m[1]} áp dụng cho đơn từ ${m[2]} đêm trở lên.`,
    en: (m) => `Code ${m[1]} requires at least ${m[2]} nights.`,
  },
  {
    test: /^Promotion(?: code)? "([^"]*)" does not exist\.$/,
    vi: (m) => `Mã giảm giá "${m[1]}" không tồn tại.`,
  },
  {
    test: /^Promotion "([^"]*)" is currently inactive\.$/,
    vi: (m) => `Mã giảm giá "${m[1]}" đang tạm ngưng.`,
  },
  {
    test: /^Promotion "([^"]*)" starts on ([\d-]+)\.$/,
    vi: (m) => `Mã giảm giá "${m[1]}" có hiệu lực từ ngày ${m[2]}.`,
  },
  {
    test: /^Promotion "([^"]*)" expired on ([\d-]+)\.$/,
    vi: (m) => `Mã giảm giá "${m[1]}" đã hết hạn ngày ${m[2]}.`,
  },
  {
    test: /^Promotion "([^"]*)" has reached its redemption limit\.$/,
    vi: (m) => `Mã giảm giá "${m[1]}" đã hết lượt sử dụng.`,
  },
  {
    test: /^Promotion "([^"]*)" is restricted to another member account\.$/,
    vi: (m) => `Mã giảm giá "${m[1]}" chỉ áp dụng cho tài khoản hội viên khác.`,
  },
  { test: /^Promotion code is empty\.$/, vi: () => 'Vui lòng nhập mã giảm giá.' },
  {
    test: /^Invalid promotion validation parameters\.$/,
    vi: () => 'Thông tin kiểm tra mã giảm giá không hợp lệ.',
  },
  // — Booking: dates & bounds —
  {
    test: /^Stay must be between (\d+) and (\d+) nights\.$/,
    vi: (m) => `Số đêm lưu trú phải từ ${m[1]} đến ${m[2]} đêm.`,
  },
  {
    test: /^Check-in date cannot be in the past\.$/,
    vi: () => 'Ngày nhận phòng không thể ở trong quá khứ.',
  },
  { test: /^Check-in date must be YYYY-MM-DD\.$/, vi: () => 'Ngày nhận phòng không hợp lệ.' },
  { test: /^Invalid booking details\.$/, vi: () => 'Thông tin đặt phòng không hợp lệ.' },
  {
    test: /^Invalid stay, room, or package (?:identifier|ID)\.$/,
    vi: () => 'Mã chỗ ở hoặc gói phòng không hợp lệ.',
  },
  {
    test: /^(?:Stay, room, or package|Stay package) not found\.$/,
    vi: () => 'Không tìm thấy chỗ ở hoặc gói phòng.',
  },
  {
    test: /^This stay package is currently unlisted\.$/,
    vi: () => 'Chỗ ở này hiện không nhận đặt phòng.',
  },
  {
    test: /^Package is only open for check-ins from ([\d-]+) to ([\d-]+)\.$/,
    vi: (m) => `Gói phòng chỉ nhận đặt cho ngày nhận phòng từ ${m[1]} đến ${m[2]}.`,
  },
  {
    test: /^Room accommodates up to (\d+) guests\.$/,
    vi: (m) => `Phòng tối đa ${m[1]} khách.`,
  },
  {
    test: /^Selected dates include sold-out or blocked inventory \(([\d-]+)\)\.$/,
    vi: (m) => `Ngày ${m[1]} đã kín phòng hoặc không khả dụng.`,
  },
  { test: /^Account not found\.$/, vi: () => 'Không tìm thấy tài khoản.' },
  // — Booking management (member dashboard) —
  { test: /^Booking not found\.$/, vi: () => 'Không tìm thấy đặt phòng.' },
  { test: /^Invalid booking id\.$/, vi: () => 'Mã đặt phòng không hợp lệ.' },
  {
    test: /^Only active reservations can be cancelled here\.$/,
    vi: () => 'Chỉ các đặt phòng đang hoạt động mới hủy được tại đây.',
  },
  {
    test: /^You cannot cancel another member['’]s booking\.$/,
    vi: () => 'Bạn không thể hủy đặt phòng của thành viên khác.',
  },
  {
    test: /^This booking does not require online payment\.$/,
    vi: () => 'Đặt phòng này không cần thanh toán online.',
  },
  {
    test: /^You cannot pay for another member['’]s booking\.$/,
    vi: () => 'Bạn không thể thanh toán cho đặt phòng của thành viên khác.',
  },
  // — Auth —
  { test: /^Invalid email or password\.$/, vi: () => 'Email hoặc mật khẩu chưa đúng.' },
  {
    test: /^Please enter a valid email and password\.$/,
    vi: () => 'Vui lòng nhập email và mật khẩu hợp lệ.',
  },
  {
    test: /^Name, email, and 8\+ character password are required\.$/,
    vi: () => 'Vui lòng nhập tên, email và mật khẩu từ 8 ký tự trở lên.',
  },
  {
    test: /^An account with this email already exists\.$/,
    vi: () => 'Tài khoản với email này đã tồn tại.',
  },
  { test: /^Please sign in to continue\.$/, vi: () => 'Vui lòng đăng nhập để tiếp tục.' },
  // — Reviews & contact host —
  {
    test: /^Please enter a valid rating and review comment\.$/,
    vi: () => 'Vui lòng nhập điểm đánh giá và nhận xét hợp lệ.',
  },
  { test: /^Stay not found\.$/, vi: () => 'Không tìm thấy chỗ ở.' },
  // — AI concierge —
  {
    test: /^Describe your desired Vietnam base in a short sentence\.$/,
    vi: () => 'Mô tả ngắn gọn nơi bạn muốn sống tại Việt Nam.',
  },
  // — Payments —
  {
    test: /^Could not initialize Stripe Checkout session\.$/,
    vi: () => 'Không thể khởi tạo phiên thanh toán.',
  },
  { test: /^Missing transaction reference\.$/, vi: () => 'Thiếu mã giao dịch.' },
  { test: /^Payment transaction not found\.$/, vi: () => 'Không tìm thấy giao dịch thanh toán.' },
  {
    test: /^Received transfer \((\d+)\) is below required amount \((\d+)\)\.$/,
    vi: (m) => `Số tiền chuyển khoản (${m[1]}) chưa đủ số tiền yêu cầu (${m[2]}).`,
  },
  // — Generic server fallback (MICROCOPY §4) —
  {
    test: /^Unexpected server error\.$/,
    vi: () => 'Đã có lỗi xảy ra. Vui lòng thử lại.',
    en: () => 'Something went wrong. Please try again.',
  },
  // — Rate limiting (proxy.ts) —
  {
    test: /^Too many requests\. Please try again later\.$/,
    vi: () => 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
    en: () => 'Too many requests. Please try again later.',
  },
];

/** Map a server error message to guest-facing copy; falls back to the original. */
export function localizeGuestError(
  message: string | null | undefined,
  locale: Locale
): string {
  const raw = message?.trim();
  if (!raw) {
    return locale === 'vi'
      ? 'Đã có lỗi xảy ra. Vui lòng thử lại.'
      : 'Something went wrong. Please try again.';
  }
  for (const rule of RULES) {
    const m = raw.match(rule.test);
    if (m) {
      if (locale === 'vi') return rule.vi(m);
      return rule.en ? rule.en(m) : raw;
    }
  }
  return raw;
}
