import { describe, it, expect } from 'vitest';
import {
  listingPatchSchema,
  listingBasicsStepSchema,
  listingAmenitiesStepSchema,
  listingWorkspaceStepSchema,
  listingLocationStepSchema,
  listingPoliciesStepSchema,
} from '@/lib/listing-form-schema';
import {
  PROPERTY_TYPE_OPTIONS,
  KITCHEN_OPTIONS,
  LAUNDRY_OPTIONS,
  CANCELLATION_POLICY_VALUES,
  listingOptionLabel,
} from '@/lib/listing-options';

const UUID = '3f8f2e1a-9c4b-4d6e-8a7f-1b2c3d4e5f60';

describe('listingPatchSchema (Editor PATCH contract)', () => {
  it('parses a valid partial payload', () => {
    const parsed = listingPatchSchema.parse({
      titleEn: 'Sunlit studio near Hoan Kiem',
      destinationId: UUID,
      wifiDownloadMbps: 350,
      kitchenType: 'full',
      status: 'paused',
    });
    expect(parsed.titleEn).toBe('Sunlit studio near Hoan Kiem');
    expect(parsed.wifiDownloadMbps).toBe(350);
  });

  it('rejects titleEn shorter than 2 / longer than 140', () => {
    expect(() => listingPatchSchema.parse({ titleEn: 'A' })).toThrow();
    expect(() => listingPatchSchema.parse({ titleEn: 'x'.repeat(141) })).toThrow();
  });

  it('rejects non-UUID destinationId', () => {
    expect(() => listingPatchSchema.parse({ destinationId: 1 })).toThrow();
    expect(() => listingPatchSchema.parse({ destinationId: 'not-a-uuid' })).toThrow();
    expect(listingPatchSchema.parse({ destinationId: UUID }).destinationId).toBe(UUID);
  });

  it('status enum accepts only live | paused (draft/pending set by lifecycle APIs)', () => {
    expect(() => listingPatchSchema.parse({ status: 'draft' })).toThrow();
    expect(() => listingPatchSchema.parse({ status: 'pending_review' })).toThrow();
    expect(listingPatchSchema.parse({ status: 'live' }).status).toBe('live');
  });

  it('defaultMinNights clamped by HOST_MIN_NIGHTS=7 .. HOST_MAX_NIGHTS=90', () => {
    expect(() => listingPatchSchema.parse({ defaultMinNights: 3 })).toThrow();
    expect(() => listingPatchSchema.parse({ defaultMinNights: 91 })).toThrow();
    expect(listingPatchSchema.parse({ defaultMinNights: 14 }).defaultMinNights).toBe(14);
  });

  it('rejects kitchenType outside the DB CHECK enum', () => {
    expect(() => listingPatchSchema.parse({ kitchenType: 'wifi' })).toThrow();
    expect(listingPatchSchema.parse({ kitchenType: 'kitchenette' }).kitchenType).toBe(
      'kitchenette'
    );
  });

  it('strips unknown keys (no arbitrary column writes)', () => {
    expect(
      'host_id' in listingPatchSchema.parse({ titleEn: 'Valid title', host_id: 'evil' })
    ).toBe(false);
  });
});

describe('listingBasicsStepSchema (wizard step 1)', () => {
  const base = {
    titleEn: 'Serviced apartment District 1',
    titleVi: 'Căn hộ Quận 1',
    propertyType: 'apartment' as const,
  };

  it('parses required identity fields with optional destination', () => {
    expect(listingBasicsStepSchema.parse(base)).toMatchObject({
      titleEn: base.titleEn,
      titleVi: base.titleVi,
      propertyType: 'apartment',
    });
  });

  it('requires both titleEn and titleVi', () => {
    expect(() =>
      listingBasicsStepSchema.parse({ titleEn: base.titleEn, propertyType: base.propertyType })
    ).toThrow();
    expect(() =>
      listingBasicsStepSchema.parse({ titleVi: base.titleVi, propertyType: base.propertyType })
    ).toThrow();
  });

  it('rejects short title and unknown propertyType', () => {
    expect(() => listingBasicsStepSchema.parse({ ...base, titleEn: 'A' })).toThrow();
    expect(() => listingBasicsStepSchema.parse({ ...base, propertyType: 'treehouse' })).toThrow();
  });

  it('accepts UUID destinationId, rejects garbage', () => {
    expect(listingBasicsStepSchema.parse({ ...base, destinationId: UUID })).toHaveProperty(
      'destinationId',
      UUID
    );
    expect(() => listingBasicsStepSchema.parse({ ...base, destinationId: 'x' })).toThrow();
  });
});

