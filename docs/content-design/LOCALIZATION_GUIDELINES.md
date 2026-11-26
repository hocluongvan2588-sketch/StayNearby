# Localization Guidelines (EN ↔ VI & Internationalization)

## 1. Core Principles

- **Write from natural meaning, not word-for-word translation.** Both English and Vietnamese versions should read as though originally written in that language by a fluent human writer.
- **No mixed-language UI strings.** Never mix English technical phrases inside Vietnamese sentences unless it is an established proper noun or universal standard (`Wi-Fi`, `Mbps`, `Stripe`, `VietQR`, `iCal`, `VAT`, `WhatsApp`, `Zalo`, `e-Visa`).
  - Bad VI: `"Khám phá Local Discovery tại Đà Nẵng"` -> Good VI: `"Khám phá các địa điểm nổi bật tại Đà Nẵng"`
  - Bad VI: `"Nhận 4% credit khi nâng cấp Nomad Pass"` -> Good VI: `"Nhận lại 4% tiền thưởng vào tài khoản hội viên"`
  - Bad VI: `"Live BookingFlow availability"` -> Good VI: `"Chỗ ở đang còn trống"`
- **Centralize reusable copy.** Common navigation labels, status labels, validation errors, confirmation dialogs, currency/date formatters, and reusable UI copy belong in `src/lib/i18n.ts` or dedicated copy dictionaries rather than duplicated across components.

## 2. Content Ownership Layers

Separate copy by ownership so dynamic data and user content are never overwritten or hardcoded:

1. **UI Copy** (`src/lib/i18n.ts`, component copy): Buttons, navigation, labels, filters, empty states, form helpers, status labels. Localized across supported locales (`en`, `vi`).
2. **Marketing & Editorial Content** (`cms_contents` table via Admin BOS): Homepage hero banners, site announcements, city/arrival guides (`/guides`, `/guides/[slug]`), and FAQs managed via CMS.
3. **Business Data** (`platform_settings`, `stays`, `bookings`, `promotions`, `destinations`, `neighborhoods`, `places`, `local_partners`): Rates, service fees, discounts, FX conversion, room counts, Wi-Fi numbers, and availability fetched dynamically from DB/APIs.
4. **Transactional Content** (`src/modules/notifications.ts`, `src/modules/concierge.ts`, checkout summaries): Standardized email, webhook, and support messages combining structured templates with dynamic booking fields (`bookingCode`, `feeOnlineVnd`, `payAtCheckinVnd`, `checkIn`, `checkOut`, `applied_service_fee_rate`).
5. **User-Generated Content (UGC)**: Guest reviews, host listing descriptions, host replies, guest notes, and support ticket messages written by users/hosts/staff. Never overwrite user-created DB records during copy updates.

## 3. Plurals, Numbers, Dates & Currency

- **Plurals in English:** Handle singular and plural cleanly (`1 night` vs `7 nights`, `1 stay available` vs `12 stays available`, `1 guest` vs `3 guests`, `1 week` vs `2 weeks`). Never render `"1 nights"` or `"7 stays available"` inconsistently.
- **Vietnamese counting:** Vietnamese does not inflect nouns for plural, so keep expressions concise (`1 đêm`, `7 đêm`, `1 tuần`, `2 tuần`, `3 chỗ ở còn trống`).
- **Dates & Currency:**
  - Always format currency via `formatMoney(...)` / `formatMoneyFromVnd(...)` using live `fxRates` from `platform_settings`.
  - Keep date displays clear (`YYYY-MM-DD` for operational tables/inputs, readable dates where appropriate for guest travel info).
- **Dynamic string interpolation:** Never construct sentences by concatenating translated fragments that break word order in another language. Format complete parameterized phrases for each locale.

## 4. Vietnamese Style & Register

- **Guest Platform:** Friendly, clear, polite, everyday Vietnamese (`chỗ ở`, `đặt phòng`, `nhận phòng`, `trả phòng`, `phí dịch vụ`, `tiền thuê nhà`, `ưu đãi`, `mã giảm giá`). Avoid overly stiff Sino-Vietnamese bureaucratic words (`quý khách hàng vui lòng thực hiện thao tác...`).
- **Host Console:** Respectful, concise, business-clear (`bạn`, `chủ nhà`, `lịch phòng`, `giá theo đêm`, `khách sắp nhận phòng`, `thu tiền khi nhận phòng`).
- **Admin BOS:** Neutral operational Vietnamese/English (`duyệt`, `tạm khóa`, `chờ xử lý`, `hoàn tiền`, `phiếu hỗ trợ`).
