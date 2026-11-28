import { describe, it, expect } from 'vitest';
import {
  WIZARD_STEPS,
  TOTAL_WIZARD_STEPS,
  wizardStepKey,
  wizardStepNumber,
  initialWizardState,
  validateWizardStep,
  wizardStepPatchPayload,
  buildCreateDraftPayload,
  wizardStepStorageKey,
  type WizardFormState,
} from '@/lib/listing-wizard-steps';
import { listingPatchSchema } from '@/lib/listing-form-schema';

const CTX = { stayId: '3f8f2e1a-9c4b-4d6e-8a7f-1b2c3d4e5f60', roomsCount: 1 };

function validState(): WizardFormState {
  return {
    destinationSlug: 'da-nang',
    propertyType: 'apartment',
    titleEn: 'Sunlit studio near the beach',
    titleVi: 'Studio đầy nắng gần biển',
    subtitleEn: 'Weekly and monthly stays',
    subtitleVi: 'Lưu trú theo tuần và tháng',
    descriptionEn: 'A bright furnished studio built for long-stay remote workers.',
    descriptionVi: 'Studio đầy đủ nội thất cho người làm việc từ xa ở lại dài ngày.',
    heroImage: '/images/stays/hanoi-tayho-jade.jpg',
    galleryImages: ['/images/stays/hanoi-tayho-jade.jpg'],
    kitchenType: 'full',
    laundryType: 'in_unit',
    petFriendly: false,
    wheelchairFriendly: true,
    amenities: ['Fiber Wi-Fi', 'Coworking desk'],
    hasWorkspace: true,
    hasErgonomicChair: true,
    hasExternalMonitor: false,
    hasCallBooth: false,
    workspaceSummaryEn: 'Quiet corner desk with fast fiber.',
    workspaceSummaryVi: 'Góc làm việc yên tĩnh, fiber tốc độ cao.',
    wifiDownloadMbps: 350,
    neighborhoodEn: 'Son Tra',
    neighborhoodVi: 'Sơn Trà',
    exactAddress: '12 Vo Nguyen Giap Street, Son Tra, Da Nang',
    googleMapsUrl: '',
    checkinInstructionsEn: 'Self check-in with the smart lock code.',
    checkinInstructionsVi: 'Nhận phòng tự động bằng mã khóa thông minh.',
    checkinFrom: '14:00',
    checkoutBefore: '12:00',
    quietHours: '22:00–07:00',
    smokingAllowed: false,
    partiesAllowed: false,
    petsNote: 'Small pets on request.',
    extraGuestNote: 'Extra guest 200k VND per night.',
    cancellationPolicy: 'flexible',
    isInstantBook: true,
    defaultMinNights: 7,
  };
}

describe('wizard step registry', () => {
  it('has 11 unique steps with bilingual labels', () => {
    expect(TOTAL_WIZARD_STEPS).toBe(11);
    expect(WIZARD_STEPS).toHaveLength(11);
    const keys = WIZARD_STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(11);
    for (const s of WIZARD_STEPS) {
      expect(s.en.length).toBeGreaterThan(0);
      expect(s.vi.length).toBeGreaterThan(0);
    }
  });

  it('maps step numbers ↔ keys', () => {
    expect(wizardStepKey(1)).toBe('destination');
    expect(wizardStepKey(11)).toBe('review');
    expect(wizardStepKey(99)).toBe('review'); // clamped
    for (let n = 1; n <= TOTAL_WIZARD_STEPS; n++) {
      expect(wizardStepNumber(wizardStepKey(n))).toBe(n);
    }
  });
});