describe('listingAmenitiesStepSchema (wizard step 2)', () => {
  it('parses required kitchen/laundry matching DB CHECK enums', () => {
    expect(
      listingAmenitiesStepSchema.parse({
        kitchenType: 'full',
        laundryType: 'service',
        petFriendly: true,
      })
    ).toMatchObject({ kitchenType: 'full', laundryType: 'service', petFriendly: true });
  });

  it('requires kitchenType and laundryType', () => {
    expect(() => listingAmenitiesStepSchema.parse({ laundryType: 'none' })).toThrow();
    expect(() => listingAmenitiesStepSchema.parse({ kitchenType: 'shared' })).toThrow();
  });

  it('rejects legacy/unknown enum values', () => {
    expect(() =>
      listingAmenitiesStepSchema.parse({ kitchenType: 'wifi', laundryType: 'in_unit' })
    ).toThrow();
    expect(() =>
      listingAmenitiesStepSchema.parse({ kitchenType: 'full', laundryType: 'butler' })
    ).toThrow();
    expect(() =>
      listingAmenitiesStepSchema.parse({
        kitchenType: 'full',
        laundryType: 'none',
        petFriendly: 'yes',
      })
    ).toThrow();
  });
});

describe('listingWorkspaceStepSchema (wizard step 3, optional by policy)', () => {
  it('every field optional — empty object parses', () => {
    expect(listingWorkspaceStepSchema.parse({})).toEqual({});
  });

  it('parses flags and wifi', () => {
    expect(
      listingWorkspaceStepSchema.parse({
        hasWorkspace: true,
        hasCallBooth: true,
        wifiDownloadMbps: 350,
      })
    ).toMatchObject({ hasWorkspace: true, wifiDownloadMbps: 350 });
  });

  it('rejects non-boolean flags and out-of-range wifi', () => {
    expect(() => listingWorkspaceStepSchema.parse({ hasWorkspace: 'true' })).toThrow();
    expect(() => listingWorkspaceStepSchema.parse({ wifiDownloadMbps: -1 })).toThrow();
    expect(() => listingWorkspaceStepSchema.parse({ wifiDownloadMbps: 10001 })).toThrow();
  });
});

describe('listingLocationStepSchema (wizard step 4)', () => {
  const valid = {
    neighborhoodEn: 'District 1',
    neighborhoodVi: 'Quận 1',
    exactAddress: '12 Le Loi Street, District 1, Ho Chi Minh City',
  };

  it('parses required identity fields', () => {
    expect(listingLocationStepSchema.parse(valid)).toMatchObject({
      neighborhoodEn: 'District 1',
    });
  });

  it('requires all three core fields', () => {
    expect(() => listingLocationStepSchema.parse({})).toThrow();
    expect(() =>
      listingLocationStepSchema.parse({ neighborhoodEn: 'District 1' })
    ).toThrow();
    expect(() =>
      listingLocationStepSchema.parse({
        neighborhoodEn: 'District 1',
        neighborhoodVi: 'Quận 1',
      })
    ).toThrow();
  });

  it('check-in instructions optional', () => {
    expect(listingLocationStepSchema.parse(valid).checkinInstructionsEn).toBeUndefined();
  });
});

describe('listingPoliciesStepSchema (wizard step 5)', () => {
  it('all fields optional with no imposed defaults', () => {
    expect(listingPoliciesStepSchema.parse({})).toEqual({});
  });

  it('defaultMinNights respects 7..90 platform rules', () => {
    expect(() => listingPoliciesStepSchema.parse({ defaultMinNights: 6 })).toThrow();
    expect(() => listingPoliciesStepSchema.parse({ defaultMinNights: 91 })).toThrow();
    expect(
      listingPoliciesStepSchema.parse({ defaultMinNights: 7 }).defaultMinNights
    ).toBe(7);
  });

  it('cancellation policy uses DB values flexible | moderate | strict', () => {
    expect(
      listingPoliciesStepSchema.parse({ cancellationPolicy: 'moderate' }).cancellationPolicy
    ).toBe('moderate');
    expect(() =>
      listingPoliciesStepSchema.parse({ cancellationPolicy: 'strict_14d' })
    ).toThrow();
  });

  it('validates nested houseRules types', () => {
    expect(
      listingPoliciesStepSchema.parse({
        houseRules: { quietHours: '22:00-07:00', smokingAllowed: false },
      })
    ).toHaveProperty('houseRules.smokingAllowed', false);
    expect(() =>
      listingPoliciesStepSchema.parse({ houseRules: { smokingAllowed: 'no' } })
    ).toThrow();
  });
});

