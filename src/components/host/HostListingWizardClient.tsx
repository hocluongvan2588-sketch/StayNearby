'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Save,
  Send,
} from 'lucide-react';
import { usePreferences } from '@/components/PreferencesProvider';
import type { DestinationSummary } from '@/modules/catalog';

const TOTAL_STEPS = 6;

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
  const { locale } = usePreferences();
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <Link
            href="/host/listings"
            className="inline-flex items-center gap-1.5 font-medium text-[#53635D] hover:text-[#17221E]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {isVi ? 'Quay lại Chỗ ở' : 'Back to Listings'}
          </Link>
          <span className="font-semibold text-[#164E3F]">
            {isVi ? `Bước ${step} / ${TOTAL_STEPS}` : `Step ${step} of ${TOTAL_STEPS}`}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E5DFD3]">
          <div
            className="h-full bg-[#164E3F] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-2.5 text-xs font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-2.5 text-xs font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      <div className="space-y-5 rounded-xl border border-[#E5DFD3] bg-white p-6 text-xs">
        {step === 1 && (
          <div className="space-y-4">
            <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? '1. Loại hình & Điểm đến' : '1. Property Type & Destination'}
            </h1>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Điểm đến tại Việt Nam' : 'Destination'}
                </label>
                <select
                  value={form.destinationSlug}
                  onChange={(e) => setForm({ ...form, destinationSlug: e.target.value })}
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5"
                >
                  {destinations.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {isVi ? d.nameVi : d.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Loại hình chỗ ở' : 'Property type'}
                </label>
                <select
                  value={form.propertyType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      propertyType: e.target.value as WizardFormState['propertyType'],
                    })
                  }
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5"
                >
                  <option value="apartment">Serviced Apartment</option>
                  <option value="coliving">Coliving House</option>
                  <option value="boutique_hotel">Boutique Hotel</option>
                  <option value="villa">Villa</option>
                  <option value="eco_lodge">Eco Lodge</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? '2. Tên chỗ ở & Thương hiệu chủ nhà' : '2. Residence & Host Name'}
            </h1>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Tên chỗ ở' : 'Property / Stay name'}
                </label>
                <input
                  value={form.stayName}
                  onChange={(e) => setForm({ ...form, stayName: e.target.value })}
                  placeholder={isVi ? 'Ví dụ: Han River Sunlit Studio' : 'e.g., Han River Sunlit Studio'}
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 outline-none focus:border-[#164E3F]"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Tên đơn vị / Chủ nhà' : 'Host / Business name'}
                </label>
                <input
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 outline-none focus:border-[#164E3F]"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-[#17221E]">
                {isVi ? 'Ghi chú giới thiệu chỗ ở (tùy chọn)' : 'Short listing summary (optional)'}
              </label>
              <textarea
                rows={3}
                value={form.descriptionNote}
                onChange={(e) => setForm({ ...form, descriptionNote: e.target.value })}
                className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? '3. Tiện nghi sinh hoạt cơ bản' : '3. Kitchen & Laundry Facilities'}
            </h1>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Khu vực bếp' : 'Kitchen setup'}
                </label>
                <select
                  value={form.kitchenType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      kitchenType: e.target.value as WizardFormState['kitchenType'],
                    })
                  }
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5"
                >
                  <option value="full">{isVi ? 'Bếp nấu riêng đầy đủ' : 'Full private kitchen'}</option>
                  <option value="kitchenette">{isVi ? 'Bếp nhỏ (Kitchenette)' : 'Kitchenette'}</option>
                  <option value="shared">{isVi ? 'Bếp dùng chung' : 'Shared kitchen'}</option>
                  <option value="none">{isVi ? 'Không có bếp' : 'No kitchen'}</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Giặt sấy' : 'Laundry access'}
                </label>
                <select
                  value={form.laundryType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      laundryType: e.target.value as WizardFormState['laundryType'],
                    })
                  }
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5"
                >
                  <option value="in_unit">{isVi ? 'Máy giặt trong phòng' : 'In-unit washer'}</option>
                  <option value="building">{isVi ? 'Giặt chung trong tòa nhà' : 'Shared building laundry'}</option>
                  <option value="service">{isVi ? 'Dịch vụ giặt ủi' : 'Laundry service nearby'}</option>
                  <option value="none">{isVi ? 'Không có' : 'None'}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? '4. Wi-Fi & Góc làm việc (Hoàn toàn tùy chọn)' : '4. Optional Wi-Fi & Workspace'}
            </h1>
            <p className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] p-3 text-[#53635D]">
              {isVi
                ? 'Không bắt buộc phải có bàn làm việc hay Wi-Fi tốc độ cao để đăng chỗ ở. Chỉ đánh dấu nếu thực tế phòng bạn có sẵn.'
                : 'Wi-Fi speed and workspace gear are completely optional. Select only what your space actually offers.'}
            </p>
            <div>
              <label className="mb-1 block font-semibold text-[#17221E]">
                {isVi ? 'Tốc độ tải xuống ước tính (Mbps — tùy chọn)' : 'Estimated download speed (Mbps — optional)'}
              </label>
              <input
                type="number"
                min={0}
                value={form.measuredDownloadMbps}
                onChange={(e) => setForm({ ...form, measuredDownloadMbps: e.target.value })}
                placeholder={isVi ? 'Để trống nếu không công bố' : 'Leave empty if not applicable'}
                className="w-full max-w-xs rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex items-center gap-2 rounded-lg border border-[#E5DFD3] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.hasWorkspace}
                  onChange={(e) => setForm({ ...form, hasWorkspace: e.target.checked })}
                />
                {isVi ? 'Có bàn làm việc' : 'Dedicated desk'}
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-[#E5DFD3] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.hasErgonomicChair}
                  onChange={(e) => setForm({ ...form, hasErgonomicChair: e.target.checked })}
                />
                {isVi ? 'Ghế ngồi thoải mái' : 'Ergonomic chair'}
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-[#E5DFD3] px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.hasExternalMonitor}
                  onChange={(e) => setForm({ ...form, hasExternalMonitor: e.target.checked })}
                />
                {isVi ? 'Có màn hình rời' : 'External monitor'}
              </label>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? '5. Giá tham khảo (0% hoa hồng chủ nhà)' : '5. Target Rate (0% Host Commission)'}
            </h1>
            <div>
              <label className="mb-1 block font-semibold text-[#17221E]">
                {isVi ? 'Giá tham khảo mỗi đêm (VND)' : 'Target nightly rate (VND)'}
              </label>
              <input
                type="number"
                step={50000}
                value={form.nightlyEstimateVnd}
                onChange={(e) => setForm({ ...form, nightlyEstimateVnd: e.target.value })}
                className="w-full max-w-xs rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5"
              />
              <p className="mt-1.5 text-[#53635D]">
                {isVi
                  ? 'Sau khi nộp, bạn có thể tinh chỉnh giá chi tiết 7/14/21/30 đêm, giá từng ngày trên Lịch và tải ảnh độ phân giải cao trong trình chỉnh sửa 10 phần.'
                  : 'Once submitted, you can upload photos, customize 7/14/21/30-night package rates, and configure daily calendar pricing inside the 10-section Editor.'}
              </p>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? '6. Kiểm tra & Gửi duyệt hồ sơ chỗ ở' : '6. Review & Submit Listing'}
            </h1>
            <div className="space-y-2 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4">
              <div className="text-sm font-semibold text-[#17221E]">
                {form.stayName || 'Untitled Residence'}
              </div>
              <div className="text-[#53635D]">
                {form.businessName} ·{' '}
                {destLabel ? (isVi ? destLabel.nameVi : destLabel.nameEn) : form.destinationSlug} ·{' '}
                {form.propertyType}
              </div>
              <div className="text-[#164E3F] font-semibold">
                {isVi
                  ? '0% hoa hồng chủ nhà — thu trực tiếp 100% giá phòng khi khách nhận phòng.'
                  : '0% host commission — collect 100% of your room rate directly at check-in.'}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5DFD3] pt-4">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-white px-3.5 py-2 font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {isVi ? 'Quay lại' : 'Back'}
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => saveDraft(step, false)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-white px-3.5 py-2 font-medium text-[#53635D] hover:bg-[#FAF8F3]"
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-4 py-2 font-semibold text-white hover:bg-[#0F392E]"
            >
              {isVi ? 'Tiếp tục' : 'Next'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={publishing}
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-5 py-2.5 font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
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
