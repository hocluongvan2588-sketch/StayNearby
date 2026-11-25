# WorkingHome

WorkingHome is a Vietnam-focused accommodation and local discovery platform built for remote workers staying 2–4 weeks. The guest/user-facing storefront supports **bilingual Vietnamese (`vi`) & English (`en`)** with **automatic IP-based language and currency detection** (Vietnamese IPs default to `vi` + `VND`; international IPs default to `en` + local currency such as `USD`, `EUR`, `GBP`, `AUD`, `SGD`, `CAD`, `JPY`, or `KRW`, with exact `VND` settlement amounts always shown and manual switcher overrides persisted via cookies), while Host and Admin portals operate exclusively in Vietnamese and VND.

## Architecture & Module Structure

Single **Next.js App Router + TypeScript** application backed by **PostgreSQL** (Supabase Auth & Storage ready, with built-in embedded PostgreSQL via `@electric-sql/pglite` and signed-cookie fallback auth for zero-config local development):

```text
src/
├── modules/
│   ├── catalog/       # Public area & published stay search/detail projections (strips private address)
│   ├── availability/  # Half-open [checkIn, checkOut) night checks against occupancy_nights
│   ├── pricing/       # Integer VND nightly calculation, rate overrides, deterministic quote hashes
│   ├── bookings/      # Canonical booking state machine & guest trip queries
│   ├── host/          # Host-owned listing queries (enforces host role & record ownership)
│   ├── admin/           # Admin moderation queue queries (enforces admin role)
│   ├── crm/             # Admin CRM segmentation & internal customer/host notes (admin-only)
│   ├── ops/             # Background expiry/completion jobs, exponential backoff outbox dispatcher & audit snapshot
│   └── local-guides/    # Local area guides: bilingual public queries (LIMIT 5), coworking & admin CRUD
├── lib/
│   ├── auth/          # Session resolution (Supabase SSR or HMAC cookie), scrypt hashing, RBAC guards
│   ├── db/            # PostgreSQL pool / PGlite adapter, migration runner, idempotent EN/VI seed
│   ├── i18n/          # Bilingual EN/VI dictionaries, offline GeoIP country lookup, currency conversion, cookie overrides
│   ├── storage/       # Server-side photo ownership, MIME, size, and count validation
│   ├── config.ts      # Environment configuration & temporary dev defaults (WorkingHome)
│   ├── errors.ts      # Standardized error codes (VALIDATION_ERROR, FORBIDDEN, PRICE_CHANGED, etc.)
│   ├── format.ts      # Integer VND formatting, timezone-aware [checkIn, checkOut) helpers
│   ├── http.ts        # Hardened IP extraction, optional JSON parsing, Retry-After rate-limit responses
│   ├── logger.ts      # Structured JSON logger with automatic redaction of secrets & check-in details
│   ├── qr.ts          # Clean public QR SVG generator targeting /explore/[areaSlug] only (zero PII)
│   ├── rate-limit.ts  # Sliding-window rate limiting for auth, search, quote, booking & media endpoints
│   └── validation.ts  # Strict UUID & input guards preventing raw DB syntax 500s
└── app/               # Bilingual EN/VI Guest routes (/, /stays, /stays/[slug], /explore, /explore/[areaSlug], /customer, /booking/review, /trips, /login)
                       # Vietnamese-only Operator routes (/host, /host/guests, /admin, /admin/crm, /crm, /admin/local-guides)
```

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

