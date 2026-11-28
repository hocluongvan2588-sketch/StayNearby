# Terminology Dictionary

Use these standard terms across all UI copy, transactional messages, and i18n dictionaries. Do **not** rename database columns, API JSON keys, or internal TypeScript symbols just to match UI terminology.

## 1. Core Marketplace Terms

| Concept | Preferred UI Term (EN) | Preferred UI Term (VI) | Usage Rules |
| --- | --- | --- | --- |
| **Guest** | Guest | Khách thuê / Khách | Person browsing, booking, or staying at a property. Use *Member* only when referring specifically to account/membership benefits. |
| **Host** | Host | Chủ nhà | Property owner or manager on VietNomad. Never use *Vendor* or *Supplier* in Guest/Host UI. |
| **Stay** | Stay | Chỗ ở | Guest-facing word for an accommodation option (*Browse stays*, *Save this stay*). |
| **Listing** | Listing | Tin đăng / Chỗ ở | Host & Admin term for a property record in management/moderation views (*Manage your listings*, *Submit listing*). |
| **Property** | Property | Chỗ ở / Bất động sản | Physical house, apartment, or villa when referring to rules, address, or onboarding (*List your property*). |
| **Accommodation** | Stay / Property | Chỗ lưu trú | Avoid overly formal *Accommodation* in casual Guest UI; prefer *Stay*. |
| **Booking** | Booking | Đặt phòng | **Primary Guest & Admin term.** Do not mix *Reservation*, *Order*, or *Transaction* to mean the same guest booking. |
| **Reservation** | Booking *(Guest)* · Reservation *(Host)* | Đặt phòng | Guest UI uses **Booking** consistently. Host Console may use *Reservations* for the incoming host queue (`HostReservationsClient`), or *Bookings*. Never use *Order*. |
| **Check-in** | Check-in | Nhận phòng | Arrival date and arrival process (*Check-in date*, *Pay host at check-in*). |
| **Check-out** | Check-out | Trả phòng | Departure date (*Check-out date*). |

## 2. Geography & Discovery Terms

| Concept | Preferred UI Term (EN) | Preferred UI Term (VI) | Usage Rules |
| --- | --- | --- | --- |
| **Destination** | City / Destination | Thành phố / Điểm đến | Use *City* or *Destination* in Guest navigation and filters (*All cities*, *Explore destinations*). |
| **Neighborhood** | Neighborhood | Khu vực | District or area within a city (*An Thuong*, *Tay Ho*, *Thao Dien*). |
| **Local Place** | Places to explore | Địa điểm khám phá | Beaches, landmarks, restaurants, cafes, workspaces, fitness, and services. Keep headings neutral—never restrict copy to coworking/cafes only. |
| **Local Partner** | Local partner | Đối tác địa phương | Verified business offering member perks (`partnership_status = 'active'`). |

## 3. Payments, Promotions & Support Terms

| Concept | Preferred UI Term (EN) | Preferred UI Term (VI) | Usage Rules |
| --- | --- | --- | --- |
| **Service Fee** | Service fee | Phí dịch vụ | The online booking fee paid to VietNomad (rate from `service_fee_rate`, used only for pricing math) to lock dates. Never render the rate as a percentage in UI — show absolute amounts only. Always clarify it is separate from rent paid at check-in. |
| **Total Price** | Total price | Tổng chi phí | Combined total for the stay (stay rent + service fee - discounts/credits). |
| **Payment** | Payment | Thanh toán | Gateway payment action or transaction record (VietQR / Stripe). |
| **Refund** | Refund | Hoàn tiền | Money returned to the guest under cancellation policy or verified admin review. |
| **Payout** | Payout | Thanh toán cho chủ nhà | Settlement/check-in rent collection tracked for hosts. |
| **Earnings** | Earnings | Doanh thu | Host income collected from stays. |
| **Promotion** | Promo code *(input)* · Deal *(browse)* | Mã giảm giá · Ưu đãi | Guests apply a *Promo code* at checkout and browse *Monthly deals* on `/deals`. |
| **Support Ticket** | Support ticket *(dashboard/admin)* · Support *(general)* | Yêu cầu hỗ trợ / Phiếu hỗ trợ | Formal guest or host help thread tracked in `support_tickets`. |

## 4. Terms Deprecated in Guest/Host UI

- **BookingFlow:** Internal model name. Replace with clear explanations: *"Pay the service fee online today to reserve, and pay your host at check-in."*
- **StayDirect:** Retired legacy model. Never reference it anywhere.
- **Digital Nomad / Workation:** Avoid over-targeting. VietNomad serves all weekly and monthly travelers.
- **Work-Ready:** Use strictly for the optional database badge (`isWorkReady` / `Work-Ready badge` filter) — never as a requirement or primary brand slogan.
