import {
  listingBasicsStepSchema,
  listingAmenitiesStepSchema,
  listingWorkspaceStepSchema,
  listingLocationStepSchema,
  listingPoliciesStepSchema,
} from '@/lib/listing-form-schema';
import { clampHostMinNights } from '@/lib/business-rules';
import type {
  PropertyTypeValue,
  KitchenTypeValue,
  LaundryTypeValue,
  CancellationPolicyValue,
} from '@/lib/listing-options';
import type { HostStaySummary } from '@/modules/host';

/**
 * New listing wizard (Phase 3) — pure step logic shared by the wizard UI and
 * tests. Validation reuses the SAME zod schemas as the Editor PATCH contract
 * (src/lib/listing-form-schema.ts) so the two forms cannot drift.
 */

export const WIZARD_STEPS = [
  { key: 'destination', en: 'Destination & type', vi: 'Điểm đến & loại hình' },
  { key: 'titles', en: 'Titles', vi: 'Tiêu đề' },
  { key: 'description', en: 'Description', vi: 'Mô tả' },
  { key: 'photos', en: 'Photos', vi: 'Hình ảnh' },
  { key: 'amenities', en: 'Amenities', vi: 'Tiện nghi' },
  { key: 'workspace', en: 'Workspace & Wi-Fi', vi: 'Góc làm việc & Wi-Fi' },
  { key: 'location', en: 'Location', vi: 'Vị trí' },
  { key: 'rules', en: 'House rules', vi: 'Nội quy' },
  { key: 'policies', en: 'Policies', vi: 'Chính sách' },
  { key: 'rooms', en: 'Rooms & pricing', vi: 'Phòng & bảng giá' },
  { key: 'review', en: 'Review & submit', vi: 'Kiểm tra & gửi duyệt' },
] as const;

export type WizardStepKey = (typeof WIZARD_STEPS)[number]['key'];

export const TOTAL_WIZARD_STEPS = WIZARD_STEPS.length; // 11

export function wizardStepKey(step: number): WizardStepKey {
  const idx = Math.min(TOTAL_WIZARD_STEPS, Math.max(1, Math.round(step))) - 1;
  return WIZARD_STEPS[idx].key;
}

export function wizardStepNumber(key: WizardStepKey): number {
  return WIZARD_STEPS.findIndex((s) => s.key === key) + 1;
}

export interface WizardStepError {
  en: string;
  vi: string;
}

export interface WizardValidateContext {
  /** Present once the draft stay exists (Listing ID assigned). */
  stayId?: string | null;
  /** Live room count from the rooms API (not part of the PATCH state). */
  roomsCount?: number;
}

/** All PATCH-able listing fields the wizard edits. */
export interface WizardFormState {
  destinationSlug: string;
  propertyType: PropertyTypeValue;
  titleEn: string;
  titleVi: string;
  subtitleEn: string;
  subtitleVi: string;
  descriptionEn: string;
  descriptionVi: string;
  heroImage: string;
  galleryImages: string[];
  kitchenType: KitchenTypeValue;
  laundryType: LaundryTypeValue;
  petFriendly: boolean;
  wheelchairFriendly: boolean;
  amenities: string[];
  hasWorkspace: boolean;
  hasErgonomicChair: boolean;
  hasExternalMonitor: boolean;
  hasCallBooth: boolean;
  workspaceSummaryEn: string;
  workspaceSummaryVi: string;
  /** NULL = chưa cập nhật (no default speeds). */
  wifiDownloadMbps: number | null;
  neighborhoodEn: string;
  neighborhoodVi: string;
  exactAddress: string;
  googleMapsUrl: string;
  checkinInstructionsEn: string;
  checkinInstructionsVi: string;
  checkinFrom: string;
  checkoutBefore: string;
  quietHours: string;
  smokingAllowed: boolean;
  partiesAllowed: boolean;
  petsNote: string;
  extraGuestNote: string;
  cancellationPolicy: CancellationPolicyValue;
  isInstantBook: boolean;
  defaultMinNights: number;
}

