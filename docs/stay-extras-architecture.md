# Stay Extras — Architecture Notes

_Added 2026-11-28. Companion to AGENTS.md §5 and `docs/UI_PRINCIPLES.md` §Stay extras.
Product spec: approved "Stay Extras" §1–19 (host-provided additional services)._

## What it is (and is not)

Hosts declare services per stay; guests select them at checkout (or request
after booking); hosts confirm/quote/prepare/complete inside the existing
Reservation drawer. **Money never touches the platform**: guests pay providers
directly, so there is no cart, escrow, commission, wallet, payout, inventory,
marketplace, or payment-service code anywhere in this feature. The 12% service
fee inputs are unchanged — extras are not part of GMV or revenue, and quotes
settled off-platform are never recorded as revenue.

## Data model (`supabase/migrations/0017_stay_extras.sql`)

| Table | Role |
| --- | --- |
| `service_catalog` | The 9 platform categories (admin-togglable, `enabled`, `allowed_units[]`). Seeded with names only — no prices, partners, or quantities. |
| `stay_services` | Host declarations, `UNIQUE(stay_id, catalog_id)`: price/unit, `is_included`, description, conditions, deposit, lead time, provider type, change/cancel terms. `ON DELETE RESTRICT` while active requests exist (disable instead). |
| `bookings.extras_selection` | JSONB stash captured at checkout: `[{serviceId, quantity?, desiredAt?, note?}]`. Not a charge. |
| `service_requests` | The state machine row + immutable `snapshot` (service data at request/quote time), `guest_details` (trip info only), `quote_version` / `guest_responded_version`, reminder flags. Partial unique index `(booking_id, stay_service_id) WHERE status IN (active)` = webhook idempotency. |
| `service_request_events` | History (same pattern as `booking_events`): requested, quote_sent/accepted/rejected, details_submitted, status_change, cancelled_by_booking, reminder… |

## State machine

```
pending ──confirm──────────────► confirmed ──prepare──► preparing ──complete──► completed
   │        │                       │
   │        └──quote──────────────► awaiting_guest ──accept(current version)──► confirmed
   │                                   │
   ├──request_info (status unchanged)  └──reject──────────────────────────────► cancelled
   ├──decline──► declined
   └──guest cancel / booking cancel (unconfirmed) ────────────────────────────► cancelled
confirmed ──quote (price change)──► awaiting_guest   (guest must re-accept)
```

No `Paid` state, no auto-`completed` (host marks it), terminal states are
locked. Booking cancelled → unconfirmed requests cancelled with it;
confirmed/preparing requests stay and **both sides are notified** for manual
handling (no automatic service refunds through VietNomad).

## Confirmation hooks (the only places requests are created)

1. `createStayBooking` — `checkoutMode: 'instant'` when the stay is instant
   (booking lands `RESERVED_LOCKED` in the same transaction).
2. `markBookingPaidInTx` — only when `nextStatus === 'RESERVED_LOCKED'`
   (covers Stripe/VietQR webhooks and sandbox confirms).
3. `respondToPendingBooking(..., 'approve')` — request-to-book approval.
4. Admin operations PATCH that transitions a booking to confirmed.

All call `ensureServiceRequestsForBookingTx(tx, bookingId)` which re-checks
booking status + service enabled + stay ownership and inserts with
`ON CONFLICT … DO NOTHING` (replay-safe). Services disabled between checkout
and confirmation are skipped (no ghost requests).

Cancellation hooks (`handleBookingCancelledForExtrasTx`): member cancel
(paid + unpaid branches), admin operations cancel, admin wifi-mismatch
refund-cancel. Decline-at-approval cancels before requests exist (no-op).

## Module & API surface

- `src/modules/stay-extras.ts` — catalog CRUD, stay-service CRUD, ensure/cancel
  helpers, guest actions (create/details/quote response/cancel), host actions
  (confirm/quote/request_info/decline/prepare/complete), admin list/stats/
  toggles, `runServiceRequestReminders()`.
- Routes: `GET /api/stays/[slug]/services` (public), `GET /api/service-catalog`,
  `GET|POST /api/host/services`, `DELETE /api/host/services/[id]`,
  `GET /api/host/service-requests`, `POST /api/host/service-requests/[id]`,
  `GET|POST /api/bookings/[id]/service-requests`,
  `GET /api/service-requests/[id]`, `POST …/details|quote|cancel`,
  `GET /api/admin/service-requests` (+`?view=stats`), `GET|POST /api/admin/service-catalog`,
  `GET|POST /api/cron/extras-reminders`.
- Authorization: guest → own `bookings.guest_id`; host → `stays.host_id`;
  admin → role check + `logAdminAudit({module:'stay_extras'})` on toggles.

## Notifications & reminders (§11)

Every meaningful transition calls `notifyServiceEvent` → subject/payload →
`maybeSendResendEmail` + `booking_notifications` insert (`recipient_role`
guest/host) — this feeds the existing Host Console bell and member
notifications. Reminders: hourly cron (`vercel.json` → `/api/cron/extras-reminders`,
`CRON_SECRET` bearer like `ical-sync`) sends one "upcoming" reminder when the
desired date enters the 7-day window and one "final" reminder inside 24h,
guarded by `reminder_upcoming_sent` / `reminder_final_sent` so nothing repeats;
`cancelled/declined/completed` rows are excluded by the SQL itself.

## UI map

| Surface | Component |
| --- | --- |
| Host editor section `4b. Dịch vụ bổ sung` | `src/components/host/HostStayExtrasSection.tsx` (wired in `HostListingEditorClient`) |
| Stay Detail section (after Workspace, before Neighborhood; hidden at 0; never on StayCard) | `src/components/StayExtraServicesSection.tsx` (`#extra-services`) |
| Checkout checkboxes (default-off, survive payment-method switch/back/login draft) | `StayBookingWidget.tsx` (`serviceSelections` state) |
| Host reservation drawer | `src/components/host/ReservationExtrasPanel.tsx` (inside `ReservationSideDrawer`) |
| My Trips — "Chuẩn bị cho kỳ lưu trú" | `src/components/TripExtrasSection.tsx` (inside `MemberDashboardClient`) |
| Admin tab (inside `/admin/operations/bookings`, no new sidebar) | `src/components/admin/bos/AdminServiceRequestsPanel.tsx` |
| Help articles | seeded in `src/lib/db/seed-bos.ts` → `/guides/dat-dich-vu-bo-sung-cho-ky-luu-tru` (guest) and `/guides/cung-cap-dich-vu-bo-sung-cho-khach` (host) + English pairs |

## Tests & tooling

- `tests/stay-extras.test.ts` — the18 §18 acceptance scenarios (no services /
  one / many / none selected / selected / pay fail / RTB pending / confirm /
  duplicate webhook / quote change / accept / reject / unavailable /
  add-after-booking / lifecycle / booking cancel / disable-with-requests /
  three-tier permissions / fee+ledger consistency).
- `scripts/_setup-extras-demo.ts` — demo data for screenshots (declare
  services on tay-ho jade + one booking with pending/awaiting/confirmed
  requests); `scripts/screenshot-stay-extras.cjs` captures the8 acceptance
  screenshots into `artifacts/` (needs `LD_LIBRARY_PATH=/tmp/al2023libs/lib`).

## Explicit non-goals (spec §17)

No marketplace, partner portal, cart, payment service, escrow, commission,
wallet, payout, referral, inventory, AI concierge, or mobile app. No
identity-document fields. No Verified/Trusted/Insured/Guaranteed labels.
Legal disclaimer copy stays subject to user review before publication.