- **Local Development (default):** Leave `DATABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL` empty to run against local embedded PostgreSQL (`PGlite` at `.data/staynearby-pglite`) with signed HTTP-only cookie authentication and labeled demo data (`NEXT_PUBLIC_DEMO_MODE=true`).
- **Supabase / Vercel / External PostgreSQL:** Set `DATABASE_URL` (or connect Vercel's Supabase integration which sets `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING` automatically), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a strong `AUTH_SECRET`. On first boot, the server automatically ensures schema migrations (`0001`–`0007`) are applied and seeds demo data when `NEXT_PUBLIC_DEMO_MODE=true` and `areas` is empty. Create a public Supabase Storage bucket named `listing-photos` for host photo uploads.

## Database Migrations & Seed

Migrations live in `supabase/migrations/`:
- `0001_initial_schema.sql`: Core schema (`profiles`, `roles`, `user_roles`, `areas`, `listings`, `listing_revisions`, `listing_photos`, `amenities`, `listing_amenities`, `nightly_rates`, `bookings`, `occupancy_nights`, `booking_events`, `outbox`, and Phase 4 `local_*` tables).
- `0002_rls_policies.sql`: Row-Level Security policies and Supabase PostgREST column/write restrictions protecting `exact_address`, `checkin_instructions_en`, and direct writes to booking/occupancy tables.
- `0003_workinghome_updates.sql`: Aligns schema with WorkingHome remote-worker requirements (removes Wi-Fi speed columns, adds area vibe/walkability summaries, check-in / late-arrival fields on listings & revisions, and `coworking` + `solo`/`group` fields on local places/guides).
- `0004_user_bilingual_fields.sql`: Adds Vietnamese user-facing catalog/check-in fields (`areas.walkability_note_vi`, `listings` & `listing_revisions` `_vi` columns) for bilingual guest storefront support.
- `0005_ops_and_audit.sql`: Adds outbox retry metadata (`max_attempts`, `last_attempt_at`, `updated_at`) and `ops_job_runs` audit log table with strict RLS.
- `0006_local_guides_bilingual.sql`: Adds bilingual Vietnamese (`_vi`) fields, coworking booking/booth metadata, and directional hints on `local_places`, `local_guides`, and `local_guide_stops`.
- `0007_crm_profiles.sql`: Adds admin-only internal CRM segmentation (`crm_stage`, `crm_note`, `crm_updated_at`, `crm_updated_by`) on `profiles` with `anon`/`authenticated` column revokes.

Run migrations and idempotent bilingual EN/VI seed:

```bash
npm run db:migrate
npm run db:seed
# Or run both together:
npm run db:reset
```

### Demo Accounts (when `NEXT_PUBLIC_DEMO_MODE=true`)

| Role | Email | Password | Notes |
| - | - | - | - |
| Guest (EN) | `guest@workinghome.demo` | `DemoGuest!2026` | Includes 1 confirmed trip (`WH-DEMO-1001`, address unlocked) & 1 pending trip (`WH-DEMO-1002`, address masked) |
| Host + Guest (VI) | `host@workinghome.demo` | `DemoHost!2026` | Multi-role account owning Hanoi & Da Nang listings |
| Host 2 (VI) | `host2@workinghome.demo` | `DemoHost2!2026` | Owns Da Nang, Hoi An & HCMC listings + 1 photo-less draft |
| Admin (VI) | `admin@workinghome.demo` | `DemoAdmin!2026` | Full moderation queue access |

## Verification Commands

```bash
# 1. TypeScript static check
npm run typecheck

# 2. ESLint
npm run lint

# 3. Unit & PostgreSQL integration test suite
npm test

# 4. Production build
npm run build

# 5. Start dev server (binds 0.0.0.0:3000)
npm run dev

# 6. Run operational maintenance cycle manually (expiry, completion & outbox dispatch)
npm run ops:run
```

### Responsive & UI Verification Checklist

Verify in browser at `360px`, `390px`, `768px`, and `1440px` viewports:
- Pure white primary surface (`#FFFFFF`) with `#FAF8F3` ivory secondary editorial sections, `#205B47` forest green primary actions, Be Vietnam Pro typography, `12px` card radius, and `4:3` photo ratios.
- `/` and `/stays` have zero horizontal scroll at `360px`.
- Stay cards grid transitions `1 -> 2 -> 3 -> 4` columns at `360 / 640 / 960 / 1280px`.
- `/stays/[slug]` shows 2-column layout on desktop and sticky bottom price/CTA bar on mobile with safe bottom scroll clearance.
- Keyboard Tab navigation shows visible focus rings (`#205B47`), all icon buttons expose `aria-label`, and empty photo states render neutral labeled fallbacks.

## Milestone Status

- **Phase 1 (Complete):** Repository foundation, PostgreSQL schema + RLS migrations (`0001`–`0003`), server-side RBAC, bilingual EN/VI `WorkingHome` seed, pure-white Apple-inspired gallery UI (`#FFFFFF` / `#FAF8F3` / `#205B47` / Be Vietnam Pro), `/`, `/stays`, `/stays/[slug]`, `/booking/review`, `/login`, `/trips`, `/host`, and `/admin` views.
- **Phase 2 (Complete):** Full end-to-end booking workflow:
  - Host listing creation, revision tracking for post-publish edits, server-verified multipart photo uploads (`/api/media/...` with draft isolation), and moderation submission (`/host/listings/new`, `/host/listings/[id]`).
  - Host calendar blocking/unblocking `[startDate, endDate)` and nightly rate overrides (`/host/calendar`).
  - Admin listing approval, changes-requested with mandatory reason, suspend/restore, and booking lookup console (`/admin/listings`, `/admin/bookings`).
  - Idempotent guest booking request creation with `PRICE_CHANGED` snapshot protection (`/booking/review`, `/api/bookings`), atomic host confirmation locking `occupancy_nights` (`/host/requests`), guest request withdrawal & confirmed cancellation releasing exact nights (`/trips/[id]`), and concurrency integration tests.
- **Phase 3 (Complete):** Operational hardening & observability:
  - Automated pending booking expiry worker (`pending -> expired` strictly for overdue requests, never touching `confirmed` stays) and stay completion worker (`confirmed -> completed` strictly after `check_out` in `host_timezone`).
  - Outbox notification dispatcher (`src/modules/ops/index.ts`) with exponential backoff retry (`30s -> 2m -> 10m -> 30m -> 1h`), dead-letter status (`failed`), optional HMAC-signed `OUTBOX_WEBHOOK_URL` webhook delivery, CLI runner (`npm run ops:run`), cron endpoint (`POST /api/internal/jobs/run` protected by `OPS_SECRET`), and Vietnamese Admin Ops console (`/admin/ops`).
  - Security & IDOR hardening: UUID validation across all booking/host/admin/ops APIs (`400 VALIDATION_ERROR`), `Retry-After` on `429 RATE_LIMITED`, baseline security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy`), structured JSON logging with automatic redaction (`src/lib/logger.ts`), and dedicated IDOR/worker Vitest suites.
- **Phase 4 (Complete):** Local Guides (`Khám phá địa phương`) decoupled cleanly from booking transactions:
  - Pre-booking `"A day in this neighborhood"` preview on `/stays/[slug]` (rendered conditionally when published guides/coworking spots exist, including video-call booth and walk-in/booking flags).
  - Post-confirmation `"Explore nearby"` navigation on confirmed/completed `/trips/[id]` pages.
  - Public `/explore` directory and standalone `/explore/[areaSlug]` pages (`GET /api/explore/[areaSlug]`) with area switcher, `theme` / `durationBucket` / `budgetTier` / `solo`/`group` filters, hard `LIMIT 5` result cap, ordered stops, Google Maps & optional partner booking links, source + `verifiedAt` attribution, empty-state filter relaxation, and clean public QR code SVG (`/explore/[areaSlug]` only, zero PII).
  - Vietnamese-only `/admin/local-guides` console (`GET/POST/PATCH /api/admin/local-guides/**` and `GET /api/admin/local-guides/qr/[areaSlug]`) to manage verified places, curated guides, publish toggles, and printable SVG QR codes.
- **Phase 5:** Online payment integration, instant book, post-stay verified reviews, and external calendar sync (pending business policy sign-off).
