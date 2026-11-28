# AGENTS.md — Instructions for AI Coding Agents

## 1. Content Design System Compliance (Mandatory)

Before creating, updating, or translating any UI copy, microcopy, labels, buttons, empty states, error messages, confirmation dialogs, notifications, transactional emails, or SEO metadata in VietNomad Stays, you **must** read and follow the official Content Design System under `docs/content-design/`:

- `docs/content-design/BRAND_VOICE.md` — Brand positioning (`Stay · Work · Live · Explore`) and tone differences across Guest Platform, Host Console, and Admin BOS.
- `docs/content-design/CONTENT_STYLE_GUIDE.md` — Anti-AI phrasing rules, clarity standards, Before/After examples, and dynamic/legal accuracy rules.
- `docs/content-design/UX_WRITING_GUIDELINES.md` — Patterns for navigation, headings, CTAs, forms, errors, empty states, and confirmation dialogs.
- `docs/content-design/TERMINOLOGY.md` — Standardized EN/VI terminology across marketplace concepts (`Guest`, `Host`, `Stay`, `Listing`, `Booking`, `Service fee`, `Places to explore`, etc.).
- `docs/content-design/LOCALIZATION_GUIDELINES.md` — Natural EN/VI localization, ownership boundaries (UI Copy vs CMS vs Business Data vs Transactional Templates vs UGC), and plural/currency rules.
- `docs/content-design/MICROCOPY_PATTERNS.md` — Ready-to-use UI copy templates.
- `docs/content-design/CONTENT_QA_CHECKLIST.md` — Required QA checklist before completing work.

### Key Non-Negotiable Copy Rules
1. **Do not over-index on Digital Nomads / Remote Work:** VietNomad serves long-stay travelers, couples, families, business travelers, and remote workers alike. Never imply users must work remotely to stay with VietNomad.
2. **Do not expose internal system jargon to users:** Never use `BookingFlow`, `StayDirect`, or internal architecture names in Guest or Host UI copy.
3. **Do not write AI clichés or promotional fluff:** Avoid `Unlock`, `Elevate`, `Empower`, `Seamlessly`, `Effortlessly`, `Extraordinary`, `Unforgettable`, `Ultimate`, `Curated` (as filler), `Oops!`, stacked adjectives, and repetitive subtitles.
4. **Never hardcode dynamic pricing or policy constants:** Always pull `serviceFeeRate`, `hostCommissionRate`, `vatDiscountRate`, `premiumRewardRate`, `fxRates`, and `defaultMinNights` from `platform_settings` / `usePreferences()`.
5. **Never alter business logic, pricing formulas, legal policies, published URL slugs, or user-generated DB records** when updating UI copy.

## 2. Guest Platform UI Principles (StayCard & Listing Detail)

Before building or changing guest-facing layout (StayCard, listing detail,
booking widget, Local Discovery), read `docs/UI_PRINCIPLES.md`. Highlights:

1. **Badge Wi-Fi is the one intentional badge exception** — top-left on the
   card image, speed only, real values only; never repeat the speed below the
   image and never attach unverified claims.
2. **Ratings have sources** — internal VietNomad reviews first, Google only as
   a labelled fallback, never a default score.
3. **Host-declared ≠ guest-rated ≠ VietNomad-verified** Wi-Fi — three distinct
   display tiers, explained in `docs/UI_PRINCIPLES.md`.
4. **Prices come from the pricing engine** — "7/14/21/30 đêm" labels, totals
   include fees, payment split only on detail/checkout, never on cards.
5. **No invented data** — missing Wi-Fi, ratings, hours, distances, and
   amenities stay missing; localize via `src/lib/i18n.ts` formatters
   (`formatStayLocationLabel`, `formatDistanceLabel`, `formatCountryLabel`,
   `formatHostDisplayName`, `formatShortDateLabel`).
6. **Local Discovery is interactive** — whole-card click opens the place
   detail overlay (modal/bottom sheet) with keyboard support and preserved
   scroll/booking state.
7. **Local Discovery data path** — hosts propose places through the Listing
   Editor ("Giới thiệu khu vực"); everything goes through
   `place_suggestions` moderation before it is public. Ranking, distance
   privacy and honest-default rules: `docs/UI_PRINCIPLES.md` §Local Discovery
   + `docs/local-discovery-plan.md`. One shared `places` table only — no
   parallel place stores, no host edits to verified place data.

## 3. Engineering & Architecture Guardrails

- Keep database schema, payment/booking flows, RBAC guards (`requireAdminPermission`), and published routes/slugs stable unless explicitly asked to modify them.
- Keep `src/lib/i18n.ts` and shared dictionaries synchronized for reusable UI copy across `en` and `vi`.
- Always verify changes with `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` (plus UI inspection across viewports when UI copy or layout changes).
