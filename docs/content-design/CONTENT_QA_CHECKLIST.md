# Content & UX Copy QA Checklist

Run this checklist before shipping any new page, component, API error message, email template, or copy edit.

## 1. Brand & Positioning
- [ ] Copy reflects **Stay · Work (when needed) · Live · Explore**, not exclusively Digital Nomads or Remote Work.
- [ ] No false claims about verification, Wi-Fi testing, safety guarantees, or instant policies unless backed by DB flags.
- [ ] Internal engineering terms (*BookingFlow*, *StayDirect*, *BOS*, *entity*) are kept out of Guest/Host-facing copy.

## 2. Anti-AI & Clarity Check
- [ ] Zero AI clichés (*Unlock*, *Elevate*, *Empower*, *Seamlessly*, *Effortlessly*, *Extraordinary*, *Unforgettable*, *Ultimate*, *Transform your experience*, *Embark on a journey*, *Curated* as filler).
- [ ] Headings clearly tell the user what the section or page is for.
- [ ] No redundant subtitles repeating what the heading or UI already shows.
- [ ] No `"Oops!"` in error messages or empty states.
- [ ] Punctuation uses natural periods/commas instead of stacked em-dashes (`—`).

## 3. Tone Fit by Surface
- [ ] **Guest Platform:** Friendly, clear, helpful, discovery-oriented.
- [ ] **Host Console:** Direct, practical, action-oriented (no promotional hype).
- [ ] **Admin BOS:** Neutral, accurate, operational (no marketing fluff).

## 4. Data Integrity & Legal Accuracy
- [ ] Dynamic figures (`serviceFeePct`, `hostCommissionPct`, `premiumRewardPct`, `fxRates`, `minNights`, promo values) come from live config/props, not hardcoded strings.
- [ ] Price split (`service fee online` vs `rent at check-in`), cancellation policy terms, and refund timelines remain complete and unambiguous.
- [ ] User-generated DB records (host titles/descriptions, guest reviews, ticket messages) were not overwritten.

## 5. Localization & Formatting
- [ ] Both `en` and `vi` variants read naturally in their own language with no mixed-language sentences.
- [ ] Singular/plural rules work cleanly (`1 night` vs `7 nights`).
- [ ] Labels, placeholders, tooltips, error states, empty states, and confirmation dialogs follow `MICROCOPY_PATTERNS.md`.

## 6. Visual & Layout Fit
- [ ] Checked copy inside rendered desktop (`1440px`), tablet (`768px`), and mobile (`375px`) viewports (or responsive container bounds).
- [ ] No clipped text, awkward multi-line button wrapping, broken table headers, or horizontal overflow.
- [ ] SEO metadata (`title`, `description`) and accessibility labels (`aria-label`, `alt`) match the updated positioning and terminology.
