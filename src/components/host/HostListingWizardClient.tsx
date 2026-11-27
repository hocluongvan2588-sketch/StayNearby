'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Home,
  Hotel,
  Leaf,
  Loader2,
  Save,
  Send,
  Users,
} from 'lucide-react';
import { usePreferences } from '@/components/PreferencesProvider';
import type { DestinationSummary } from '@/modules/catalog';

const TOTAL_STEPS = 6;

const PROPERTY_TYPE_OPTIONS = [
  { value: 'apartment', label: 'Serviced Apartment', icon: Building2 },
  { value: 'coliving', label: 'Coliving House', icon: Users },
  { value: 'boutique_hotel', label: 'Boutique Hotel', icon: Hotel },
  { value: 'villa', label: 'Villa', icon: Home },
  { value: 'eco_lodge', label: 'Eco Lodge', icon: Leaf },
] as const;

const KITCHEN_OPTIONS = [
  { value: 'full', en: 'Full private kitchen', vi: 'Bếp nấu riêng đầy đủ' },
  { value: 'kitchenette', en: 'Kitchenette', vi: 'Bếp nhỏ (Kitchenette)' },
  { value: 'shared', en: 'Shared kitchen', vi: 'Bếp dùng chung' },
  { value: 'none', en: 'No kitchen', vi: 'Không có bếp' },
] as const;

const LAUNDRY_OPTIONS = [
  { value: 'in_unit', en: 'In-unit washer', vi: 'Máy giặt trong phòng' },
  { value: 'building', en: 'Shared building laundry', vi: 'Giặt chung trong tòa nhà' },
  { value: 'service', en: 'Laundry service nearby', vi: 'Dịch vụ giặt ủi' },
  { value: 'none', en: 'None', vi: 'Không có' },
] as const;

export interface WizardFormState {
  businessName: string;
  stayName: string;
  destinationSlug: string;
  propertyType: 'apartment' | 'coliving' | 'boutique_hotel' | 'villa' | 'eco_lodge';
  kitchenType: 'full' | 'kitchenette' | 'shared' | 'none';
  laundryType: 'in_unit' | 'building' | 'service' | 'none';
  measuredDownloadMbps: string;
  hasWorkspace: boolean;
  hasErgonomicChair: boolean;
  hasExternalMonitor: boolean;
  descriptionNote: string;
  nightlyEstimateVnd: string;
}

