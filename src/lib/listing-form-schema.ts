import { z } from 'zod';
import { HOST_MAX_NIGHTS, HOST_MIN_NIGHTS } from '@/lib/business-rules';

/**
 * Shared listing validation — single source for the Editor PATCH API and the
 * create Wizard's per-step validation (Phase 3). Field limits live here once;
 * step schemas reuse the same constraints so the two forms cannot drift.
 */

const coworkingSchema = z.object({
  name: z.string().min(1).max(120),
  distance: z.string().min(1).max(80),
});

const propertyTypeSchema = z.enum([
  'apartment',
  'coliving',
  'boutique_hotel',
  'villa',
  'eco_lodge',
]);
const kitchenTypeSchema = z.enum(['full', 'kitchenette', 'shared', 'none']);
const laundryTypeSchema = z.enum(['in_unit', 'building', 'service', 'none']);
const cancellationPolicySchema = z.enum(['flexible', 'moderate', 'strict']);

/** Full PATCH payload for `PATCH /api/host/stays/[id]` (all fields optional). */
export const listingPatchSchema = z.object({
  wholesale7Vnd: z.number().positive().optional(),
  wholesale14Vnd: z.number().positive().optional(),
  wholesale21Vnd: z.number().positive().optional(),
  wholesale30Vnd: z.number().positive().optional(),
  extraNightVnd: z.number().positive().optional(),
  isDealFeatured: z.boolean().optional(),
  dealMonthLabel: z.string().max(60).optional(),

  heroImage: z.string().min(1).max(600).optional(),
  workspacePhotoUrl: z.string().min(1).max(600).optional(),
  galleryImages: z.array(z.string().min(1).max(600)).max(24).optional(),

  titleEn: z.string().min(2).max(140).optional(),
  titleVi: z.string().min(2).max(140).optional(),
  subtitleEn: z.string().min(2).max(200).optional(),
  subtitleVi: z.string().min(2).max(200).optional(),
  descriptionEn: z.string().min(10).max(4000).optional(),
  descriptionVi: z.string().min(10).max(4000).optional(),
  neighborhoodEn: z.string().min(2).max(120).optional(),
  neighborhoodVi: z.string().min(2).max(120).optional(),
  exactAddress: z.string().min(4).max(300).optional(),
  checkinInstructionsEn: z.string().min(4).max(2000).optional(),
  checkinInstructionsVi: z.string().min(4).max(2000).optional(),
  propertyType: propertyTypeSchema.optional(),
  destinationId: z.string().uuid().optional(),
  wifiDownloadMbps: z.number().int().min(0).max(10000).optional(),
  isEntirePlace: z.boolean().optional(),
  bedrooms: z.number().int().min(1).max(30).nullable().optional(),
  bathrooms: z.number().int().min(1).max(30).nullable().optional(),
  areaSqm: z.number().int().min(8).max(5000).nullable().optional(),
  hostBioEn: z.string().max(1000).optional(),
  hostBioVi: z.string().max(1000).optional(),
  cancellationPolicy: cancellationPolicySchema.optional(),
  isInstantBook: z.boolean().optional(),
  workspaceSummaryEn: z.string().min(4).max(1500).optional(),
  workspaceSummaryVi: z.string().min(4).max(1500).optional(),
  hasWorkspace: z.boolean().optional(),
  hasErgonomicChair: z.boolean().optional(),
  hasExternalMonitor: z.boolean().optional(),
  hasCallBooth: z.boolean().optional(),
  kitchenType: kitchenTypeSchema.optional(),
  laundryType: laundryTypeSchema.optional(),
  petFriendly: z.boolean().optional(),
  wheelchairFriendly: z.boolean().optional(),
  amenities: z.array(z.string().min(1).max(80)).max(30).optional(),
  nearbyCoworking: z.array(coworkingSchema).max(8).optional(),
  status: z.enum(['live', 'paused']).optional(),
  checkinFrom: z.string().max(20).optional(),
  checkoutBefore: z.string().max(20).optional(),
  defaultMinNights: z.number().int().min(HOST_MIN_NIGHTS).max(HOST_MAX_NIGHTS).optional(),
  houseRules: z
    .object({
      quietHours: z.string().max(80).optional(),
      smokingAllowed: z.boolean().optional(),
      partiesAllowed: z.boolean().optional(),
      petsNote: z.string().max(300).optional(),
      extraGuestNote: z.string().max(300).optional(),
    })
    .optional(),
});

export type ListingPatchInput = z.infer<typeof listingPatchSchema>;

/* ---------------------------------------------------------------------------
 * Wizard step schemas (Phase 3) — same limits as the patch schema above.
 * ------------------------------------------------------------------------- */

/** Step 1 — Basics: identity + type + destination. */
export const listingBasicsStepSchema = z.object({
  titleEn: z.string().min(2).max(140),
  titleVi: z.string().min(2).max(140),
  subtitleEn: z.string().min(2).max(200).optional(),
  subtitleVi: z.string().min(2).max(200).optional(),
  descriptionEn: z.string().min(10).max(4000).optional(),
  descriptionVi: z.string().min(10).max(4000).optional(),
  propertyType: propertyTypeSchema,
  destinationId: z.string().uuid().optional(),
});

/** Step — Amenities (kitchen/laundry required — they default in the model). */
export const listingAmenitiesStepSchema = z.object({
  kitchenType: kitchenTypeSchema,
  laundryType: laundryTypeSchema,
  petFriendly: z.boolean().optional(),
  wheelchairFriendly: z.boolean().optional(),
  amenities: z.array(z.string().min(1).max(80)).max(30).optional(),
});

/** Step — Workspace & Wi-Fi (entirely optional by product policy). */
export const listingWorkspaceStepSchema = z.object({
  hasWorkspace: z.boolean().optional(),
  hasErgonomicChair: z.boolean().optional(),
  hasExternalMonitor: z.boolean().optional(),
  hasCallBooth: z.boolean().optional(),
  workspaceSummaryEn: z.string().min(4).max(1500).optional(),
  workspaceSummaryVi: z.string().min(4).max(1500).optional(),
  wifiDownloadMbps: z.number().int().min(0).max(10000).optional(),
});

/** Step — Location & check-in. */
export const listingLocationStepSchema = z.object({
  neighborhoodEn: z.string().min(2).max(120),
  neighborhoodVi: z.string().min(2).max(120),
  exactAddress: z.string().min(4).max(300),
  checkinInstructionsEn: z.string().min(4).max(2000).optional(),
  checkinInstructionsVi: z.string().min(4).max(2000).optional(),
});

/** Step — Booking policies. */
export const listingPoliciesStepSchema = z.object({
  checkinFrom: z.string().max(20).optional(),
  checkoutBefore: z.string().max(20).optional(),
  defaultMinNights: z.number().int().min(HOST_MIN_NIGHTS).max(HOST_MAX_NIGHTS).optional(),
  cancellationPolicy: cancellationPolicySchema.optional(),
  isInstantBook: z.boolean().optional(),
  houseRules: z
    .object({
      quietHours: z.string().max(80).optional(),
      smokingAllowed: z.boolean().optional(),
      partiesAllowed: z.boolean().optional(),
      petsNote: z.string().max(300).optional(),
      extraGuestNote: z.string().max(300).optional(),
    })
    .optional(),
});