/** Fresh wizard state (no stay yet) or state hydrated from an existing draft stay. */
export function initialWizardState(stay: HostStaySummary | null): WizardFormState {
  if (!stay) {
    return {
      destinationSlug: '',
      propertyType: 'apartment',
      titleEn: '',
      titleVi: '',
      subtitleEn: '',
      subtitleVi: '',
      descriptionEn: '',
      descriptionVi: '',
      heroImage: '',
      galleryImages: [],
      kitchenType: 'full',
      laundryType: 'in_unit',
      petFriendly: false,
      wheelchairFriendly: false,
      amenities: [],
      hasWorkspace: true,
      hasErgonomicChair: false,
      hasExternalMonitor: false,
      hasCallBooth: false,
      workspaceSummaryEn: '',
      workspaceSummaryVi: '',
      wifiDownloadMbps: null,
      neighborhoodEn: '',
      neighborhoodVi: '',
      exactAddress: '',
      googleMapsUrl: '',
      checkinInstructionsEn: '',
      checkinInstructionsVi: '',
      checkinFrom: '14:00',
      checkoutBefore: '12:00',
      quietHours: '',
      smokingAllowed: false,
      partiesAllowed: false,
      petsNote: '',
      extraGuestNote: '',
      cancellationPolicy: 'flexible',
      isInstantBook: true,
      defaultMinNights: 7,
    };
  }
  return {
    destinationSlug: '',
    propertyType: stay.propertyType,
    titleEn: stay.titleEn,
    titleVi: stay.titleVi,
    subtitleEn: stay.subtitleEn,
    subtitleVi: stay.subtitleVi,
    descriptionEn: stay.descriptionEn,
    descriptionVi: stay.descriptionVi,
    heroImage: stay.heroImage,
    galleryImages: stay.galleryImages,
    kitchenType: stay.kitchenType,
    laundryType: stay.laundryType,
    petFriendly: stay.petFriendly,
    wheelchairFriendly: stay.wheelchairFriendly,
    amenities: stay.amenities,
    hasWorkspace: stay.hasWorkspace,
    hasErgonomicChair: stay.hasErgonomicChair,
    hasExternalMonitor: stay.hasExternalMonitor,
    hasCallBooth: stay.hasCallBooth,
    workspaceSummaryEn: stay.workspaceSummaryEn,
    workspaceSummaryVi: stay.workspaceSummaryVi,
    wifiDownloadMbps: stay.wifiDownloadMbps,
    neighborhoodEn: stay.neighborhoodEn,
    neighborhoodVi: stay.neighborhoodVi,
    exactAddress: stay.exactAddress,
    googleMapsUrl: stay.googleMapsUrl ?? '',
    checkinInstructionsEn: stay.checkinInstructionsEn,
    checkinInstructionsVi: stay.checkinInstructionsVi,
    checkinFrom: stay.checkinFrom,
    checkoutBefore: stay.checkoutBefore,
    quietHours: stay.houseRules.quietHours,
    smokingAllowed: stay.houseRules.smokingAllowed,
    partiesAllowed: stay.houseRules.partiesAllowed,
    petsNote: stay.houseRules.petsNote,
    extraGuestNote: stay.houseRules.extraGuestNote,
    cancellationPolicy: stay.cancellationPolicy,
    isInstantBook: stay.isInstantBook,
    defaultMinNights: clampHostMinNights(stay.defaultMinNights || 7),
  };
}