describe('validateWizardStep', () => {
  it('accepts a fully valid state on every step', () => {
    for (const s of WIZARD_STEPS) {
      expect(validateWizardStep(s.key, validState(), CTX)).toBeNull();
    }
  });

  it('destination: requires a slug only before the stay exists', () => {
    const empty = { ...validState(), destinationSlug: '' };
    expect(validateWizardStep('destination', empty, { stayId: null })?.vi).toContain('điểm đến');
    expect(validateWizardStep('destination', empty, CTX)).toBeNull(); // stay exists → fixed
    expect(validateWizardStep('destination', validState(), { stayId: null })).toBeNull();
  });

  it('titles: rejects short titles', () => {
    const bad = { ...validState(), titleEn: 'A' };
    expect(validateWizardStep('titles', bad, CTX)).not.toBeNull();
    expect(validateWizardStep('titles', { ...validState(), titleVi: '' }, CTX)).not.toBeNull();
  });

  it('description: rejects non-empty text under 10 chars, allows empty (no change)', () => {
    expect(
      validateWizardStep('description', { ...validState(), descriptionEn: 'short' }, CTX)
    ).not.toBeNull();
    expect(
      validateWizardStep('description', { ...validState(), descriptionEn: '' }, CTX)
    ).toBeNull();
  });

  it('photos: requires a cover image', () => {
    expect(
      validateWizardStep('photos', { ...validState(), heroImage: '' }, CTX)
    ).not.toBeNull();
  });

  it('amenities: rejects kitchen values outside the DB enum', () => {
    const bad = { ...validState(), kitchenType: 'wifi' as WizardFormState['kitchenType'] };
    expect(validateWizardStep('amenities', bad, CTX)).not.toBeNull();
  });

  it('location: requires all three core fields', () => {
    expect(
      validateWizardStep('location', { ...validState(), exactAddress: '' }, CTX)
    ).not.toBeNull();
    expect(
      validateWizardStep('location', { ...validState(), neighborhoodEn: '' }, CTX)
    ).not.toBeNull();
  });

  it('policies: enforces 7..90 minimum nights', () => {
    expect(
      validateWizardStep('policies', { ...validState(), defaultMinNights: 3 }, CTX)?.vi
    ).toContain('7');
    expect(
      validateWizardStep('policies', { ...validState(), defaultMinNights: 7 }, CTX)
    ).toBeNull();
  });

  it('rooms: requires at least one room', () => {
    expect(validateWizardStep('rooms', validState(), { ...CTX, roomsCount: 0 })).not.toBeNull();
    expect(validateWizardStep('rooms', validState(), { ...CTX, roomsCount: 2 })).toBeNull();
  });

  it('review: aggregates prior steps and surfaces the first failure', () => {
    const bad = { ...validState(), titleEn: 'X' };
    expect(validateWizardStep('review', bad, CTX)).not.toBeNull();
    expect(validateWizardStep('review', validState(), CTX)).toBeNull();
  });
});

describe('wizardStepPatchPayload — shared PATCH contract (drift guard)', () => {
  it('every step payload for a valid state passes listingPatchSchema', () => {
    for (const s of WIZARD_STEPS) {
      const payload = wizardStepPatchPayload(s.key, validState());
      expect(
        listingPatchSchema.safeParse(payload).success,
        `step ${s.key} payload must satisfy listingPatchSchema`
      ).toBe(true);
    }
  });

  it('titles payload carries only title fields (+ subtitles when set)', () => {
    const p = wizardStepPatchPayload('titles', validState());
    expect(Object.keys(p).sort()).toEqual([
      'subtitleEn',
      'subtitleVi',
      'titleEn',
      'titleVi',
    ]);
    const noSubs = wizardStepPatchPayload('titles', {
      ...validState(),
      subtitleEn: '',
      subtitleVi: '',
    });
    expect(noSubs).not.toHaveProperty('subtitleEn');
    expect(noSubs).not.toHaveProperty('subtitleVi');
  });

  it('rules payload nests houseRules and omits empty optional strings', () => {
    const p = wizardStepPatchPayload('rules', validState()) as {
      houseRules: Record<string, unknown>;
    };
    expect(p.houseRules.smokingAllowed).toBe(false);
    expect(p.houseRules.partiesAllowed).toBe(false);
    const empty = wizardStepPatchPayload('rules', {
      ...validState(),
      quietHours: '',
      petsNote: '',
    }) as { houseRules: Record<string, unknown> };
    expect(empty.houseRules).not.toHaveProperty('quietHours');
    expect(empty.houseRules).not.toHaveProperty('petsNote');
  });

  it('policies clamps defaultMinNights; destination maps propertyType only', () => {
    const p = wizardStepPatchPayload('policies', {
      ...validState(),
      defaultMinNights: 3,
    }) as { defaultMinNights: number };
    expect(p.defaultMinNights).toBe(7);
    expect(Object.keys(wizardStepPatchPayload('destination', validState()))).toEqual([
      'propertyType',
    ]);
  });

  it('rooms and review send no stay-level PATCH payload', () => {
    expect(wizardStepPatchPayload('rooms', validState())).toEqual({});
    expect(wizardStepPatchPayload('review', validState())).toEqual({});
  });
});

