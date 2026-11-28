# Content Style Guide

## 1. Writing Principles

1. **Every sentence needs a reason to exist.** If a subtitle repeats the heading or describes what the user can already see on screen, remove it.
2. **Say what is true, not what sounds impressive.** State real numbers (nights, fees, speeds, dates) from system settings and database records. Never fabricate quality guarantees.
3. **Skip internal architecture names in user copy.** Never expose internal model or engineering terms like *BookingFlow*, *StayDirect*, *BOS*, *RBAC*, or *entity* to Guests or Hosts (except inside internal Admin technical labels where strictly operational). Explain the payment or workflow directly: *"Pay the service fee online today to reserve, then pay your host at check-in."*
4. **Use natural punctuation.** Avoid stacking em-dashes (`—`) in UI sentences or titles. Use periods, commas, colons, or middle dots (`·`) cleanly for compact metadata.

---

## 2. Words and Patterns to Avoid

### Overused AI / Marketing Clichés
Avoid these words unless literally required by context:
- *Unlock*, *Elevate*, *Empower*
- *Seamlessly*, *Effortlessly*
- *Extraordinary*, *Unforgettable*, *Ultimate*, *Revolutionary*, *Cutting-edge*
- *Transform your experience*, *Embark on a journey*, *Discover a world of possibilities*
- *Experience the perfect blend of...*, *Designed to elevate your lifestyle*
- *Curated* (when used repeatedly as a filler adjective)
- *Oops!* (in error or empty states)

### Structural Anti-Patterns
- Long, vague hero headings that do not tell the user what the page does.
- Repeating the same value proposition across three sections on the same page.
- Three or four consecutive adjectives describing one feature.
- Forced subtitles under self-explanatory headings or cards.
- Generic slogans on operational buttons or dashboard forms.

---

## 3. Length Guidelines (Flexible Targets)

Prioritize clarity and complete financial/policy accuracy over strict word counts.

| Element | Target Length |
| --- | --- |
| Navigation Label | 1–3 words |
| Button / CTA | 1–4 words |
| Section Heading | 2–7 words |
| Card Title | 2–6 words |
| Card Description | 10–25 words |
| Hero Headline | 4–10 words |
| Hero Description | 10–25 words |
| Tooltip | 1 short sentence |
| Success Message | 1 short sentence |
| Error Message | Enough context to understand and fix |

**Important exception:** Never truncate payment breakdowns, fee percentages, cancellation policies, refund timelines, or legal rights if shortening removes critical user information.

---

## 4. Before & After Reference

| Context | Avoid (Before) | Use Instead (After) |
| --- | --- | --- |
| Hero headline | *Discover extraordinary stays designed to elevate your lifestyle.* | *Comfortable weekly and monthly stays in Vietnam.* |
| Hero subtitle | *Experience the perfect blend of comfort, productivity and adventure with unified BookingFlow.* | *Book by the week or month. Pay the service fee online, and pay rent to your host at check-in.* |
| Destination title | *Remote work stays in Da Nang* | *Stays in Da Nang* |
| Destination section | *Local Discovery in Da Nang — Curated coworking hubs, specialty coffee roasters...* | *Places to explore in Da Nang — Beaches, dining, cafes, workspaces, and daily essentials.* |
| Listing lock hint | *Exact address unlocks right after booking.* | *Exact address is shared once your booking is confirmed.* |
| Signup benefit | *Unlock direct host bookings, save favorite stays, and join local meetups.* | *Book stays, save favorites, and RSVP to local events.* |
| Empty search state | *Oops! It looks like there are no amazing stays available at the moment.* | *No stays found. Try changing your dates or filters.* |
| Host dashboard | *Seamlessly manage your properties and embark on your hosting journey.* | *Manage your listings.* |
| Admin delete dialog | *Delete this Local Discovery entity?* | *Remove this place? It will no longer appear on destination pages.* |

---

## 5. Financial, Policy & Dynamic Content Rules

- Always read fee rates (`service_fee_rate`, `host_commission_rate`, `vat_discount_rate`, `premium_reward_rate`), minimum nights (`default_min_nights`), and exchange rates (`fx_rates`) from `platform_settings` or the booking snapshot. Never hardcode `12%`, `4%`, `25,400`, or `7 nights` in static strings when a dynamic prop or template variable is available. The service-fee rate itself is never displayed as a percentage in UI — show absolute amounts only (decision2026-11-28).
- Preserve exact meaning on cancellation tiers (`Flexible`, `Moderate`, `Strict`), cooling-off refunds, and payout split (`service fee online` vs `rent paid at check-in`).
- Never claim a stay is "verified" unless `isWifiVerified` or `isWorkReady` is genuinely true in the database; otherwise display `Host reported` (`Chủ nhà tự khai báo`).