/** Bilingual messages keyed by zod issue path (shared-schema errors → UI copy). */
const FIELD_MESSAGES: Record<string, WizardStepError> = {
  titleEn: {
    en: 'Title (EN) must be 2–140 characters.',
    vi: 'Tiêu đề (EN) cần từ 2–140 ký tự.',
  },
  titleVi: {
    en: 'Title (VI) must be 2–140 characters.',
    vi: 'Tiêu đề (VI) cần từ 2–140 ký tự.',
  },
  subtitleEn: {
    en: 'Subtitle (EN) must be 2–200 characters.',
    vi: 'Phụ đề (EN) cần từ 2–200 ký tự.',
  },
  subtitleVi: {
    en: 'Subtitle (VI) must be 2–200 characters.',
    vi: 'Phụ đề (VI) cần từ 2–200 ký tự.',
  },
  descriptionEn: {
    en: 'Description (EN) needs at least 10 characters.',
    vi: 'Mô tả (EN) cần ít nhất 10 ký tự.',
  },
  descriptionVi: {
    en: 'Description (VI) needs at least 10 characters.',
    vi: 'Mô tả (VI) cần ít nhất 10 ký tự.',
  },
  propertyType: {
    en: 'Choose a valid property type.',
    vi: 'Chọn loại hình chỗ ở hợp lệ.',
  },
  kitchenType: { en: 'Choose a kitchen option.', vi: 'Chọn phương án bếp.' },
  laundryType: { en: 'Choose a laundry option.', vi: 'Chọn phương án giặt sấy.' },
  neighborhoodEn: {
    en: 'Neighborhood (EN) must be 2–120 characters.',
    vi: 'Khu vực (EN) cần từ 2–120 ký tự.',
  },
  neighborhoodVi: {
    en: 'Neighborhood (VI) must be 2–120 characters.',
    vi: 'Khu vực (VI) cần từ 2–120 ký tự.',
  },
  exactAddress: {
    en: 'Exact address must be 4–300 characters.',
    vi: 'Địa chỉ chính xác cần từ 4–300 ký tự.',
  },
  checkinInstructionsEn: {
    en: 'Check-in instructions (EN) need at least 4 characters.',
    vi: 'Hướng dẫn nhận phòng (EN) cần ít nhất 4 ký tự.',
  },
  checkinInstructionsVi: {
    en: 'Check-in instructions (VI) need at least 4 characters.',
    vi: 'Hướng dẫn nhận phòng (VI) cần ít nhất 4 ký tự.',
  },
  defaultMinNights: {
    en: 'Minimum nights must be between 7 and 90.',
    vi: 'Số đêm tối thiểu phải từ 7 đến 90.',
  },
  cancellationPolicy: {
    en: 'Choose a cancellation policy.',
    vi: 'Chọn chính sách hủy.',
  },
  wifiDownloadMbps: {
    en: 'Wi-Fi speed must be between 0 and 10000 Mbps.',
    vi: 'Tốc độ Wi-Fi phải từ 0 đến 10000 Mbps.',
  },
};

function firstSchemaError(issues: readonly { path: readonly PropertyKey[] }[]): WizardStepError {
  const path = (issues[0]?.path ?? []).map(String).join('.');
  return (
    FIELD_MESSAGES[path] ?? {
      en: 'Please check the fields on this step.',
      vi: 'Vui lòng kiểm tra các trường ở bước này.',
    }
  );
}

/**
 * Validate one wizard step. Returns a bilingual error or null when the step
 * may advance. Empty optional strings are treated as "not provided" (matching
 * zod `.optional()` PATCH semantics — they never clear stored values).
 */