describe('buildCreateDraftPayload (POST /api/host/stays)', () => {
  it('maps destination + property type only', () => {
    expect(buildCreateDraftPayload(validState())).toEqual({
      destinationSlug: 'da-nang',
      propertyType: 'apartment',
    });
  });
});

describe('initialWizardState', () => {
  it('fresh state follows platform defaults (7 nights, flexible, full kitchen)', () => {
    const s = initialWizardState(null);
    expect(s.propertyType).toBe('apartment');
    expect(s.defaultMinNights).toBe(7);
    expect(s.cancellationPolicy).toBe('flexible');
    expect(s.kitchenType).toBe('full');
    expect(s.laundryType).toBe('in_unit');
    expect(s.destinationSlug).toBe('');
    expect(s.titleEn).toBe('');
  });

  it('hydrates from an existing draft stay (no stay_drafts involved)', () => {
    const stay = {
      id: 'x',
      propertyType: 'villa',
      titleEn: 'Existing draft',
      titleVi: 'Bản nháp hiện có',
      subtitleEn: 'sub',
      subtitleVi: 'phụ',
      descriptionEn: 'A long description for an existing draft listing.',
      descriptionVi: 'Mô tả dài cho bản nháp listing hiện có.',
      heroImage: '/images/hero.jpg',
      galleryImages: ['/images/hero.jpg'],
      kitchenType: 'kitchenette',
      laundryType: 'service',
      petFriendly: true,
      wheelchairFriendly: false,
      amenities: ['Wi-Fi'],
      hasWorkspace: false,
      hasErgonomicChair: false,
      hasExternalMonitor: true,
      hasCallBooth: false,
      workspaceSummaryEn: 'Desk by the window.',
      workspaceSummaryVi: 'Bàn cạnh cửa sổ.',
      wifiDownloadMbps: 200,
      neighborhoodEn: 'Hai Chau',
      neighborhoodVi: 'Hải Châu',
      exactAddress: '5 Bach Dang Street, Hai Chau, Da Nang',
      checkinInstructionsEn: 'Ring the bell at arrival.',
      checkinInstructionsVi: 'Bấm chuông khi tới nơi.',
      checkinFrom: '15:00',
      checkoutBefore: '11:00',
      houseRules: {
        quietHours: '23:00–06:00',
        smokingAllowed: true,
        partiesAllowed: false,
        petsNote: '',
        extraGuestNote: '',
      },
      cancellationPolicy: 'strict',
      isInstantBook: false,
      defaultMinNights: 30,
    } as unknown as Parameters<typeof initialWizardState>[0];

    const s = initialWizardState(stay);
    expect(s.propertyType).toBe('villa');
    expect(s.titleEn).toBe('Existing draft');
    expect(s.kitchenType).toBe('kitchenette');
    expect(s.smokingAllowed).toBe(true);
    expect(s.quietHours).toBe('23:00–06:00');
    expect(s.cancellationPolicy).toBe('strict');
    expect(s.defaultMinNights).toBe(30);
    expect(s.destinationSlug).toBe(''); // resolved via stayId context instead
  });
});

describe('resume storage key', () => {
  it('is namespaced per stay', () => {
    expect(wizardStepStorageKey('abc')).toBe('snw-wizard-step:abc');
    expect(wizardStepStorageKey('abc')).not.toBe(wizardStepStorageKey('def'));
  });
});
