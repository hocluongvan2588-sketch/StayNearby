# VietNomad Guest Platform — UI Principles (StayCard & Listing Detail)

Long-lived rules agreed in the2026-11 UI/UX refinement. New UI work must follow
these; if a change conflicts with them, report before implementing.

## Marketplace layout (homepage & shared guest sections)

Agreed in the2026-11-28 homepage redesign. The target is a professional travel
marketplace (Airbnb / Booking.com), never an AI-generated SaaS landing page:

- **Images lead.** Stays, destinations, and categories are carried by real
  photography; text supports the image, not the other way around.
- **Whitespace and typography over containers.** Do not wrap sections or
  content groups in cards, borders, shadows, or background bands by default.
  No card inside a card without a business reason.
- **Subtitles are optional, not default.** A section heading stands alone
  unless a subtitle adds information the heading does not already carry.
- **No decorative AI tells.** No sparkle icons, emoji, gradient glows, or
  decorative icon rows. Marketing bullet lists ("pillars") do not belong in
  the hero.
- **One system across sections.** Same container (`max-w-7xl px-4 sm:px-6
  lg:px-8`), section rhythm, heading style (via `SectionHeader`), image ratio
  (`aspect-[4/3]`), and radius (`rounded-2xl`) on every guest section.
- **Sentence case for Vietnamese category names** — never title-case every
  word (`Nhịp sống đô thị`, not `Nhịp Sống Đô Thị`). Proper nouns stay as-is.
- **No SVG-drawn geography.** Never ship a hand-drawn Vietnam/region map as
  a destination browser. If a map is needed elsewhere, use accurate geodata.
- **No chatbot frames on the homepage.** Natural-language search may only
  appear embedded in the existing search experience, never as a standalone
  AI box with sample prompts.
- **Homepage section inventory (order):** hero + search → Chỗ ở nổi bật →
  Ưu đãi lưu trú dài ngày (StayCard only) → Điểm đến phổ biến → Tìm chỗ ở
  theo sở thích → Cẩm nang. Comparison tables, membership/community/host
  promo cards, fee/commission advertising, unlaunched benefits, and FAQ
  blocks are homepage-excluded (they live on their own routes).
- **Category tiles:** image + short name only — no per-image marketing copy,
  no heavy dark overlays, never the same image for two categories, and only
  categories that map to real searchable data (existing lifestyles/filters).
- **Deal/rating badges render only with valid data** (already true for
  StayCard: `dealSavingsPct > 0`, rating only when reviews exist).

## Fee display (decision2026-11-28)

- The service-fee **rate is never displayed as a percentage anywhere in the
  product UI** — guest, host, transactional email, proof images, checkout
  line items. Show absolute amounts only ("Phí dịch vụ VietNomad" + amount).
- Rate values still drive pricing math via `platform_settings`; only the
  display is amount-only. Admin config screens may show the raw rate because
  they ARE the rate editor.

## Community & events (2026-11-28)

- `/community` is an event discovery page, not a promo page: title
  ("Cộng đồng"), filter bar (city / when / price / language / category —
  all read from `platform_settings.event_taxonomy` + destinations, never
  hardcoded), upcoming events, category chips, city tiles, submit link.
  No Visa block, no marketplace/services block, no filler sections.
- **Event Card** is image-first and StayCard-aligned: `aspect-[4/3]
  rounded-2xl` photo, date/time line formatted with `formatEventDateTimeLabel`,
  title, venue · city, price, attendance **only for internal registrations
  with a real RSVP count**. No border box, no nested cards, no badges/pills,
  no big CTA — the whole card links to `/community/[slug]` (keyboard
  accessible). Never illustrate an event with a stay photo.
- **Event detail** is an open layout (hero image, facts as a definition
  list, prose content) — information groups are not boxed into cards.
  Registration split is strict: internal events reuse the RSVP API (login,
  duplicate, capacity, cancel); external events show a plain link to the
  organizer's official page, never a VietNomad login wall or a VietNomad
  attendance count. Ended/cancelled events disappear from lists; the detail
  page stays with a status label.
