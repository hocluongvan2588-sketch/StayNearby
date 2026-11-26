# VietNomad Stays — Comfortable Weekly & Monthly Stays Across Vietnam

**VietNomad Stays** is a full-stack bilingual (English & Vietnamese) extended-stay platform for international remote workers and long-stay travelers living in Vietnam, styled with a Modern Warm Indochine aesthetic.

## Key Capabilities

- **Unified BookingFlow Channel (12% Guest Fee, 0% Host Commission):** Every stay on the platform uses a single checkout flow — travelers pay a transparent **12% online service fee** to lock dates and unlock the exact address, and pay **100% of the host stay rate directly at check-in** (`0%` host commission).
- **Fixed Package Tiers (7 / 14 / 21 / 30 nights + extra nights):** Minimum 7-night stays with upfront weekly and monthly pricing across **9 currencies** (`USD`, `EUR`, `VND`, `GBP`, `AUD`, `SGD`, `JPY`, `KRW`, `THB`).
- **Free Host Onboarding & Self-Declared Amenities (`€0` Fee):** Zero application fees and no mandatory hardware or speedtest gates to list. Hosts self-declare their reported Wi-Fi speed, desk/ergonomic chair/external monitor setup, kitchen (`full | kitchenette | shared | none`), and laundry (`in_unit | building | service | none`).
- **Optional Verification Badges:** Platform admins can independently grant `Wi-Fi Verified` and `Work-Ready` badges (`SELF_DECLARED`, `HOST_VERIFIED`, `VIETNOMAD_CERTIFIED`), and guests can filter directly by badges or individual amenities.
- **Three-Window Cancellation Policies:** Cooling-Off (`48h` post-booking 100% cash refund for Flexible & Moderate), Adequate Notice (`100%` Account Credit), and Restricted periods.
- **Nomad Pass (€99/year):** `4%` reward credit earned on completed stays and VAT-free business invoicing toggle.
- **Role Consoles & Host Studio:** Dedicated `/host` partner studio (photo uploads via Supabase Storage + local fallback, full bilingual copy editor, multi-room types, 7–30N tier pricing, iCal sync, calendar blocks) and `/admin` moderation queue.

## Demo Accounts (Seeded Automatically)

| Role | Email | Password |
| :--- | :--- | :--- |
| Free Nomad | `nomad@vietnomad.demo` | `NomadPass!2026` |
| Premium Nomad (€99/yr) | `premium@vietnomad.demo` | `NomadVip!2026` |
| Host Partner (Da Nang, Hanoi, Hoi An, Da Lat — 0% fee) | `host@vietnomad.demo` | `HostFlow!2026` |
| Host Partner (HCMC & Phu Quoc — 0% fee) | `direct@vietnomad.demo` | `StayDirect!2026` |
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
