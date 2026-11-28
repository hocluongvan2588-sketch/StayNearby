'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { usePreferences } from '@/components/PreferencesProvider';
import { formatCancellationPolicyLabel, formatVndExact } from '@/lib/i18n';
import { clampHostMinNights, POLICY_MIN_NIGHTS } from '@/lib/business-rules';
import {
  CANCELLATION_POLICY_VALUES,
  KITCHEN_OPTIONS,
  LAUNDRY_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
} from '@/lib/listing-options';
import { listingPatchSchema } from '@/lib/listing-form-schema';
import {
  ListingCheckboxCard,
  ListingHint,
  ListingInput,
  ListingSectionTitle,
  ListingSelect,
  ListingTextarea,
} from '@/components/listing-form';
import type { DestinationSummary } from '@/modules/catalog';
import type { HostStayRoomItem, HostStaySummary } from '@/modules/host';
import {
  TOTAL_WIZARD_STEPS,
  WIZARD_STEPS,
  buildCreateDraftPayload,
  clearWizardStep,
  initialWizardState,
  loadWizardStep,
  saveWizardStep,
  validateWizardStep,
  wizardStepKey,
  wizardStepPatchPayload,
  type WizardFormState,
} from '@/lib/listing-wizard-steps';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function HostListingWizardCreateClient({
  destinations,
  initialStay,
  hostName,
}: {
  destinations: DestinationSummary[];
  initialStay: HostStaySummary | null;
  hostName: string;
}) {
  const router = useRouter();
  const { locale, hostCommissionPct } = usePreferences();
  const isVi = locale === 'vi';

  const [stayId, setStayIdState] = useState<string | null>(initialStay?.id ?? null);
  const stayIdRef = useRef<string | null>(initialStay?.id ?? null);
  const [staySlug, setStaySlug] = useState(initialStay?.slug ?? '');
  const [registrationCode, setRegistrationCode] = useState(
    initialStay?.registrationCode ?? ''
  );

  const [step, setStepState] = useState(1);
  const stepRef = useRef(1);

  const [form, setForm] = useState<WizardFormState>(() => initialWizardState(initialStay));
  const formRef = useRef<WizardFormState>(form);

  const [rooms, setRooms] = useState<HostStayRoomItem[]>(initialStay?.rooms ?? []);
  const [roomMode, setRoomMode] = useState<'single' | 'multi'>(
    (initialStay?.rooms.length ?? 0) > 1 ? 'multi' : 'single'
  );

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [roomBusy, setRoomBusy] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [amenitiesText, setAmenitiesText] = useState(
    (initialStay?.amenities ?? []).join('\n')
  );
  const [newRoomNameEn, setNewRoomNameEn] = useState('');
  const [newRoomMonthlyVnd, setNewRoomMonthlyVnd] = useState('16000000');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Record<string, unknown> | null>(null);

  function setStayId(id: string | null) {
    stayIdRef.current = id;
    setStayIdState(id);
  }
  function setStep(n: number) {
    stepRef.current = n;
    setStepState(n);
  }

  // Resume the saved step once on mount (localStorage per stay — no stay_drafts).
  // Deferred a tick so SSR renders step 1 first (no hydration mismatch) and the
  // setState never runs synchronously inside the effect.
  useEffect(() => {
    if (!initialStay) return;
    const saved = loadWizardStep(initialStay.id);
    if (!saved) return;
    const t = setTimeout(() => setStep(saved), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function flushPending(): Promise<boolean> {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const payload = pendingRef.current;
    const id = stayIdRef.current;
    if (!payload || !id) return true;
    if (!listingPatchSchema.safeParse(payload).success) {
      // Invalid partial (user mid-edit): drop it — step validation on Next catches it.
      pendingRef.current = null;
      return true;
    }
    pendingRef.current = null;
    setSaveState('saving');
    try {
      const res = await fetch(`/api/host/stays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setSaveState('error');
        setErrorMsg(json.error?.message ?? 'Could not save your progress.');
        return false;
      }
      setSaveState('saved');
      return true;
    } catch {
      setSaveState('error');
      setErrorMsg(isVi ? 'Mất kết nối — chưa lưu thay đổi.' : 'Network error — changes not saved.');
      return false;
    }
  }

  function scheduleFlush(payload: Record<string, unknown>) {
    pendingRef.current = payload;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flushPending();
    }, 800);
  }

  /** Update form state + autosave the current step's PATCH payload (debounced). */
  function updateForm(patch: Partial<WizardFormState>) {
    const next = { ...formRef.current, ...patch };
    formRef.current = next;
    setForm(next);
    if (stayIdRef.current) {
      scheduleFlush(wizardStepPatchPayload(wizardStepKey(stepRef.current), next));
    }
  }

  async function goNext() {
    const key = wizardStepKey(stepRef.current);
    const err = validateWizardStep(key, formRef.current, {
      stayId: stayIdRef.current,
      roomsCount: rooms.length,
    });
    if (err) {
      setErrorMsg(isVi ? err.vi : err.en);
      return;
    }
    setErrorMsg('');
    setNotice('');

    if (key === 'destination' && !stayIdRef.current) {
      setCreating(true);
      try {
        const res = await fetch('/api/host/stays', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildCreateDraftPayload(formRef.current)),
        });
        const json = await res.json();
        if (!json.ok) {
          setErrorMsg(json.error?.message ?? 'Could not create the listing draft.');
          return;
        }
        const newId = String(json.stay.id);
        setStayId(newId);
        setStaySlug(String(json.stay.slug ?? ''));
        setRegistrationCode(String(json.stay.registrationCode ?? ''));
        saveWizardStep(newId, 2);
        setStep(2);
        setSaveState('idle');
        return;
      } finally {
        setCreating(false);
      }
    }

    const flushed = await flushPending();
    if (!flushed) return;
    const next = Math.min(TOTAL_WIZARD_STEPS, stepRef.current + 1);
    if (stayIdRef.current) saveWizardStep(stayIdRef.current, next);
    setStep(next);
    setNotice('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  async function goBack() {
    setErrorMsg('');
    setNotice('');
    await flushPending();
    const prev = Math.max(1, stepRef.current - 1);
    if (stayIdRef.current) saveWizardStep(stayIdRef.current, prev);
    setStep(prev);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  async function jumpTo(target: number) {
    if (target === stepRef.current || target < 1 || target > stepRef.current) return;
    setErrorMsg('');
    setNotice('');
    await flushPending();
    if (stayIdRef.current) saveWizardStep(stayIdRef.current, target);
    setStep(target);
  }

  async function saveAndExit() {
    if (!stayIdRef.current) {
      router.push('/host/listings');
      return;
    }
    const err = validateWizardStep(wizardStepKey(stepRef.current), formRef.current, {
      stayId: stayIdRef.current,
      roomsCount: rooms.length,
    });
    if (err) {
      setErrorMsg(isVi ? err.vi : err.en);
      return;
    }
    await flushPending();
    router.push('/host/listings');
  }

  async function handleSubmitForReview() {
    if (!stayIdRef.current) return;
    const err = validateWizardStep('review', formRef.current, {
      stayId: stayIdRef.current,
      roomsCount: rooms.length,
    });
    if (err) {
      setErrorMsg(isVi ? err.vi : err.en);
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      const flushed = await flushPending();
      if (!flushed) return;
      const res = await fetch(`/api/host/stays/${stayIdRef.current}/submit`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not submit for review.');
        return;
      }
      clearWizardStep(stayIdRef.current);
      router.push('/host/listings');
    } finally {
      setSubmitting(false);
    }
  }

  /* ------------------------------ Photos ------------------------------ */

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !stayIdRef.current) return;
    setUploading(true);
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('role', 'gallery');
      const res = await fetch(`/api/host/stays/${stayIdRef.current}/media`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Photo upload failed.');
        return;
      }
      const urls: string[] = Array.isArray(json.uploaded)
        ? json.uploaded.map((u: { url: string }) => u.url)
        : [];
      if (urls.length > 0) {
        updateForm({ galleryImages: [...formRef.current.galleryImages, ...urls] });
      }
      setNotice(isVi ? 'Đã tải ảnh lên.' : 'Photo uploaded.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleAddPhotoUrl() {
    const trimmed = photoUrlInput.trim();
    if (!trimmed) return;
    const gallery = formRef.current.galleryImages;
    if (!gallery.includes(trimmed)) {
      updateForm({ galleryImages: [...gallery, trimmed] });
    }
    setPhotoUrlInput('');
  }

  async function handleRemovePhoto(url: string) {
    if (!stayIdRef.current) return;
    try {
      const res = await fetch(`/api/host/stays/${stayIdRef.current}/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (json.ok) {
        const gallery = formRef.current.galleryImages.filter((u) => u !== url);
        const hero =
          formRef.current.heroImage === url
            ? (gallery[0] ?? '')
            : formRef.current.heroImage;
        updateForm({ galleryImages: gallery, heroImage: hero });
      }
    } catch {
      /* network blip — image stays */
    }
  }

  /* ------------------------------ Rooms ------------------------------- */

  async function handleSaveRoom(rm: HostStayRoomItem) {
    if (!stayIdRef.current) return;
    setRoomBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stayIdRef.current}/rooms/${rm.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameEn: rm.nameEn,
          nameVi: rm.nameVi,
          maxGuests: rm.maxGuests,
          unitsTotal: rm.unitsTotal,
          wholesale7Vnd: rm.wholesale7Vnd,
          wholesale14Vnd: rm.wholesale14Vnd,
          wholesale21Vnd: rm.wholesale21Vnd,
          wholesale30Vnd: rm.wholesale30Vnd,
          extraNightVnd: rm.extraNightVnd,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not save room.');
        return;
      }
      setNotice(
        isVi ? `Đã lưu phòng ${rm.nameVi || rm.nameEn}.` : `Saved room ${rm.nameEn}.`
      );
    } finally {
      setRoomBusy(false);
    }
  }

  function patchRoom(idx: number, patch: Partial<HostStayRoomItem>) {
    setRooms((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  async function handleAddRoom() {
    if (!stayIdRef.current || !newRoomNameEn.trim()) return;
    setRoomBusy(true);
    setErrorMsg('');
    try {
      const w30 = Math.max(2000000, Number(newRoomMonthlyVnd) || 15000000);
      const w21 = Math.round((w30 / 30) * 21 * 1.05);
      const w14 = Math.round((w30 / 30) * 14 * 1.08);
      const w7 = Math.round((w30 / 30) * 7 * 1.15);
      const extra = Math.round(w30 / 30);
      const nameEn = newRoomNameEn.trim();
      const nameVi = nameEn;
      const descriptionEn = 'Private fully-furnished residence';
      const descriptionVi = 'Căn hộ riêng đầy đủ nội thất.';
      const res = await fetch(`/api/host/stays/${stayIdRef.current}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameEn,
          nameVi,
          descriptionEn,
          descriptionVi,
          maxGuests: 2,
          bedsCount: 1,
          unitsTotal: 1,
          wholesale30Vnd: w30,
          wholesale21Vnd: w21,
          wholesale14Vnd: w14,
          wholesale7Vnd: w7,
          extraNightVnd: extra,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not add room.');
        return;
      }
      const newRoom: HostStayRoomItem = {
        id: String(json.roomId),
        stayId: stayIdRef.current,
        nameEn,
        nameVi,
        descriptionEn,
        descriptionVi,
        maxGuests: 2,
        bedsCount: 1,
        unitsTotal: 1,
        roomImage: formRef.current.heroImage,
        roomFeatures: [],
        icalUrl: '',
        icalLastSyncedAt: null,
        icalSyncStatus: 'idle',
        packageId: json.packageId ? String(json.packageId) : null,
        wholesale7Vnd: w7,
        wholesale14Vnd: w14,
        wholesale21Vnd: w21,
        wholesale30Vnd: w30,
        extraNightVnd: extra,
      };
      setRooms((prev) => [...prev, newRoom]);
      setNewRoomNameEn('');
      setNotice(isVi ? 'Đã thêm phòng.' : 'Room added.');
    } finally {
      setRoomBusy(false);
    }
  }

  async function handleDeleteRoom(roomId: string) {
    if (!stayIdRef.current) return;
    setRoomBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stayIdRef.current}/rooms/${roomId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not delete room.');
        return;
      }
      setRooms((prev) => {
        const next = prev.filter((r) => r.id !== roomId);
        if (next.length <= 1) setRoomMode('single');
        return next;
      });
    } finally {
      setRoomBusy(false);
    }
  }

  /* ------------------------------ Render ------------------------------ */

  const stepDef = WIZARD_STEPS[step - 1];
  const pct = Math.round((step / TOTAL_WIZARD_STEPS) * 100);
  const visibleRooms = roomMode === 'single' ? rooms.slice(0, 1) : rooms;
  const selectedDestination = destinations.find((d) => d.slug === form.destinationSlug);

  const saveLabel =
    saveState === 'saving'
      ? isVi
        ? 'Đang lưu...'
        : 'Saving...'
      : saveState === 'saved'
        ? isVi
          ? 'Đã lưu'
          : 'Saved'
        : saveState === 'error'
          ? isVi
            ? 'Lỗi lưu'
            : 'Save failed'
          : '';

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void saveAndExit()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E5DFD3] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#53635D] transition hover:bg-[#FAF8F3] hover:text-[#17221E]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {isVi ? 'Quay lại Chỗ ở' : 'Back to Listings'}
          </button>
          <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            {saveLabel && (
              <span
                className={
                  saveState === 'error'
                    ? 'text-[#C25E28]'
                    : saveState === 'saved'
                      ? 'text-[#164E3F]'
                      : ''
                }
              >
                {saveLabel}
              </span>
            )}
            <span>
              {isVi ? `Bước ${step} / ${TOTAL_WIZARD_STEPS}` : `Step ${step} of ${TOTAL_WIZARD_STEPS}`}
            </span>
            <button
              type="button"
              onClick={() => void saveAndExit()}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E5DFD3] bg-white px-3 py-1.5 normal-case tracking-normal text-[#17221E] hover:bg-[#FAF8F3]"
            >
              <Save className="h-3.5 w-3.5" />
              {isVi ? 'Lưu & thoát' : 'Save & exit'}
            </button>
          </div>
        </div>

        {/* Progress segments (clickable to earlier steps) */}
        <div className="flex gap-1.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          {WIZARD_STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              disabled={i + 1 > step}
              onClick={() => void jumpTo(i + 1)}
              title={isVi ? s.vi : s.en}
              aria-label={isVi ? s.vi : s.en}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i + 1 <= step ? 'bg-[#164E3F]' : 'bg-[#E5DFD3]'
              } ${i + 1 < step ? 'cursor-pointer' : 'cursor-default'}`}
            />
          ))}
        </div>

        {/* Listing ID badge */}
        {stayId && (
          <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-3.5 py-2 text-xs font-semibold text-[#164E3F]">
            <BadgeCheck className="h-4 w-4 shrink-0" />
            {isVi ? 'Listing ID' : 'Listing ID'}
            <span className="font-mono">{registrationCode || stayId.slice(0, 8)}</span>
            <span className="font-normal text-[#53635D]">· {staySlug}</span>
          </div>
        )}
      </div>

      {/* Banners */}
      {notice && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-3 text-sm font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="mt-4 rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-3 text-sm font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      {/* Step card */}
      <div className="mt-5 space-y-5 rounded-2xl border border-[#E5DFD3] bg-white p-6 lacquer-shadow sm:p-8">
        <div className="space-y-1.5 border-b border-[#E5DFD3] pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#164E3F]">
            {isVi ? `Bước ${step} trên ${TOTAL_WIZARD_STEPS}` : `Step ${step} of ${TOTAL_WIZARD_STEPS}`}
          </p>
          <h1 className="font-serif-display text-2xl font-semibold leading-tight tracking-tight text-[#17221E] sm:text-3xl">
            {isVi ? stepDef.vi : stepDef.en}
          </h1>
          {step === 1 && (
            <p className="text-sm text-[#53635D]">
              {isVi
                ? `Chào ${hostName} — chọn điểm đến và loại hình, chúng tôi sẽ cấp Listing ID ngay.`
                : `Hi ${hostName} — pick a destination and type; your Listing ID is created immediately.`}
            </p>
          )}
        </div>

        {/* 1. Destination & type */}
        {step === 1 && (
          <div className="space-y-4">
            {stayId ? (
              <ListingHint>
                {isVi
                  ? `Listing này đã được tạo: ${registrationCode || stayId.slice(0, 8)}. Điểm đến đã khóa — chỉ còn loại hình có thể đổi.`
                  : `This listing already exists: ${registrationCode || stayId.slice(0, 8)}. The destination is fixed; only the property type can change.`}
              </ListingHint>
            ) : (
              <ListingHint>
                {isVi
                  ? 'Bước đầu tiên: chọn điểm đến — Listing ID (mã định danh duy nhất) sẽ được cấp ngay khi bạn tiếp tục. Không dùng bản nháp tạm nữa.'
                  : 'First, choose a destination — your unique Listing ID is assigned as soon as you continue. No temporary drafts in this flow.'}
              </ListingHint>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {stayId ? (
                <ListingInput
                  label={isVi ? 'Điểm đến' : 'Destination'}
                  value={
                    initialStay
                      ? `${isVi ? initialStay.destinationNameVi : initialStay.destinationNameEn}`
                      : (selectedDestination
                          ? isVi
                            ? selectedDestination.nameVi
                            : selectedDestination.nameEn
                          : form.destinationSlug)
                  }
                  onChange={() => undefined}
                  disabled
                />
              ) : (
                <ListingSelect
                  label={isVi ? 'Điểm đến tại Việt Nam' : 'Destination in Vietnam'}
                  value={form.destinationSlug}
                  onChange={(v) => updateForm({ destinationSlug: v })}
                  options={destinations.map((d) => ({
                    value: d.slug,
                    label: `${isVi ? d.nameVi : d.nameEn} · ${isVi ? d.regionVi : d.regionEn}`,
                  }))}
                  hint={isVi ? 'Chọn thành phố bạn muốn cho thuê.' : 'Choose the city you want to host in.'}
                />
              )}
              <ListingSelect
                label={isVi ? 'Loại hình chỗ ở' : 'Property type'}
                value={form.propertyType}
                onChange={(v) =>
                  updateForm({ propertyType: v as WizardFormState['propertyType'] })
                }
                options={PROPERTY_TYPE_OPTIONS.map((o) => ({
                  value: o.value,
                  label: isVi ? o.vi : o.en,
                }))}
              />
            </div>
          </div>
        )}

        {/* 2. Titles */}
        {step === 2 && (
          <div className="space-y-4">
            <ListingHint>
              {isVi
                ? 'Tiêu đề 2–140 ký tự, viết bằng EN và VI — khách Việt và khách quốc tế đều đọc được.'
                : 'Titles are 2–140 characters, in both EN and VI — for local and international guests.'}
            </ListingHint>
            <div className="grid gap-4 sm:grid-cols-2">
              <ListingInput
                label="Title (EN)"
                value={form.titleEn}
                onChange={(v) => updateForm({ titleEn: v })}
                placeholder="Sunlit studio with fiber Wi-Fi"
              />
              <ListingInput
                label="Tiêu đề (VI)"
                value={form.titleVi}
                onChange={(v) => updateForm({ titleVi: v })}
                placeholder="Studio đầy nắng, Wi-Fi cáp quang"
              />
              <ListingInput
                label="Subtitle (EN)"
                value={form.subtitleEn}
                onChange={(v) => updateForm({ subtitleEn: v })}
                placeholder="Weekly & monthly stays"
              />
              <ListingInput
                label="Phụ đề (VI)"
                value={form.subtitleVi}
                onChange={(v) => updateForm({ subtitleVi: v })}
                placeholder="Lưu trú theo tuần và tháng"
              />
            </div>
          </div>
        )}

        {/* 3. Description */}
        {step === 3 && (
          <div className="space-y-4">
            <ListingTextarea
              label="Description (EN)"
              rows={7}
              value={form.descriptionEn}
              onChange={(v) => updateForm({ descriptionEn: v })}
              hint={isVi ? 'Tối thiểu 10 ký tự.' : 'At least 10 characters.'}
            />
            <ListingTextarea
              label="Mô tả (VI)"
              rows={7}
              value={form.descriptionVi}
              onChange={(v) => updateForm({ descriptionVi: v })}
            />
          </div>
        )}

        {/* 4. Photos */}
        {step === 4 && (
          <div className="space-y-4">
            <ListingHint>
              {isVi
                ? 'Ảnh xem trước dùng đúng ảnh thật bạn upload — không có ảnh placeholder nào được tự tạo.'
                : 'The preview uses your real photos — no placeholder images are ever generated.'}
            </ListingHint>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#164E3F] bg-[#FAF8F3] px-4 py-4 text-sm font-semibold text-[#164E3F] hover:bg-[#E7F1EC]">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                <span>{isVi ? 'Tải ảnh từ máy tính' : 'Upload photo file'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadFile}
                  className="hidden"
                  disabled={!stayId}
                />
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm outline-none focus:border-[#164E3F]"
                />
                <button
                  type="button"
                  onClick={handleAddPhotoUrl}
                  className="rounded-xl border border-[#E5DFD3] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
                >
                  {isVi ? 'Thêm URL' : 'Add URL'}
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {form.heroImage && (
                <div className="overflow-hidden rounded-xl border border-[#164E3F]/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.heroImage} alt="" className="aspect-[4/3] w-full object-cover" />
                  <div className="bg-[#E7F1EC] px-2 py-1.5 text-center text-[11px] font-semibold text-[#164E3F]">
                    {isVi ? 'Ảnh bìa' : 'Cover photo'}
                  </div>
                </div>
              )}
              {form.galleryImages
                .filter((u) => u !== form.heroImage)
                .map((url) => (
                  <div key={url} className="group relative overflow-hidden rounded-xl border border-[#E5DFD3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="aspect-[4/3] w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/50 px-1.5 py-1.5 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => updateForm({ heroImage: url })}
                        className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-[#17221E]"
                      >
                        {isVi ? 'Dùng làm bìa' : 'Set cover'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemovePhoto(url)}
                        className="rounded bg-white/90 p-0.5 text-[#C25E28]"
                        aria-label="Remove photo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 5. Amenities */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <ListingSelect
                label={isVi ? 'Khu vực bếp' : 'Kitchen'}
                value={form.kitchenType}
                onChange={(v) =>
                  updateForm({ kitchenType: v as WizardFormState['kitchenType'] })
                }
                options={KITCHEN_OPTIONS.map((o) => ({
                  value: o.value,
                  label: isVi ? o.vi : o.en,
                }))}
              />
              <ListingSelect
                label={isVi ? 'Giặt sấy' : 'Laundry'}
                value={form.laundryType}
                onChange={(v) =>
                  updateForm({ laundryType: v as WizardFormState['laundryType'] })
                }
                options={LAUNDRY_OPTIONS.map((o) => ({
                  value: o.value,
                  label: isVi ? o.vi : o.en,
                }))}
              />
              <ListingCheckboxCard
                label={isVi ? 'Thân thiện với thú cưng' : 'Pet friendly'}
                checked={form.petFriendly}
                onChange={(v) => updateForm({ petFriendly: v })}
              />
              <ListingCheckboxCard
                label={isVi ? 'Hỗ trợ xe lăn' : 'Wheelchair accessible'}
                checked={form.wheelchairFriendly}
                onChange={(v) => updateForm({ wheelchairFriendly: v })}
              />
            </div>
            <ListingTextarea
              label={isVi ? 'Tiện nghi khác (mỗi dòng một mục)' : 'More amenities (one per line)'}
              rows={5}
              value={amenitiesText}
              onChange={(v) => {
                setAmenitiesText(v);
                updateForm({
                  amenities: v
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                });
              }}
              placeholder={'Fiber Wi-Fi\nCoworking desk\nSmart TV'}
            />
          </div>
        )}

        {/* 6. Workspace & Wi-Fi */}
        {step === 6 && (
          <div className="space-y-4">
            <ListingHint>
              {isVi
                ? 'Hoàn toàn tùy chọn — không bao giờ chặn đăng listing.'
                : 'Entirely optional — this step never blocks publishing.'}
            </ListingHint>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <ListingCheckboxCard
                label={isVi ? 'Bàn làm việc riêng' : 'Dedicated desk'}
                checked={form.hasWorkspace}
                onChange={(v) => updateForm({ hasWorkspace: v })}
              />
              <ListingCheckboxCard
                label={isVi ? 'Ghế công thái học' : 'Ergonomic chair'}
                checked={form.hasErgonomicChair}
                onChange={(v) => updateForm({ hasErgonomicChair: v })}
              />
              <ListingCheckboxCard
                label={isVi ? 'Màn hình rời' : 'External monitor'}
                checked={form.hasExternalMonitor}
                onChange={(v) => updateForm({ hasExternalMonitor: v })}
              />
              <ListingCheckboxCard
                label={isVi ? 'Khu vực gọi video yên tĩnh' : 'Quiet call booth'}
                checked={form.hasCallBooth}
                onChange={(v) => updateForm({ hasCallBooth: v })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ListingTextarea
                label="Workspace summary (EN)"
                rows={3}
                value={form.workspaceSummaryEn}
                onChange={(v) => updateForm({ workspaceSummaryEn: v })}
              />
              <ListingTextarea
                label="Mô tả không gian làm việc (VI)"
                rows={3}
                value={form.workspaceSummaryVi}
                onChange={(v) => updateForm({ workspaceSummaryVi: v })}
              />
              <ListingInput
                type="number"
                min={0}
                max={10000}
                label={isVi ? 'Tải Wi-Fi đo được (Mbps, để trống nếu chưa kiểm tra)' : 'Measured download (Mbps, leave empty if untested)'}
                value={form.wifiDownloadMbps ?? ''}
                onChange={(v) =>
                  updateForm({
                    wifiDownloadMbps: v === '' ? null : Math.max(0, Number(v) || 0),
                  })
                }
              />
            </div>
          </div>
        )}

        {/* 7. Location */}
        {step === 7 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <ListingInput
              label="Neighborhood (EN)"
              value={form.neighborhoodEn}
              onChange={(v) => updateForm({ neighborhoodEn: v })}
            />
            <ListingInput
              label="Khu vực (VI)"
              value={form.neighborhoodVi}
              onChange={(v) => updateForm({ neighborhoodVi: v })}
            />
            <ListingInput
              className="sm:col-span-2"
              label={
                isVi
                  ? 'Địa chỉ chính xác (chỉ gửi khách sau khi xác nhận đặt phòng)'
                  : 'Exact address (shared after booking confirmation)'
              }
              value={form.exactAddress}
              onChange={(v) => updateForm({ exactAddress: v })}
            />
            <ListingInput
              className="sm:col-span-2"
              label={
                isVi
                  ? 'Link Google Maps của chỗ ở (tùy chọn — dùng cho khoảng cách gợi ý)'
                  : 'Google Maps link for this listing (optional — powers distance suggestions)'
              }
              placeholder="https://www.google.com/maps/..."
              value={form.googleMapsUrl}
              onChange={(v) => updateForm({ googleMapsUrl: v })}
              hint={
                isVi
                  ? 'Dán link chia sẻ từ Google Maps; tọa độ được đọc tự động, không gọi API trả phí.'
                  : 'Paste a Google Maps share link; coordinates are read automatically (no paid API).'
              }
            />
            <ListingTextarea
              label="Check-in instructions (EN)"
              rows={3}
              value={form.checkinInstructionsEn}
              onChange={(v) => updateForm({ checkinInstructionsEn: v })}
            />
            <ListingTextarea
              label="Hướng dẫn nhận phòng (VI)"
              rows={3}
              value={form.checkinInstructionsVi}
              onChange={(v) => updateForm({ checkinInstructionsVi: v })}
            />
          </div>
        )}

        {/* 8. House rules */}
        {step === 8 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <ListingInput
                label={isVi ? 'Nhận phòng từ' : 'Check-in from'}
                value={form.checkinFrom}
                onChange={(v) => updateForm({ checkinFrom: v })}
                placeholder="14:00"
              />
              <ListingInput
                label={isVi ? 'Trả phòng trước' : 'Check-out before'}
                value={form.checkoutBefore}
                onChange={(v) => updateForm({ checkoutBefore: v })}
                placeholder="12:00"
              />
              <ListingInput
                label={isVi ? 'Giờ yên tĩnh' : 'Quiet hours'}
                value={form.quietHours}
                onChange={(v) => updateForm({ quietHours: v })}
                placeholder="22:00–07:00"
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <ListingCheckboxCard
                label={isVi ? 'Cho phép hút thuốc' : 'Smoking allowed'}
                checked={form.smokingAllowed}
                onChange={(v) => updateForm({ smokingAllowed: v })}
              />
              <ListingCheckboxCard
                label={isVi ? 'Cho phép tổ chức tiệc nhỏ' : 'Parties / small events allowed'}
                checked={form.partiesAllowed}
                onChange={(v) => updateForm({ partiesAllowed: v })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ListingInput
                label={isVi ? 'Lưu ý thú cưng' : 'Pets note'}
                value={form.petsNote}
                onChange={(v) => updateForm({ petsNote: v })}
              />
              <ListingInput
                label={isVi ? 'Lưu ý khách thêm' : 'Extra guest note'}
                value={form.extraGuestNote}
                onChange={(v) => updateForm({ extraGuestNote: v })}
              />
            </div>
          </div>
        )}

        {/* 9. Policies */}
        {step === 9 && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <ListingSelect
                label={isVi ? 'Chính sách hủy' : 'Cancellation policy'}
                value={form.cancellationPolicy}
                onChange={(v) =>
                  updateForm({
                    cancellationPolicy: v as WizardFormState['cancellationPolicy'],
                  })
                }
                options={CANCELLATION_POLICY_VALUES.map((v) => ({
                  value: v,
                  label: formatCancellationPolicyLabel(v, locale),
                }))}
              />
              <ListingInput
                type="number"
                min={7}
                max={90}
                label={isVi ? 'Số đêm tối thiểu (7–90)' : 'Minimum nights (7–90)'}
                value={form.defaultMinNights}
                onChange={(v) =>
                  updateForm({
                    defaultMinNights: clampHostMinNights(Number(v) || POLICY_MIN_NIGHTS),
                  })
                }
                hint={
                  isVi
                    ? 'Nền tảng hỗ trợ tối thiểu 7 đêm khi ra mắt.'
                    : 'Platform launches with a 7-night minimum.'
                }
              />
            </div>
            <ListingCheckboxCard
              label="Instant Book"
              checked={form.isInstantBook}
              onChange={(v) => updateForm({ isInstantBook: v })}
            >
              <span className="mt-0.5 block text-xs font-normal text-[#53635D]">
                {isVi
                  ? 'Khi tắt, các đơn mới sẽ vào trạng thái Chờ chủ nhà duyệt (tối đa 24h) thay vì khóa phòng tự động.'
                  : 'When disabled, new bookings enter Pending Host Approval after checkout until you approve or decline.'}
              </span>
            </ListingCheckboxCard>
          </div>
        )}

        {/* 10. Rooms & pricing */}
        {step === 10 && (
          <div className="space-y-5">
            <ListingHint>
              {isVi
                ? `${hostCommissionPct}% hoa hồng chủ nhà — bạn nhận đủ 100% các mức giá nhập dưới đây. Gói 7/14/21/30 đêm.`
                : `${hostCommissionPct}% host commission — you receive 100% of these rates. 7/14/21/30-night packages.`}
            </ListingHint>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: 'single', label: isVi ? 'Một đơn vị' : 'Single unit' },
                  { value: 'multi', label: isVi ? 'Nhiều phòng' : 'Multiple rooms' },
                ] as const
              ).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setRoomMode(m.value)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                    roomMode === m.value
                      ? 'border-[#164E3F]/40 bg-[#E7F1EC] text-[#164E3F]'
                      : 'border-[#E5DFD3] bg-white text-[#17221E] hover:bg-[#FAF8F3]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {roomMode === 'single' && rooms.length > 1 && (
              <p className="text-xs text-[#53635D]">
                {isVi
                  ? `${rooms.length} phòng đang ẩn — chọn "Nhiều phòng" để quản lý tất cả.`
                  : `${rooms.length} rooms hidden — switch to “Multiple rooms” to manage all of them.`}
              </p>
            )}

            <div className="space-y-4">
              {visibleRooms.map((rm) => {
                const realIdx = rooms.findIndex((r) => r.id === rm.id);
                return (
                  <div
                    key={rm.id}
                    className="space-y-3 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
                        {isVi ? `Phòng ${realIdx + 1}` : `Room ${realIdx + 1}`}
                      </span>
                      {rooms.length > 1 && (
                        <button
                          type="button"
                          disabled={roomBusy}
                          onClick={() => void handleDeleteRoom(rm.id)}
                          className="rounded-lg border border-[#E5DFD3] p-1.5 text-[#53635D] hover:text-[#C25E28]"
                          aria-label="Delete room"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ListingInput
                        label={isVi ? 'Tên phòng (EN)' : 'Room name (EN)'}
                        value={rm.nameEn}
                        onChange={(v) => patchRoom(realIdx, { nameEn: v })}
                      />
                      <ListingInput
                        type="number"
                        min={1}
                        max={12}
                        label={isVi ? 'Số khách tối đa' : 'Max guests'}
                        value={rm.maxGuests}
                        onChange={(v) => patchRoom(realIdx, { maxGuests: Number(v) || 1 })}
                      />
                      <ListingInput
                        type="number"
                        min={1}
                        max={50}
                        label={isVi ? 'Số lượng căn/phòng' : 'Total units'}
                        value={rm.unitsTotal}
                        onChange={(v) => patchRoom(realIdx, { unitsTotal: Number(v) || 1 })}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <ListingInput
                        type="number"
                        min={0}
                        label={isVi ? 'Gói 7 đêm (VND)' : '7-night package (VND)'}
                        value={rm.wholesale7Vnd}
                        onChange={(v) =>
                          patchRoom(realIdx, { wholesale7Vnd: Math.max(0, Number(v) || 0) })
                        }
                        hint={rm.wholesale7Vnd ? formatVndExact(rm.wholesale7Vnd) : undefined}
                      />
                      <ListingInput
                        type="number"
                        min={0}
                        label={isVi ? 'Gói 14 đêm (VND)' : '14-night package (VND)'}
                        value={rm.wholesale14Vnd}
                        onChange={(v) =>
                          patchRoom(realIdx, { wholesale14Vnd: Math.max(0, Number(v) || 0) })
                        }
                        hint={rm.wholesale14Vnd ? formatVndExact(rm.wholesale14Vnd) : undefined}
                      />
                      <ListingInput
                        type="number"
                        min={0}
                        label={isVi ? 'Gói 21 đêm (VND)' : '21-night package (VND)'}
                        value={rm.wholesale21Vnd}
                        onChange={(v) =>
                          patchRoom(realIdx, { wholesale21Vnd: Math.max(0, Number(v) || 0) })
                        }
                        hint={rm.wholesale21Vnd ? formatVndExact(rm.wholesale21Vnd) : undefined}
                      />
                      <ListingInput
                        type="number"
                        min={0}
                        label={isVi ? 'Gói 30 đêm (VND)' : '30-night package (VND)'}
                        value={rm.wholesale30Vnd}
                        onChange={(v) =>
                          patchRoom(realIdx, { wholesale30Vnd: Math.max(0, Number(v) || 0) })
                        }
                        hint={rm.wholesale30Vnd ? formatVndExact(rm.wholesale30Vnd) : undefined}
                      />
                      <ListingInput
                        type="number"
                        min={0}
                        label={isVi ? 'Đêm phụ (VND)' : 'Extra night (VND)'}
                        value={rm.extraNightVnd}
                        onChange={(v) =>
                          patchRoom(realIdx, { extraNightVnd: Math.max(0, Number(v) || 0) })
                        }
                        hint={rm.extraNightVnd ? formatVndExact(rm.extraNightVnd) : undefined}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={roomBusy}
                      onClick={() => void handleSaveRoom(rm)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#164E3F] bg-white px-3.5 py-2 text-xs font-semibold text-[#164E3F] hover:bg-[#E7F1EC] disabled:opacity-60"
                    >
                      {roomBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {isVi ? 'Lưu giá phòng' : 'Save room rates'}
                    </button>
                  </div>
                );
              })}
            </div>

            {roomMode === 'multi' && (
              <div className="space-y-3 rounded-xl border border-dashed border-[#E5DFD3] p-4">
                <ListingSectionTitle>
                  {isVi ? 'Thêm phòng mới' : 'Add another room'}
                </ListingSectionTitle>
                <div className="grid gap-3 sm:grid-cols-3">
                  <ListingInput
                    label={isVi ? 'Tên phòng (EN)' : 'Room name (EN)'}
                    value={newRoomNameEn}
                    onChange={setNewRoomNameEn}
                    placeholder="Deluxe Twin"
                  />
                  <ListingInput
                    type="number"
                    min={2000000}
                    label={isVi ? 'Gói 30 đêm (VND)' : '30-night package (VND)'}
                    value={newRoomMonthlyVnd}
                    onChange={setNewRoomMonthlyVnd}
                    hint={isVi ? 'Tối thiểu 2.000.000 ₫' : 'Minimum 2,000,000 VND'}
                  />
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={roomBusy || !newRoomNameEn.trim()}
                      onClick={() => void handleAddRoom()}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F392E] disabled:opacity-50"
                    >
                      {roomBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {isVi ? 'Thêm phòng' : 'Add room'}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#53635D]">
                  {isVi
                    ? 'Gói 7/14/21 đêm tự tính từ gói 30 đêm theo đúng công thức nền tảng.'
                    : '7/14/21-night packages are derived from the 30-night rate using the platform formula.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 11. Review & submit */}
        {step === 11 && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
                  {isVi ? 'Điểm đến & loại hình' : 'Destination & type'}
                </div>
                <div className="mt-1 font-semibold text-[#17221E]">
                  {(() => {
                    const destLabel = initialStay
                      ? isVi
                        ? initialStay.destinationNameVi
                        : initialStay.destinationNameEn
                      : selectedDestination
                        ? isVi
                          ? selectedDestination.nameVi
                          : selectedDestination.nameEn
                        : form.destinationSlug;
                    const typeValue = initialStay
                      ? initialStay.propertyType
                      : form.propertyType;
                    const typeLabel =
                      PROPERTY_TYPE_OPTIONS.find((o) => o.value === typeValue)?.[
                        isVi ? 'vi' : 'en'
                      ] ?? typeValue;
                    return `${destLabel} · ${typeLabel}`;
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => void jumpTo(1)}
                  className="mt-1 text-xs font-semibold text-[#164E3F] hover:underline"
                >
                  {isVi ? 'Sửa' : 'Edit'}
                </button>
              </div>
              <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
                  {isVi ? 'Tiêu đề' : 'Titles'}
                </div>
                <div className="mt-1 font-semibold text-[#17221E]">{form.titleEn}</div>
                <div className="text-[#53635D]">{form.titleVi}</div>
                <button
                  type="button"
                  onClick={() => void jumpTo(2)}
                  className="mt-1 text-xs font-semibold text-[#164E3F] hover:underline"
                >
                  {isVi ? 'Sửa' : 'Edit'}
                </button>
              </div>
              <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
                  {isVi ? 'Phòng & giá' : 'Rooms & rates'}
                </div>
                <div className="mt-1 font-semibold text-[#17221E]">
                  {rooms.length} {isVi ? 'phòng' : 'room(s)'} ·{' '}
                  {rooms[0]?.wholesale7Vnd
                    ? `${formatVndExact(Math.round(rooms[0].wholesale7Vnd / 7))} / ${isVi ? 'đêm' : 'nt'}`
                    : '—'}
                </div>
                <button
                  type="button"
                  onClick={() => void jumpTo(10)}
                  className="mt-1 text-xs font-semibold text-[#164E3F] hover:underline"
                >
                  {isVi ? 'Sửa' : 'Edit'}
                </button>
              </div>
              <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
                  {isVi ? 'Chính sách' : 'Policies'}
                </div>
                <div className="mt-1 font-semibold text-[#17221E]">
                  {form.defaultMinNights} {isVi ? 'đêm tối thiểu' : 'night min'} ·{' '}
                  {formatCancellationPolicyLabel(form.cancellationPolicy, locale)}
                </div>
                <button
                  type="button"
                  onClick={() => void jumpTo(9)}
                  className="mt-1 text-xs font-semibold text-[#164E3F] hover:underline"
                >
                  {isVi ? 'Sửa' : 'Edit'}
                </button>
              </div>
            </div>

            <ListingHint>
              {isVi
                ? 'Sau khi gửi: listing chuyển sang Chờ duyệt (pending_review). Admin duyệt CHÍNH listing này — không tạo stay mới, không sinh placeholder. Thay đổi giá/chính sách khi đã live cần duyệt lại (Revision Management).'
                : 'After submitting: the listing moves to Pending Review. Moderators approve THIS stay — no new stay is ever created, no placeholders. Price/policy changes on a live listing require re-approval (Revision Management).'}
            </ListingHint>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitForReview()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#164E3F] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isVi ? 'Gửi duyệt listing' : 'Submit listing for review'}
              </button>
              <button
                type="button"
                onClick={() => void saveAndExit()}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E5DFD3] bg-white px-6 py-3 text-sm font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
              >
                <Save className="h-4 w-4" />
                {isVi ? 'Lưu & thoát' : 'Save & exit'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer nav */}
      {step < TOTAL_WIZARD_STEPS && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => void goBack()}
            disabled={step === 1}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5DFD3] bg-white px-5 py-3 text-sm font-semibold text-[#17221E] hover:bg-[#FAF8F3] disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            {isVi ? 'Quay lại' : 'Back'}
          </button>
          <button
            type="button"
            onClick={() => void goNext()}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded-xl bg-[#164E3F] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {step === 1 && !stayId
              ? isVi
                ? 'Tạo listing & tiếp tục'
                : 'Create listing & continue'
              : isVi
                ? 'Tiếp tục'
                : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