- **Honesty:** no fabricated attendance, capacity, organizer, or visa rules.
  Attendance = `COUNT(event_rsvps)`; NULL capacity = no published limit;
  per-nationality visa rules are not published — link official sources
  (`/guides/visa`) instead. Public submission form lands in `pending` and
  publishes only through Admin BOS review (`event_moderation_log` keeps the
  trail).

## Brand & visual

- Keep the existing identity: colors (`#164E3F` brand green, `#17221E` ink,
  `#53635D` secondary text, `#E5DFD3` hairlines), typography, and spacing.
- Hospitality feel: image-led, generous whitespace, hairline separators.
- Do NOT wrap every group in cards/badges/borders/shadows; guest UI must never
  look like an admin dashboard.
- Reuse the existing icon set (lucide) — no emoji, no decorative icons, no
  "AI-style" flourish components.

## StayCard (home, search, category, favorites, recommendations)

- Image: ratio/size/rounded corners unchanged;3-column desktop grid on home;
  no outer card, border, or shadow; existing gallery behavior kept.
- On-image component positions (check every breakpoint for overlap):
  - top-left — **Wi-Fi speed badge** (Wifi icon + download Mbps, brand green,
    solid, no gradient/glow). Only for real declared/measured speeds >0.
    Never "0 Mbps", never defaults, never "host reported" copy, never a
    verification icon unless independently verified.
  - top-right — favorite button.
  - bottom-left — deal badge, only with a real discount vs a valid reference.
  - bottom-center — gallery navigation (when the card has a gallery).
- Content order below the image: **title first** (prominent) with rating on the
  same row when space allows → address (secondary color) → type · capacity ·
  key living amenities → price.
- Never repeat the Wi-Fi speed below the image (the badge owns it).
- Price: total stay cost from the pricing engine (fees included). With dates
  selected show that stay's total; otherwise7-night and30-night totals.
  Labels are always "N đêm / N nights" — never "1 tháng" for a30-night tier.
  No payment-split lines on cards (split belongs to detail + checkout).
- Address: use `formatStayLocationLabel()` (dedupes repeated city segments).
  Never expose the exact street address on cards or before the address-privacy
  rule allows it.
- Ratings: internal VietNomad guest reviews first; Google only as fallback and
  always labelled "Google". Never render a default score for a listing with no
  reviews.

## Listing Detail

- Section order: header (title/location/rating) → gallery → overview → host →
  about → amenities → workspace & Internet → explore nearby → guest reviews →
  neighborhood → things to know → similar stays (only if a component exists).
- Booking widget stays right on desktop; mobile gets a one-column layout and a
  compact fixed bottom bar that scrolls to the full widget.
- Overview separates **property type** from **space rented**: a private room
  inside a co-living is "Phòng riêng trong …", never "Toàn bộ nhà ở chung".
- Host block shows the public display name (`formatHostDisplayName()` strips
  internal handles like `Admin (username)`) and a localized country
  (`formatCountryLabel()`). Never admin usernames, emails, or system accounts.
- Descriptions are host copy only — no auto-inserted fee/commission/promo
  text; payment terms live in the widget and policies.
- Amenities: deduplicated (`formatAmenities` normalization), two columns on
  desktop, plain "Wi-Fi" only — speed figures belong to Workspace & Internet.

## Wi-Fi display tiers (never conflate them)

1. **Host-declared** — speed badge on card + plain "Wi-Fi X Mbps" line in the
   detail section. Source ("Chủ nhà cung cấp") and test date appear only inside
   "Xem chi tiết kết nối", together with the variability disclaimer.
2. **Guest-rated** — Internet quality average + rating count when enough
   eligible reviews exist; always captioned as experience, not Mbps
   verification.
