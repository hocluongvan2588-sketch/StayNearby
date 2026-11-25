# VietNomad Stays — Work-Ready Extended Stays Across Vietnam

**VietNomad Stays** is a full-stack bilingual (English & Vietnamese) extended-stay platform for international digital nomads living and working across Vietnam, modeled on NomadStays' operational and marketplace architecture and styled with a Modern Warm Indochine aesthetic.

## Key Capabilities

- **Fixed Package Tiers (7 / 14 / 21 / 30 nights + extra nights):** Minimum 7-night stays with upfront all-inclusive weekly and monthly pricing across **9 currencies** (`USD`, `EUR`, `VND`, `GBP`, `AUD`, `SGD`, `JPY`, `KRW`, `THB`).
- **Dual Partner Channels (`BookingFlow` & `StayDirect™`):**
  - **BookingFlow (0% Host Commission):** Travelers see wholesale rates plus a transparent 12% service & tax fee, backed by live room-unit night locking (`room_night_locks`) and instant booking.
  - **StayDirect™ (0% Traveler Markup):** Direct retail booking links backed by a host prepaid advertising wallet (`$50 / $100 / $200` presets) deducting `1%` per logged-in member referral click.
- **Verified Internet & Workspaces:** Independently recorded Download/Upload Mbps, jitter, testing notes, separated workspace photography, ergonomic desks/monitors, full kitchens, and nearby coworking spots.
- **Three-Window Cancellation Policies:** Cooling-Off (`48h` post-booking 100% cash refund for Flexible & Moderate), Adequate Notice (`100%` Account Credit), and Restricted periods.
- **Nomad Pass (€99/year):** `4%` reward credit earned on completed stays, VAT-free business invoicing toggle, `€100` Marketplace ad credit, Saved Favourites, and 6-country/visa-tier Vietnam Visa Tracker.
- **Role Consoles & CRM:** Dedicated `/host` partner console (7–30N tier pricing, Wi-Fi verification, calendar night blocks, wallet top-ups) and `/admin` moderation queue (€39 stay applications -> live Stay ID publishing, stay status controls, and Member/Host CRM).

## Demo Accounts (Seeded Automatically)

| Role | Email | Password |
| :--- | :--- | :--- |
| Free Nomad | `nomad@vietnomad.demo` | `NomadPass!2026` |
| Premium Nomad (€99/yr) | `premium@vietnomad.demo` | `NomadVip!2026` |
| Host Partner (BookingFlow) | `host@vietnomad.demo` | `HostFlow!2026` |
| Host Partner (StayDirect™) | `direct@vietnomad.demo` | `StayDirect!2026` |
| Platform Admin | `admin@vietnomad.demo` | `AdminOps!2026` |

## Local Commands

```bash
npm install
npm run db:reset     # Apply PostgreSQL migrations & seed Vietnam dataset
npm run dev          # Start Next.js development server
npm run typecheck    # TypeScript check
npm run lint         # ESLint check
npm test             # Run Vitest unit & PGlite PostgreSQL integration tests
npm run build        # Production build
```