export function validateWizardStep(
  step: WizardStepKey,
  state: WizardFormState,
  ctx: WizardValidateContext = {}
): WizardStepError | null {
  switch (step) {
    case 'destination': {
      // Pre-create: a destination must be picked. Post-create it is fixed.
      if (ctx.stayId) return null;
      if (!state.destinationSlug.trim()) {
        return {
          en: 'Choose a destination in Vietnam.',
          vi: 'Chọn điểm đến tại Việt Nam.',
        };
      }
      return null;
    }
    case 'titles': {
      const r = listingBasicsStepSchema.safeParse({
        titleEn: state.titleEn,
        titleVi: state.titleVi,
        subtitleEn: state.subtitleEn.trim() || undefined,
        subtitleVi: state.subtitleVi.trim() || undefined,
        propertyType: state.propertyType,
      });
      return r.success ? null : firstSchemaError(r.error.issues);
    }
    case 'description': {
      const r = listingBasicsStepSchema.safeParse({
        titleEn: state.titleEn,
        titleVi: state.titleVi,
        propertyType: state.propertyType,
        descriptionEn: state.descriptionEn.trim() || undefined,
        descriptionVi: state.descriptionVi.trim() || undefined,
      });
      return r.success ? null : firstSchemaError(r.error.issues);
    }
    case 'photos': {
      if (!state.heroImage.trim()) {
        return {
          en: 'Add at least one photo for the listing cover.',
          vi: 'Thêm ít nhất một ảnh làm ảnh bìa.',
        };
      }
      return null;
    }
    case 'amenities': {
      const r = listingAmenitiesStepSchema.safeParse({
        kitchenType: state.kitchenType,
        laundryType: state.laundryType,
        petFriendly: state.petFriendly,
        wheelchairFriendly: state.wheelchairFriendly,
        amenities: state.amenities,
      });
      return r.success ? null : firstSchemaError(r.error.issues);
    }
    case 'workspace': {
      const r = listingWorkspaceStepSchema.safeParse({
        hasWorkspace: state.hasWorkspace,
        hasErgonomicChair: state.hasErgonomicChair,
        hasExternalMonitor: state.hasExternalMonitor,
        hasCallBooth: state.hasCallBooth,
        workspaceSummaryEn: state.workspaceSummaryEn.trim() || undefined,
        workspaceSummaryVi: state.workspaceSummaryVi.trim() || undefined,
        wifiDownloadMbps: state.wifiDownloadMbps,
      });
      return r.success ? null : firstSchemaError(r.error.issues);
    }
    case 'location': {
      const r = listingLocationStepSchema.safeParse({
        neighborhoodEn: state.neighborhoodEn,
        neighborhoodVi: state.neighborhoodVi,
        exactAddress: state.exactAddress,
        googleMapsUrl: state.googleMapsUrl.trim() || undefined,
        checkinInstructionsEn: state.checkinInstructionsEn.trim() || undefined,
        checkinInstructionsVi: state.checkinInstructionsVi.trim() || undefined,
      });
      return r.success ? null : firstSchemaError(r.error.issues);
    }
    case 'rules': {
      const r = listingPoliciesStepSchema.safeParse({
        checkinFrom: state.checkinFrom.trim() || undefined,
        checkoutBefore: state.checkoutBefore.trim() || undefined,
        houseRules: {
          quietHours: state.quietHours.trim() || undefined,
          smokingAllowed: state.smokingAllowed,
          partiesAllowed: state.partiesAllowed,
          petsNote: state.petsNote.trim() || undefined,
          extraGuestNote: state.extraGuestNote.trim() || undefined,
        },
      });
      return r.success ? null : firstSchemaError(r.error.issues);
    }
    case 'policies': {
      const r = listingPoliciesStepSchema.safeParse({
        defaultMinNights: state.defaultMinNights,
        cancellationPolicy: state.cancellationPolicy,
        isInstantBook: state.isInstantBook,
      });
      return r.success ? null : firstSchemaError(r.error.issues);
    }
    case 'rooms': {
      if ((ctx.roomsCount ?? 1) < 1) {
        return { en: 'Add at least one room.', vi: 'Thêm ít nhất một phòng.' };
      }
      return null;
    }
    case 'review': {
      const prior: WizardStepKey[] = [
        'destination',
        'titles',
        'description',
        'photos',
        'amenities',
        'workspace',
        'location',
        'rules',
        'policies',
        'rooms',
      ];
      for (const s of prior) {
        const err = validateWizardStep(s, state, ctx);
        if (err) return err;
      }
      return null;
    }
  }
}

/**
 * PATCH body for a step — only fields that step owns. Empty optional strings
 * are omitted so PATCH semantics ("absent = no change") hold; the result is
 * always checked against `listingPatchSchema` before being sent (drift guard).
 */