describe('step → patch drift guard (shared single source)', () => {
  const basics = listingBasicsStepSchema.parse({
    titleEn: 'Loft with river view',
    titleVi: 'Gác lỗng nhìn sông',
    propertyType: 'eco_lodge',
    destinationId: UUID,
  });
  const amenities = listingAmenitiesStepSchema.parse({
    kitchenType: 'kitchenette',
    laundryType: 'building',
  });
  const location = listingLocationStepSchema.parse({
    neighborhoodEn: 'Hoi An',
    neighborhoodVi: 'Hội An',
    exactAddress: '5 Nguyen Trai Street, Hoi An',
  });
  const policies = listingPoliciesStepSchema.parse({
    defaultMinNights: 14,
    cancellationPolicy: 'strict',
  });

  it('every step payload is accepted by listingPatchSchema', () => {
    expect(listingPatchSchema.safeParse(basics).success).toBe(true);
    expect(listingPatchSchema.safeParse(amenities).success).toBe(true);
    expect(listingPatchSchema.safeParse(location).success).toBe(true);
    expect(listingPatchSchema.safeParse(policies).success).toBe(true);
  });
});

describe('listing-options (shared bilingual labels)', () => {
  it('property values match the DB CHECK enum exactly', () => {
    expect(PROPERTY_TYPE_OPTIONS.map((o) => o.value)).toEqual([
      'apartment',
      'coliving',
      'boutique_hotel',
      'villa',
      'eco_lodge',
    ]);
    expect(PROPERTY_TYPE_OPTIONS.map((o) => o.en)).toEqual([
      'Serviced Apartment',
      'Coliving House',
      'Boutique Hotel',
      'Villa',
      'Eco Lodge',
    ]);
    expect(PROPERTY_TYPE_OPTIONS.every((o) => o.vi.length > 0)).toBe(true);
  });

  it('kitchen/laundry values match DB CHECK enums', () => {
    expect(KITCHEN_OPTIONS.map((o) => o.value)).toEqual([
      'full',
      'kitchenette',
      'shared',
      'none',
    ]);
    expect(KITCHEN_OPTIONS.map((o) => o.en)).toEqual([
      'Full kitchen',
      'Kitchenette',
      'Shared kitchen',
      'No kitchen',
    ]);
    expect(LAUNDRY_OPTIONS.map((o) => o.value)).toEqual([
      'in_unit',
      'building',
      'service',
      'none',
    ]);
    expect(LAUNDRY_OPTIONS.map((o) => o.en)).toEqual([
      'In-unit',
      'Building laundry',
      'Laundry service',
      'None',
    ]);
  });

  it('cancellation values match DB CHECK exactly', () => {
    expect(CANCELLATION_POLICY_VALUES).toEqual(['flexible', 'moderate', 'strict']);
  });

  it('listingOptionLabel renders both locales, falls back to value', () => {
    expect(listingOptionLabel(PROPERTY_TYPE_OPTIONS, 'apartment', 'vi')).toBe('Căn hộ dịch vụ');
    expect(listingOptionLabel(PROPERTY_TYPE_OPTIONS, 'apartment', 'en')).toBe(
      'Serviced Apartment'
    );
    expect(listingOptionLabel(PROPERTY_TYPE_OPTIONS, 'eco_lodge', 'vi')).toBe(
      'Nhà gỗ nghỉ dưỡng'
    );
    expect(listingOptionLabel(KITCHEN_OPTIONS, 'full', 'vi')).toBe('Bếp nấu riêng đầy đủ');
    expect(listingOptionLabel(LAUNDRY_OPTIONS, 'service', 'en')).toBe('Laundry service');
    expect(listingOptionLabel(KITCHEN_OPTIONS, 'unknown-value', 'en')).toBe('unknown-value');
  });
});