3. **VietNomad verified** — "Wi-Fi Verified" badge only from the platform
   verification process (`is_wifi_verified`), never from host data.

Jitter ≠ Ping; missing parameters stay missing (never defaulted, never
"today's date" as a test date). Guide content lives in CMS
(`/guides/wifi-speed-test-guide`), linked from the host editor — not inlined.

## Booking widget & checkout

- Order: total stay cost → per-night average → stay-length packages (7/14/21/30
  "đêm") → dates → guests → CTA → cost breakdown → payment split → cancellation
  + support. Total is stated before the online-today / pay-at-check-in split.
- CTA copy follows the real flow: Instant Book → "Đặt chỗ"; Request to Book →
  "Gửi yêu cầu đặt chỗ". Never "Đăng nhập để giữ phòng". Auth starts from the
  CTA, saves the in-progress selection to sessionStorage, restores it after
  login, and never creates a booking or inventory lock at login time.
- Service fee comes from `platform_settings` via the pricing engine, computed
  on the rent — never hardcode percentages in UI, and never render the rate
  as a percentage at all (amount-only display, see §Fee display).

## Local Discovery

- The whole place card is clickable (image, name, body) and opens a detail
  overlay: bottom sheet on mobile, modal on desktop; Escape + close button +
  focus management; body scroll locked while open (scroll position preserved);
  no login wall; booking selections untouched.
- Inner CTAs (maps link) stop propagation.
- Distance/time labels are localized via `formatDistanceLabel()` — "4 phút đi
  bộ" in VI, "4 min walk" in EN; walk times only when the data provides them;
  "0 km" renders as "Ngay tại chỗ ở". No shared stock images across different
  places; no invented hours, prices, ratings, or perks. Perks render only when
  an active partnership exists.
- Taxonomy: reuse `normalizePlaceExploreGroup()`; do not add duplicate tabs.

## Data honesty (all components)

- Never display values that were not provided: Wi-Fi, ratings, amenities,
  prices, distances, hours.
- No default/fake numbers (schema-level defaults like `google_rating = 4.8`
  are a known data issue — do not compound it in UI; label sources instead).
- Localize dates, money, decimals, and units through `src/lib/i18n.ts`
  helpers; no per-component hardcoded bilingual strings when the dictionary
  exists.

## Local Discovery (contribution, moderation, ranking)

- **One shared `places` database.** Hosts and the VietNomad team both contribute;
  never build parallel place stores. Hosts propose via the Listing Editor
  ("6. Giới thiệu khu vực"); proposals land in `place_suggestions` as `pending`
  and are **never public before moderation**.
- **Hosts never edit shared place data** and can only edit/unlink their own
  stay's `host_suggested` links. Unlinking removes the listing relationship
  only — the shared place row always survives.
- **Ranking on stay detail** (spec §7, `src/lib/discovery-ranking.ts`):
  onsite → host-approved links → VietNomad curated links → category radius
  (only when stay AND place have coordinates) → featured/fill. Radii live in
  `platform_settings` key `local_discovery` via `getLocalDiscoveryConfig()` —
  never hardcoded in components.
- **Distances are honest:** curated `distance_label` first; otherwise a
  privacy-rounded haversine (`≈800 m` / `≈1,2 km`) computed server-side.
  Never invent walk times. Stay coordinates never leave the server — the
  neighborhood maps link searches by neighborhood/city NAME, not lat/lng.
- **No fabricated fields:** `opening_hours` / `price_range` default to empty;
  blank values are simply not rendered. Host forms never ask for hours, price,
  ratings, commissions or commercial relationships.
- **Taxonomy is shared:** `src/lib/place-categories.ts` (11 categories) maps to
  `normalizePlaceExploreGroup` tabs — do not add parallel category lists.
- **Tracking:** `place_detail_view` / `place_map_click` / `place_website_click`
  via `/api/track` (`attribution_events.place_id`) — basic counts only, never
  treated as commercial transactions.