export function wizardStepPatchPayload(
  step: WizardStepKey,
  state: WizardFormState
): Record<string, unknown> {
  switch (step) {
    case 'destination':
      return { propertyType: state.propertyType };
    case 'titles':
      return {
        titleEn: state.titleEn,
        titleVi: state.titleVi,
        ...(state.subtitleEn.trim() ? { subtitleEn: state.subtitleEn } : {}),
        ...(state.subtitleVi.trim() ? { subtitleVi: state.subtitleVi } : {}),
      };
    case 'description':
      return {
        ...(state.descriptionEn.trim() ? { descriptionEn: state.descriptionEn } : {}),
        ...(state.descriptionVi.trim() ? { descriptionVi: state.descriptionVi } : {}),
      };
    case 'photos':
      return { heroImage: state.heroImage, galleryImages: state.galleryImages };
    case 'amenities':
      return {
        kitchenType: state.kitchenType,
        laundryType: state.laundryType,
        petFriendly: state.petFriendly,
        wheelchairFriendly: state.wheelchairFriendly,
        amenities: state.amenities,
      };
    case 'workspace':
      return {
        hasWorkspace: state.hasWorkspace,
        hasErgonomicChair: state.hasErgonomicChair,
        hasExternalMonitor: state.hasExternalMonitor,
        hasCallBooth: state.hasCallBooth,
        ...(state.workspaceSummaryEn.trim()
          ? { workspaceSummaryEn: state.workspaceSummaryEn }
          : {}),
        ...(state.workspaceSummaryVi.trim()
          ? { workspaceSummaryVi: state.workspaceSummaryVi }
          : {}),
        wifiDownloadMbps: state.wifiDownloadMbps,
      };
    case 'location':
      return {
        neighborhoodEn: state.neighborhoodEn,
        neighborhoodVi: state.neighborhoodVi,
        exactAddress: state.exactAddress,
        ...(state.googleMapsUrl.trim() ? { googleMapsUrl: state.googleMapsUrl.trim() } : {}),
        ...(state.checkinInstructionsEn.trim()
          ? { checkinInstructionsEn: state.checkinInstructionsEn }
          : {}),
        ...(state.checkinInstructionsVi.trim()
          ? { checkinInstructionsVi: state.checkinInstructionsVi }
          : {}),
      };
    case 'rules':
      return {
        ...(state.checkinFrom.trim() ? { checkinFrom: state.checkinFrom } : {}),
        ...(state.checkoutBefore.trim() ? { checkoutBefore: state.checkoutBefore } : {}),
        houseRules: {
          ...(state.quietHours.trim() ? { quietHours: state.quietHours } : {}),
          smokingAllowed: state.smokingAllowed,
          partiesAllowed: state.partiesAllowed,
          ...(state.petsNote.trim() ? { petsNote: state.petsNote } : {}),
          ...(state.extraGuestNote.trim() ? { extraGuestNote: state.extraGuestNote } : {}),
        },
      };
    case 'policies':
      return {
        defaultMinNights: clampHostMinNights(state.defaultMinNights),
        cancellationPolicy: state.cancellationPolicy,
        isInstantBook: state.isInstantBook,
      };
    case 'rooms':
    case 'review':
      // Rooms are saved through the rooms API; review re-validates everything.
      return {};
  }
}

/** POST /api/host/stays body — creates the draft stay and assigns the Listing ID. */
export function buildCreateDraftPayload(state: WizardFormState): {
  destinationSlug: string;
  propertyType: PropertyTypeValue;
} {
  return {
    destinationSlug: state.destinationSlug.trim(),
    propertyType: state.propertyType,
  };
}

/* --------------------------------------------------------------------------
 * Resume: current step is kept in localStorage per stay (no stay_drafts rows
 * in the new flow — directive). Cleared storage falls back to step 1.
 * ------------------------------------------------------------------------ */

const STEP_STORAGE_PREFIX = 'snw-wizard-step:';

export function wizardStepStorageKey(stayId: string): string {
  return `${STEP_STORAGE_PREFIX}${stayId}`;
}

export function loadWizardStep(stayId: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(wizardStepStorageKey(stayId));
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const step = Math.floor(n);
    return step >= 1 && step <= TOTAL_WIZARD_STEPS ? step : null;
  } catch {
    return null;
  }
}

export function saveWizardStep(stayId: string, step: number): void {
  if (typeof window === 'undefined') return;
  try {
    const clamped = Math.min(TOTAL_WIZARD_STEPS, Math.max(1, Math.round(step)));
    window.localStorage.setItem(wizardStepStorageKey(stayId), String(clamped));
  } catch {
    /* storage unavailable — resume falls back to step 1 */
  }
}

export function clearWizardStep(stayId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(wizardStepStorageKey(stayId));
  } catch {
    /* ignore */
  }
}