export function HostListingWizardClient({
  hostName,
  destinations,
  initialDraftId,
  initialStep,
  initialPayload,
}: {
  hostName: string;
  destinations: DestinationSummary[];
  initialDraftId: string | null;
  initialStep: number;
  initialPayload: Record<string, unknown>;
}) {
  const router = useRouter();
  const { locale, hostCommissionPct } = usePreferences();
  const isVi = locale === 'vi';

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [step, setStep] = useState<number>(Math.min(TOTAL_STEPS, Math.max(1, initialStep)));
  const [form, setForm] = useState<WizardFormState>({
    businessName: String(initialPayload.businessName ?? hostName),
    stayName: String(initialPayload.stayName ?? ''),
    destinationSlug: String(
      initialPayload.destinationSlug ?? destinations[0]?.slug ?? 'da-nang'
    ),
    propertyType: (['apartment', 'coliving', 'boutique_hotel', 'villa', 'eco_lodge'].includes(
      String(initialPayload.propertyType)
    )
      ? String(initialPayload.propertyType)
      : 'apartment') as WizardFormState['propertyType'],
    kitchenType: (['full', 'kitchenette', 'shared', 'none'].includes(
      String(initialPayload.kitchenType)
    )
      ? String(initialPayload.kitchenType)
      : 'full') as WizardFormState['kitchenType'],
    laundryType: (['in_unit', 'building', 'service', 'none'].includes(
      String(initialPayload.laundryType)
    )
      ? String(initialPayload.laundryType)
      : 'in_unit') as WizardFormState['laundryType'],
    measuredDownloadMbps: String(initialPayload.measuredDownloadMbps ?? ''),
    hasWorkspace: Boolean(initialPayload.hasWorkspace),
    hasErgonomicChair: Boolean(initialPayload.hasErgonomicChair),
    hasExternalMonitor: Boolean(initialPayload.hasExternalMonitor),
    descriptionNote: String(initialPayload.descriptionNote ?? ''),
    nightlyEstimateVnd: String(initialPayload.nightlyEstimateVnd ?? '750000'),
  });

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  function serializePayload(): Record<string, unknown> {
    return {
      businessName: form.businessName.trim(),
      stayName: form.stayName.trim(),
      destinationSlug: form.destinationSlug,
      propertyType: form.propertyType,
      kitchenType: form.kitchenType,
      laundryType: form.laundryType,
      measuredDownloadMbps: form.measuredDownloadMbps.trim()
        ? Number(form.measuredDownloadMbps)
        : 0,
      hasWorkspace: form.hasWorkspace,
      hasErgonomicChair: form.hasErgonomicChair,
      hasExternalMonitor: form.hasExternalMonitor,
      descriptionNote: form.descriptionNote.trim(),
      nightlyEstimateVnd: Number(form.nightlyEstimateVnd) || 750000,
    };
  }

  async function saveDraft(targetStep: number, silent = false): Promise<string | null> {
    setSaving(true);
    if (!silent) {
      setErrorMsg('');
      setNotice('');
    }
    try {
      const res = await fetch('/api/host/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: draftId ?? undefined,
          currentStep: targetStep,
          payload: serializePayload(),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        if (!silent) setErrorMsg(json.error?.message ?? 'Could not save draft.');
        return null;
      }
      setDraftId(json.draft.id);
      if (!silent) {
        setNotice(isVi ? 'Đã tự động lưu bản nháp.' : 'Draft saved.');
      }
      return json.draft.id as string;
    } finally {
      setSaving(false);
    }
  }

  async function goNext() {
    if (step === 2 && form.stayName.trim().length < 3) {
      setErrorMsg(
        isVi ? 'Vui lòng nhập tên cơ sở tối thiểu 3 ký tự.' : 'Enter a listing name (at least 3 characters).'
      );
      return;
    }
    setErrorMsg('');
    const next = Math.min(TOTAL_STEPS, step + 1);
    setStep(next);
    await saveDraft(next, true);
  }

  async function handlePublish() {
    setPublishing(true);
    setErrorMsg('');
    try {
      const id = await saveDraft(TOTAL_STEPS, true);
      if (!id) {
        setErrorMsg(isVi ? 'Không thể lưu bản nháp trước khi gửi.' : 'Could not save draft.');
        return;
      }
      const res = await fetch(`/api/host/drafts/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializePayload()),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not publish listing.');
        return;
      }
      router.push('/host/listings');
      router.refresh();
    } finally {
      setPublishing(false);
    }
  }

  const pct = Math.round((step / TOTAL_STEPS) * 100);
  const destLabel = destinations.find((d) => d.slug === form.destinationSlug);

  const stepTitle =
    step === 1
      ? isVi
        ? '1. Loại hình & Điểm đến'
        : '1. Property Type & Destination'
      : step === 2
        ? isVi
          ? '2. Tên chỗ ở & Thương hiệu chủ nhà'
          : '2. Residence & Host Name'
        : step === 3
          ? isVi
            ? '3. Tiện nghi sinh hoạt cơ bản'
            : '3. Kitchen & Laundry Facilities'
          : step === 4
            ? isVi
              ? '4. Wi-Fi & Góc làm việc (Hoàn toàn tùy chọn)'
              : '4. Optional Wi-Fi & Workspace'
            : step === 5
              ? isVi
                ? `5. Giá tham khảo (${hostCommissionPct}% hoa hồng chủ nhà)`
                : `5. Target Rate (${hostCommissionPct}% Host Commission)`
              : isVi
                ? '6. Kiểm tra & Gửi duyệt hồ sơ chỗ ở'
                : '6. Review & Submit Listing';

  const inputClass =
    'w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm text-[#17221E] outline-none transition placeholder:text-[#8A9691] focus:border-[#164E3F] focus:bg-white';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-[#53635D]';

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
      {/* Progress header */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/host/listings"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E5DFD3] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#53635D] transition hover:bg-[#FAF8F3] hover:text-[#17221E]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {isVi ? 'Quay lại Chỗ ở' : 'Back to Listings'}
          </Link>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            {isVi ? `Bước ${step} / ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
          </span>
        </div>
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={isVi ? 'Tiến trình đăng chỗ ở' : 'Listing progress'}
        >
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < step ? 'bg-[#164E3F]' : 'bg-[#E5DFD3]'
              }`}
            />
          ))}
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-3 text-sm font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-3 text-sm font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      <div className="space-y-5 rounded-2xl border border-[#E5DFD3] bg-white p-6 text-sm lacquer-shadow sm:p-8">
        {/* Editorial step heading */}
        <div className="space-y-1.5 border-b border-[#E5DFD3] pb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#164E3F]">
            {isVi ? `Bước ${step} trên ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
          </p>
          <h1 className="font-serif-display text-2xl font-semibold leading-tight tracking-tight text-[#17221E] sm:text-3xl">
            {stepTitle}
          </h1>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>
                {isVi ? 'Điểm đến tại Việt Nam' : 'Destination'}
              </label>
              <select
                value={form.destinationSlug}
                onChange={(e) => setForm({ ...form, destinationSlug: e.target.value })}
                className={`${inputClass} font-medium`}
              >
                {destinations.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {isVi ? d.nameVi : d.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>
                {isVi ? 'Loại hình chỗ ở' : 'Property type'}
              </label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {PROPERTY_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => {
                  const active = form.propertyType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm({ ...form, propertyType: value })}
                      className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        active
                          ? 'border-[#164E3F]/40 bg-[#E7F1EC] text-[#164E3F]'
                          : 'border-[#E5DFD3] bg-white text-[#17221E] hover:bg-[#FAF8F3]'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 ${active ? 'text-[#164E3F]' : 'text-[#53635D]'}`}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{isVi ? 'Tên chỗ ở' : 'Property / Stay name'}</label>
                <input
                  value={form.stayName}
                  onChange={(e) => setForm({ ...form, stayName: e.target.value })}
                  placeholder={isVi ? 'Ví dụ: Han River Sunlit Studio' : 'e.g., Han River Sunlit Studio'}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  {isVi ? 'Tên đơn vị / Chủ nhà' : 'Host / Business name'}
                </label>
                <input
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>
                {isVi ? 'Ghi chú giới thiệu chỗ ở (tùy chọn)' : 'Short listing summary (optional)'}
              </label>
              <textarea
                rows={3}
                value={form.descriptionNote}
                onChange={(e) => setForm({ ...form, descriptionNote: e.target.value })}
                className={`${inputClass} resize-y`}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={labelClass}>{isVi ? 'Khu vực bếp' : 'Kitchen setup'}</label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {KITCHEN_OPTIONS.map(({ value, en, vi }) => {
                  const active = form.kitchenType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setForm({
                          ...form,
                          kitchenType: value as WizardFormState['kitchenType'],
                        })
                      }
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        active
                          ? 'border-[#164E3F]/40 bg-[#E7F1EC] text-[#164E3F]'
                          : 'border-[#E5DFD3] bg-white text-[#17221E] hover:bg-[#FAF8F3]'
                      }`}
                    >
                      {isVi ? vi : en}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>{isVi ? 'Giặt sấy' : 'Laundry access'}</label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {LAUNDRY_OPTIONS.map(({ value, en, vi }) => {
                  const active = form.laundryType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setForm({
                          ...form,
                          laundryType: value as WizardFormState['laundryType'],
                        })
                      }
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        active
                          ? 'border-[#164E3F]/40 bg-[#E7F1EC] text-[#164E3F]'
                          : 'border-[#E5DFD3] bg-white text-[#17221E] hover:bg-[#FAF8F3]'
                      }`}
                    >
                      {isVi ? vi : en}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3.5 text-sm leading-relaxed text-[#53635D]">
              {isVi
                ? 'Không bắt buộc phải có bàn làm việc hay Wi-Fi tốc độ cao để đăng chỗ ở. Chỉ đánh dấu nếu thực tế phòng bạn có sẵn.'
                : 'Wi-Fi speed and workspace gear are completely optional. Select only what your space actually offers.'}
            </p>
            <div>
              <label className={labelClass}>
                {isVi ? 'Tốc độ tải xuống ước tính (Mbps, tùy chọn)' : 'Estimated download speed (Mbps, optional)'}
              </label>
              <input
                type="number"
                min={0}
                value={form.measuredDownloadMbps}
                onChange={(e) => setForm({ ...form, measuredDownloadMbps: e.target.value })}
                placeholder={isVi ? 'Để trống nếu không công bố' : 'Leave empty if not applicable'}
                className={`${inputClass} max-w-[14rem]`}
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {(
                [
                  { key: 'hasWorkspace', label: isVi ? 'Có bàn làm việc' : 'Dedicated desk' },
                  { key: 'hasErgonomicChair', label: isVi ? 'Ghế ngồi thoải mái' : 'Ergonomic chair' },
                  { key: 'hasExternalMonitor', label: isVi ? 'Có màn hình rời' : 'External monitor' },
                ] as const
              ).map(({ key, label }) => {
                const active = form[key];
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? 'border-[#164E3F]/40 bg-[#E7F1EC] text-[#164E3F]'
                        : 'border-[#E5DFD3] bg-white text-[#17221E] hover:bg-[#FAF8F3]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                      className="h-4 w-4 shrink-0 accent-[#164E3F]"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-1.5">
            <label className={labelClass}>
              {isVi ? 'Giá tham khảo mỗi đêm (VND)' : 'Target nightly rate (VND)'}
            </label>
            <input
              type="number"
              step={50000}
              value={form.nightlyEstimateVnd}
              onChange={(e) => setForm({ ...form, nightlyEstimateVnd: e.target.value })}
              className={`${inputClass} max-w-[14rem] font-semibold`}
            />
            <p className="text-sm leading-relaxed text-[#53635D]">
              {isVi
                ? 'Sau khi nộp, bạn có thể tinh chỉnh giá chi tiết 7/14/21/30 đêm, giá từng ngày trên Lịch và tải ảnh độ phân giải cao trong trình chỉnh sửa 10 phần.'
                : 'Once submitted, you can upload photos, customize 7/14/21/30-night package rates, and configure daily calendar pricing inside the 10-section Editor.'}
            </p>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-5">
            <div className="font-serif-display text-xl font-semibold tracking-tight text-[#17221E]">
              {form.stayName || 'Untitled Residence'}
            </div>
            <div className="text-sm text-[#53635D]">
              {form.businessName} ·{' '}
              {destLabel ? (isVi ? destLabel.nameVi : destLabel.nameEn) : form.destinationSlug} ·{' '}
              {form.propertyType}
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-[#164E3F]/20 bg-[#E7F1EC] px-3.5 py-2.5 text-sm font-semibold text-[#164E3F]">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {isVi
                  ? `${hostCommissionPct}% hoa hồng chủ nhà. Thu trực tiếp 100% tiền thuê khi khách nhận phòng.`
                  : `${hostCommissionPct}% host commission. Collect 100% of your room rate at check-in.`}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5DFD3] pt-5">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5DFD3] bg-white px-4 py-2.5 text-sm font-semibold text-[#17221E] transition hover:bg-[#FAF8F3]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {isVi ? 'Quay lại' : 'Back'}
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => saveDraft(step, false)}
              className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium text-[#53635D] transition hover:bg-[#FAF8F3] hover:text-[#17221E] disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isVi ? 'Lưu nháp' : 'Save draft'}
            </button>
          </div>

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              disabled={saving}
              onClick={goNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F392E] disabled:opacity-60"
            >
              {isVi ? 'Tiếp tục' : 'Next'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={publishing}
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#164E3F] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0F392E] disabled:opacity-60"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isVi ? 'Gửi duyệt đăng chỗ ở' : 'Submit listing'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
