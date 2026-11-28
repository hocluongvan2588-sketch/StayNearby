# Microcopy Patterns

Standard patterns for recurring UI interactions across VietNomad Stays.

## 1. Search & Filters
- **Empty query / default city:** `All cities` · `Tất cả thành phố`
- **Stay length selector:** `1 week (7 nights)`, `2 weeks`, `3 weeks`, `1 month (30 nights)`
- **Result summary:**
  - Singular: `1 stay available for {nights} nights`
  - Plural: `{count} stays available for {nights} nights`
- **Reset filters:** `Reset filters` · `Xóa bộ lọc`

## 2. Booking Price Breakdown & Payment Split
Always state the split unambiguously using absolute amounts (`feeOnline`,
`payAtCheckin`, `total`). The service-fee rate is never shown as a
percentage anywhere in UI (decision2026-11-28):
- **EN:** `Service fee ({feeOnline}) due online today to reserve · Pay {payAtCheckin} directly to your host at check-in`
- **VI:** `Phí dịch vụ ({feeOnline}) trả online hôm nay để giữ phòng · Trả {payAtCheckin} cho chủ nhà khi nhận phòng`
- **Promo applied:** `Code {code} applied (-{discountAmount})` · `Đã áp dụng mã {code} (-{discountAmount})`

## 3. Verification & Badge Transparency
- When `isWifiVerified === true`: `Wi-Fi verified on {date}` · `Đã kiểm tra Wi-Fi ngày {date}`
- When `isWorkReady === true`: `Work-Ready setup verified` · `Đã kiểm tra góc làm việc`
- When neither badge is assigned (never claim verification): `Wi-Fi details reported by host` · `Thông số Wi-Fi do chủ nhà cung cấp`

## 4. Form Helpers & Validation Errors
- **Required field:** `Please enter {fieldName}.` · `Vui lòng nhập {fieldName}.`
- **Invalid email:** `Enter a valid email address (for example, name@domain.com).` · `Vui lòng nhập địa chỉ email hợp lệ.`
- **Minimum nights error:** `Stays on VietNomad require at least {minNights} nights.` · `Thời gian ở tối thiểu trên VietNomad là {minNights} đêm.`
- **Promo minimum nights:** `Code {code} requires at least {minNights} nights.` · `Mã {code} áp dụng cho đơn từ {minNights} đêm trở lên.`
- **Promo invalid/expired:** `This promo code is not valid or has expired.` · `Mã giảm giá không hợp lệ hoặc đã hết hạn.`
- **Network / server fallback:** `Something went wrong. Please try again.` · `Đã có lỗi xảy ra. Vui lòng thử lại.`

## 5. Status Badges (Booking, Payment, Refund, Support)
Keep status badges short (1–3 words) and consistent with `src/lib/i18n.ts`:
- Booking: `Awaiting fee`, `Pending host approval`, `Confirmed`, `Checked in`, `Completed`, `Cancelled`
- Support ticket: `Open`, `In progress`, `Waiting for you`, `Resolved`, `Closed`
- Listing review: `Pending review`, `Published`, `Rejected`, `Suspended`

## 6. Empty States
Pair a concise explanation with one direct CTA:
- **Saved stays:** `No saved stays yet.` + `[Browse stays]`
- **Trips / bookings:** `No bookings yet.` + `[Find a stay]`
- **Messages:** `No messages yet. Conversations with hosts or guests appear here once a booking starts.`
- **Reviews:** `No reviews yet.`
- **Support tickets:** `No support requests yet.` + `[Open support request]`

## 7. Confirmation Dialogs
Always include object + consequence:
- **Delete/remove place:** `Remove "{name}"? It will no longer appear on destination or stay pages.`
- **Cancel booking:** `Cancel booking {code}? Your dates will be released and eligible refunds follow the property’s cancellation policy.`
- **Decline reservation (Host):** `Decline this booking request? The dates will reopen and the guest’s online service fee will be refunded automatically.`
- **Approve refund (Admin):** `Complete refund of {amount} for booking {code}? This updates payment status and records a ledger entry.`
