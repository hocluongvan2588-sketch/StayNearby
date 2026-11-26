export const HOST_LEAD_STAGES = [
  'new_lead',
  'contacted',
  'interested',
  'onboarding',
  'under_review',
  'published',
  'first_booking',
  'active',
  'lost',
  'inactive',
] as const;

export type HostLeadStage = (typeof HOST_LEAD_STAGES)[number];
