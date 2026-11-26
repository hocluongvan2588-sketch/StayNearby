# UX Writing Guidelines

## 1. Navigation & Menus
- Keep labels to **1–3 words** using standard travel and operations terms (`Explore`, `Stays`, `Deals`, `Guides`, `Community`, `List your property`, `Dashboard`).
- Avoid inventing branded names for routine pages or tabs.

## 2. Headings & Descriptions
- Make headings immediately scannable so users know what they can do or read in that section.
- **Descriptions are optional.** If the heading is self-explanatory (e.g., *Saved stays*, *Account settings*, *Recent bookings*), omit the subtitle. Add a description only when it gives helpful context not already in the heading.

## 3. Buttons & Calls to Action (CTAs)
- Start with an action verb tied to the concrete outcome:
  - `Search`
  - `Check availability`
  - `Reserve` / `Book now`
  - `Apply code`
  - `Save changes`
  - `Continue`
  - `Submit listing`
  - `Send message`
  - `Add photos`
  - `View booking`
- Avoid vague or hype CTAs (`Unlock now`, `Discover more`, `Start your journey`, `Transform now`).

## 4. Form Labels, Placeholders & Tooltips
- Use clear nouns for labels (`City`, `Check-in date`, `Email`, `Tax ID`, `Promo code`).
- Use placeholders strictly for format examples (`you@domain.com`, `e.g. WELCOME10`), not to repeat the field label.
- Keep tooltips to one concise sentence clarifying why a rule or field exists.

## 5. Empty States
Tell the user what is missing and give them a clear next step:
- Saved stays: *"You haven’t saved any stays yet. Save places you like to compare them later."*
- Search results: *"No stays match these filters. Try adjusting your dates or clearing some filters."*
- Bookings: *"You have no bookings yet. Browse stays to plan your next trip."*
- Support tickets: *"No support tickets yet. Open a ticket anytime you need help with a booking or stay."*

## 6. Error Messages
- Explain **what went wrong** and **how to fix it** in plain language.
- Never blame the user, never use `"Oops!"`, and never dump raw technical codes or SQL/Zod syntax.
- Good: *"This promo code requires at least 14 nights. Add more nights or remove the code to continue."*
- Avoid: *"Invalid payload error: min_nights constraint failed."*

## 7. Success Messages
Confirm the completed action in one clear sentence:
- *"Changes saved."*
- *"Message sent."*
- *"Your listing has been submitted for review."*
- *"Booking confirmed. Check-in details are ready in your dashboard."*

## 8. Confirmation Dialogs
Before destructive or irreversible actions, state **what will happen** and its **consequence**:
- **Cancel booking:** *"Cancel booking VN-12345? Your dates will be released and eligible refunds will follow the property’s cancellation policy."*
- **Remove place / listing:** *"Remove this place? It will no longer appear on public destination pages."*
- **Issue refund:** *"Complete refund of 1,200,000 VND for booking VN-12345? This updates payment status and records a ledger entry."*
- **Suspend account / listing:** *"Suspend this listing? Guests will no longer see it in search results until reactivated."*
- Never use bare `"Are you sure?"` prompts.
