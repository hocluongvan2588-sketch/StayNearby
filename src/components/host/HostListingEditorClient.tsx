'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Laptop,
  Loader2,
  MapPin,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  Upload,
} from 'lucide-react';
import { HostLocalPlacesPanel } from '@/components/host/HostLocalPlacesPanel';
import {
  formatCancellationPolicyLabel,
  formatPropertyTypeLabel,
  formatVndExact,
} from '@/lib/i18n';
import { clampHostMinNights, POLICY_MIN_NIGHTS } from '@/lib/business-rules';
import { KITCHEN_OPTIONS, LAUNDRY_OPTIONS, PROPERTY_TYPE_OPTIONS } from '@/lib/listing-options';
import { usePreferences } from '@/components/PreferencesProvider';
import {
  ListingCheckboxCard,
  ListingHint,
  ListingInput,
  ListingSectionTitle,
  ListingSelect,
  ListingTextarea,
} from '@/components/listing-form';
import { wifiStatusLabel } from '@/lib/wifi-status';
import type { DestinationSummary } from '@/modules/catalog';
import type { HostStayRoomItem, HostStaySummary } from '@/modules/host';

const SECTION_DEFS = [
  { key: 'basic', en: '1. Basic Information', vi: '1. Thông tin cơ bản', icon: FileText },
  { key: 'photos', en: '2. Photos & Videos', vi: '2. Hình ảnh & Video', icon: Camera },
  { key: 'amenities', en: '3. Amenities', vi: '3. Tiện nghi chỗ ở', icon: Sparkles },
  { key: 'workspace', en: '4. Internet & Workspace', vi: '4. Internet & Không gian làm việc', icon: Laptop },
  { key: 'location', en: '5. Location', vi: '5. Vị trí & Địa chỉ', icon: MapPin },
  { key: 'local', en: '6. Local Recommendations', vi: '6. Giới thiệu khu vực', icon: Store },
  { key: 'pricing', en: '7. Pricing', vi: '7. Bảng giá & Gói dài ngày', icon: DollarSign },
  { key: 'availability', en: '8. Availability', vi: '8. Tình trạng & Lịch mở bán', icon: CalendarClock },
  { key: 'rules', en: '9. House Rules', vi: '9. Nội quy chỗ ở', icon: ClipboardList },
  { key: 'policies', en: '10. Booking & Policies', vi: '10. Chính sách đặt & Hủy', icon: ShieldCheck },
  { key: 'preview', en: '11. Preview', vi: '11. Xem trước hiển thị', icon: Eye },
] as const;

type SectionKey = (typeof SECTION_DEFS)[number]['key'];

export function HostListingEditorClient({
  initialStay,
  destinations,
}: {
  initialStay: HostStaySummary;
  destinations: DestinationSummary[];
}) {
  const { locale, hostCommissionPct } = usePreferences();
  const isVi = locale === 'vi';

  const [stay] = useState<HostStaySummary>(initialStay);
  const [activeSection, setActiveSection] = useState<SectionKey>('basic');

  // 1. Basic
  const [titleEn, setTitleEn] = useState(stay.titleEn);
  const [titleVi, setTitleVi] = useState(stay.titleVi);
  const [subtitleEn, setSubtitleEn] = useState(stay.subtitleEn);
  const [subtitleVi, setSubtitleVi] = useState(stay.subtitleVi);
  const [descriptionEn, setDescriptionEn] = useState(stay.descriptionEn);
  const [descriptionVi, setDescriptionVi] = useState(stay.descriptionVi);
  const [propertyType, setPropertyType] = useState<HostStaySummary['propertyType']>(
    stay.propertyType
  );

  // 2. Photos & Videos
  const [heroImage, setHeroImage] = useState(stay.heroImage);
  const [workspacePhotoUrl, setWorkspacePhotoUrl] = useState(stay.workspacePhotoUrl);
  const [galleryImages, setGalleryImages] = useState<string[]>(stay.galleryImages);
  const [photoUrlInput, setPhotoUrlInput] = useState('');

  // 3. Amenities
  const [amenitiesText, setAmenitiesText] = useState(stay.amenities.join('\n'));
  const [kitchenType, setKitchenType] = useState<HostStaySummary['kitchenType']>(
    stay.kitchenType
  );
  const [laundryType, setLaundryType] = useState<HostStaySummary['laundryType']>(
    stay.laundryType
  );
  const [petFriendly, setPetFriendly] = useState(stay.petFriendly);
  const [wheelchairFriendly, setWheelchairFriendly] = useState(stay.wheelchairFriendly);

  // 4. Optional Workspace
  const [hasWorkspace, setHasWorkspace] = useState(stay.hasWorkspace);
  const [hasErgonomicChair, setHasErgonomicChair] = useState(stay.hasErgonomicChair);
  const [hasExternalMonitor, setHasExternalMonitor] = useState(stay.hasExternalMonitor);
  const [hasCallBooth, setHasCallBooth] = useState(stay.hasCallBooth);
  const [workspaceSummaryEn, setWorkspaceSummaryEn] = useState(stay.workspaceSummaryEn);
  const [workspaceSummaryVi, setWorkspaceSummaryVi] = useState(stay.workspaceSummaryVi);
  // 4. Internet & Wi-Fi — manual declaration only (Phase A). NULL = chưa
  // cập nhật; no defaults, no derived values; never blocks publishing.
  const [wifiHasService, setWifiHasService] = useState<boolean | null>(stay.wifiHasService);
  const [wifiDownload, setWifiDownload] = useState<number | null>(stay.wifiDownloadMbps);
  const [wifiUpload, setWifiUpload] = useState<number | null>(stay.wifiUploadMbps);
  const [wifiPing, setWifiPing] = useState<number | null>(stay.wifiPingMs);
  // Jitter is NOT a host-declared field (Phase A scope): DB column stays for
  // direct measurement only, no editor input.
  const [wifiTestedDate, setWifiTestedDate] = useState<string>(
    stay.wifiTestedAt ? stay.wifiTestedAt.slice(0, 10) : ''
  );
  const [wifiProofUrl, setWifiProofUrl] = useState<string>(stay.speedtestProofUrl || '');

  // 5. Location
  const [destinationId, setDestinationId] = useState(stay.destinationId);
  const [neighborhoodEn, setNeighborhoodEn] = useState(stay.neighborhoodEn);
  const [neighborhoodVi, setNeighborhoodVi] = useState(stay.neighborhoodVi);
  const [exactAddress, setExactAddress] = useState(stay.exactAddress);
  const [checkinInstructionsEn, setCheckinInstructionsEn] = useState(
    stay.checkinInstructionsEn
  );
  const [checkinInstructionsVi, setCheckinInstructionsVi] = useState(
    stay.checkinInstructionsVi
  );
  const [googleMapsUrl, setGoogleMapsUrl] = useState(stay.googleMapsUrl ?? '');

  // 6. Rooms & Pricing
  const [rooms, setRooms] = useState<HostStayRoomItem[]>(stay.rooms);
  const [newRoomNameEn, setNewRoomNameEn] = useState('');
  const [newRoomNameVi, setNewRoomNameVi] = useState('');
  const [newRoomDescEn, setNewRoomDescEn] = useState('Private fully-furnished residence');
  const [newRoomMonthlyVnd, setNewRoomMonthlyVnd] = useState('16000000');

  // 7. Availability
  const [status, setStatus] = useState(stay.status);
  const [defaultMinNights, setDefaultMinNights] = useState(
    String(clampHostMinNights(stay.defaultMinNights || POLICY_MIN_NIGHTS))
  );

  // 8. House Rules
  const [checkinFrom, setCheckinFrom] = useState(stay.checkinFrom);
  const [checkoutBefore, setCheckoutBefore] = useState(stay.checkoutBefore);
  const [quietHours, setQuietHours] = useState(stay.houseRules.quietHours);
  const [smokingAllowed, setSmokingAllowed] = useState(stay.houseRules.smokingAllowed);
  const [partiesAllowed, setPartiesAllowed] = useState(stay.houseRules.partiesAllowed);
  const [petsNote, setPetsNote] = useState(stay.houseRules.petsNote);
  const [extraGuestNote, setExtraGuestNote] = useState(stay.houseRules.extraGuestNote);

  // 9. Policies
  const [isInstantBook, setIsInstantBook] = useState(stay.isInstantBook);
  const [cancellationPolicy, setCancellationPolicy] =
    useState<HostStaySummary['cancellationPolicy']>(stay.cancellationPolicy);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [pendingRevision, setPendingRevision] = useState<{
    changedFields: string[];
    createdAt: string;
  } | null>(null);

  // Live listings: surface any price/policy change waiting for admin review.
  useEffect(() => {
    if (stay.status !== 'live') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/host/stays/${stay.id}/revisions`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok: boolean;
          revisions?: { status: string; changedFields: string[]; createdAt: string }[];
        };
        if (cancelled || !json.ok || !Array.isArray(json.revisions)) return;
        const pending = json.revisions.find((r) => r.status === 'pending');
        if (pending) {
          setPendingRevision({
            changedFields: pending.changedFields,
            createdAt: pending.createdAt,
          });
        }
      } catch {
        /* banner is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stay.id, stay.status]);

  async function handleSaveAll() {
    setSaving(true);
    setNotice('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stay.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleEn,
          titleVi,
          subtitleEn,
          subtitleVi,
          descriptionEn,
          descriptionVi,
          propertyType,
          heroImage,
          workspacePhotoUrl,
          galleryImages,
          amenities: amenitiesText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          kitchenType,
          laundryType,
          petFriendly,
          wheelchairFriendly,
          hasWorkspace,
          hasErgonomicChair,
          hasExternalMonitor,
          hasCallBooth,
          wifiHasService,
          wifiDownloadMbps: wifiDownload,
          wifiUploadMbps: wifiUpload,
          wifiPingMs: wifiPing,
          wifiJitterMs: null,
          wifiTestedAt: wifiTestedDate || undefined,
          speedtestProofUrl: wifiProofUrl,
          workspaceSummaryEn,
          workspaceSummaryVi,
          neighborhoodEn,
          neighborhoodVi,
          exactAddress,
          googleMapsUrl,
          checkinInstructionsEn,
          checkinInstructionsVi,
          ...(destinationId !== stay.destinationId ? { destinationId } : {}),
          checkinFrom,
          checkoutBefore,
          defaultMinNights: clampHostMinNights(Number(defaultMinNights) || POLICY_MIN_NIGHTS),
          houseRules: {
            quietHours,
            smokingAllowed,
            partiesAllowed,
            petsNote,
            extraGuestNote,
          },
          isInstantBook,
          cancellationPolicy,
          status:
            status === 'live' || status === 'paused' ? status : undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not save listing changes.');
        return;
      }
      if (json.pendingRevision) {
        setNotice(
          isVi
            ? 'Đã gửi thay đổi giá/chính sách — chờ admin duyệt trước khi áp dụng.'
            : 'Price/policy changes submitted — awaiting admin approval before they apply.'
        );
        setPendingRevision({
          changedFields: Array.isArray(json.stagedFields) ? json.stagedFields : [],
          createdAt: new Date().toISOString(),
        });
        return;
      }
      setNotice(isVi ? 'Đã lưu toàn bộ cấu hình chỗ ở.' : 'Saved listing configuration.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForReview() {
    setSubmitting(true);
    setNotice('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stay.id}/submit`, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErrorMsg(
          json?.error?.message ??
            (isVi ? 'Không thể gửi duyệt.' : 'Could not submit for review.')
        );
        return;
      }
      setStatus('pending_review');
      setNotice(
        isVi
          ? 'Đã gửi duyệt. Admin sẽ xem xét listing của bạn.'
          : 'Submitted for review. An admin will review your listing.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('role', 'gallery');
      const res = await fetch(`/api/host/stays/${stay.id}/media`, {
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
        setGalleryImages((prev) => [...prev, ...urls]);
      }
      setNotice(isVi ? 'Đã tải ảnh lên thành công.' : 'Photo uploaded.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleAddPhotoUrl() {
    const trimmed = photoUrlInput.trim();
    if (!trimmed) return;
    if (!galleryImages.includes(trimmed)) {
      setGalleryImages((prev) => [...prev, trimmed]);
    }
    setPhotoUrlInput('');
    setNotice(
      isVi
        ? 'Đã thêm ảnh vào danh sách (nhớ bấm Lưu tất cả thay đổi).'
        : 'Added photo URL (click Save changes to persist).'
    );
  }

  async function handleRemovePhoto(url: string) {
    const res = await fetch(`/api/host/stays/${stay.id}/media`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();
    if (json.ok) {
      setGalleryImages((prev) => prev.filter((u) => u !== url));
    }
  }

  async function handleSaveRoomRates(idx: number) {
    const rm = rooms[idx];
    if (!rm) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stay.id}/rooms/${rm.id}`, {
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
        setErrorMsg(json.error?.message ?? 'Could not save room pricing.');
        return;
      }
      setNotice(isVi ? `Đã lưu giá phòng ${rm.nameVi}.` : `Saved rates for ${rm.nameEn}.`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRoom() {
    if (!newRoomNameEn.trim()) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const w30 = Math.max(2000000, Number(newRoomMonthlyVnd) || 15000000);
      const res = await fetch(`/api/host/stays/${stay.id}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameEn: newRoomNameEn.trim(),
          nameVi: newRoomNameVi.trim() || newRoomNameEn.trim(),
          descriptionEn: newRoomDescEn.trim(),
          descriptionVi: newRoomDescEn.trim(),
          maxGuests: 2,
          bedsCount: 1,
          unitsTotal: 1,
          wholesale30Vnd: w30,
          wholesale21Vnd: Math.round((w30 / 30) * 21 * 1.05),
          wholesale14Vnd: Math.round((w30 / 30) * 14 * 1.08),
          wholesale7Vnd: Math.round((w30 / 30) * 7 * 1.15),
          extraNightVnd: Math.round(w30 / 30),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not add room.');
        return;
      }
      setNotice(
        isVi
          ? 'Đã tạo phòng mới. Tải lại trang để chỉnh sửa bảng giá chi tiết.'
          : 'Created new room. Reload page to edit package breakdown.'
      );
      setNewRoomNameEn('');
      setNewRoomNameVi('');
    } finally {
      setSaving(false);
    }
  }

  const allPhotos = Array.from(new Set([heroImage, ...galleryImages].filter(Boolean)));

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/host/listings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5DFD3] bg-white text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="font-serif-display text-xl font-semibold text-[#17221E] sm:text-2xl">
              {isVi ? titleVi : titleEn}
            </h1>
            <p className="text-xs text-[#53635D]">
              {isVi ? neighborhoodVi : neighborhoodEn} ·{' '}
              {isVi ? stay.destinationNameVi : stay.destinationNameEn}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(status === 'live' || status === 'paused') && (
            <Link
              href={`/stays/${stay.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#53635D]" />
              {isVi ? 'Xem trang khách' : 'Public view'}
            </Link>
          )}
          {status === 'draft' && (
            <button
              type="button"
              disabled={submitting || saving}
              onClick={handleSubmitForReview}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#164E3F]/40 bg-[#E7F1EC] px-4 py-2 text-xs font-semibold text-[#164E3F] hover:bg-[#DCEDE4] disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              {isVi ? 'Gửi duyệt' : 'Submit for review'}
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveAll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isVi ? 'Lưu tất cả thay đổi' : 'Save changes'}
          </button>
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
      {pendingRevision && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-2.5 text-xs font-medium text-[#C25E28]">
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span>
            {isVi
              ? `Thay đổi giá/chính sách đang chờ admin duyệt (${pendingRevision.changedFields.join(', ') || '—'}) — gửi lúc ${new Date(pendingRevision.createdAt).toLocaleString()}.`
              : `Price/policy changes awaiting admin review (${pendingRevision.changedFields.join(', ') || '—'}) — submitted ${new Date(pendingRevision.createdAt).toLocaleString()}.`}
          </span>
        </div>
      )}

      {/* 10-Section Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:col-span-3 lg:flex-col lg:overflow-visible">
          {SECTION_DEFS.map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.key;
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setActiveSection(sec.key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition ${
                  active
                    ? 'border-[#164E3F] bg-[#E7F1EC] font-semibold text-[#164E3F]'
                    : 'border-transparent bg-white text-[#53635D] hover:border-[#E5DFD3] hover:text-[#17221E]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>{isVi ? sec.vi : sec.en}</span>
              </button>
            );
          })}
        </nav>

        <div className="rounded-xl border border-[#E5DFD3] bg-white p-6 text-xs lg:col-span-9">
          {activeSection === 'basic' && (
            <div className="space-y-4">
              <ListingSectionTitle>
                {isVi ? '1. Thông tin cơ bản' : '1. Basic Information'}
              </ListingSectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <ListingInput label="Title (EN)" value={titleEn} onChange={setTitleEn} />
                <ListingInput label="Tiêu đề (VI)" value={titleVi} onChange={setTitleVi} />
                <ListingInput
                  label="Subtitle (EN)"
                  value={subtitleEn}
                  onChange={setSubtitleEn}
                />
                <ListingInput
                  label="Phụ đề (VI)"
                  value={subtitleVi}
                  onChange={setSubtitleVi}
                />
                <ListingSelect
                  label={isVi ? 'Loại hình chỗ ở' : 'Property type'}
                  value={propertyType}
                  onChange={(v) => setPropertyType(v as HostStaySummary['propertyType'])}
                  options={PROPERTY_TYPE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: isVi ? o.vi : o.en,
                  }))}
                />
              </div>
              <ListingTextarea
                label="Description (EN)"
                rows={4}
                value={descriptionEn}
                onChange={setDescriptionEn}
              />
              <ListingTextarea
                label="Mô tả (VI)"
                rows={4}
                value={descriptionVi}
                onChange={setDescriptionVi}
              />
            </div>
          )}

          {activeSection === 'photos' && (
            <div className="space-y-5">
              <ListingSectionTitle>
                {isVi ? '2. Hình ảnh & Bộ sưu tập' : '2. Photos & Media'}
              </ListingSectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#164E3F] bg-[#FAF8F3] px-4 py-3 font-semibold text-[#164E3F] hover:bg-[#E7F1EC]">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <span>{isVi ? 'Tải ảnh từ máy tính' : 'Upload photo file'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadFile}
                    className="hidden"
                  />
                </label>

                <div className="flex gap-2">
                  <input
                    type="url"
                    value={photoUrlInput}
                    onChange={(e) => setPhotoUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={handleAddPhotoUrl}
                    className="rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
                  >
                    {isVi ? 'Thêm URL' : 'Add URL'}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {allPhotos.map((url) => {
                  const isCover = url === heroImage;
                  return (
                    <div
                      key={url}
                      className="overflow-hidden rounded-xl border border-[#E5DFD3] bg-[#FAF8F3]"
                    >
                      <img src={url} alt="" className="aspect-[16/10] w-full object-cover" />
                      <div className="flex items-center justify-between p-2">
                        {isCover ? (
                          <span className="rounded bg-[#E7F1EC] px-2 py-0.5 text-[10px] font-semibold text-[#164E3F]">
                            {isVi ? 'Ảnh bìa' : 'Cover'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setHeroImage(url)}
                            className="text-[11px] font-medium text-[#53635D] hover:text-[#164E3F]"
                          >
                            {isVi ? 'Đặt làm ảnh bìa' : 'Set cover'}
                          </button>
                        )}
                        {!isCover && (
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(url)}
                            className="p-1 text-[#53635D] hover:text-[#C25E28]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <ListingInput
                label={isVi ? 'URL ảnh góc làm việc (tùy chọn)' : 'Workspace photo URL (optional)'}
                value={workspacePhotoUrl}
                onChange={setWorkspacePhotoUrl}
              />
            </div>
          )}

          {activeSection === 'amenities' && (
            <div className="space-y-4">
              <ListingSectionTitle>
                {isVi ? '3. Tiện nghi chỗ ở' : '3. Amenities'}
              </ListingSectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <ListingSelect
                  label={isVi ? 'Khu vực bếp' : 'Kitchen'}
                  value={kitchenType}
                  onChange={(v) => setKitchenType(v as HostStaySummary['kitchenType'])}
                  options={KITCHEN_OPTIONS.map((o) => ({
                    value: o.value,
                    label: isVi ? o.vi : o.en,
                  }))}
                />
                <ListingSelect
                  label={isVi ? 'Giặt sấy' : 'Laundry'}
                  value={laundryType}
                  onChange={(v) => setLaundryType(v as HostStaySummary['laundryType'])}
                  options={LAUNDRY_OPTIONS.map((o) => ({
                    value: o.value,
                    label: isVi ? o.vi : o.en,
                  }))}
                />
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <ListingCheckboxCard
                  label={isVi ? 'Thân thiện với thú cưng' : 'Pet friendly'}
                  checked={petFriendly}
                  onChange={setPetFriendly}
                />
                <ListingCheckboxCard
                  label={isVi ? 'Hỗ trợ xe lăn' : 'Wheelchair accessible'}
                  checked={wheelchairFriendly}
                  onChange={setWheelchairFriendly}
                />
              </div>
              <ListingTextarea
                label={isVi ? 'Danh sách tiện nghi (mỗi dòng 1 mục)' : 'Amenities list (one per line)'}
                rows={6}
                value={amenitiesText}
                onChange={setAmenitiesText}
              />
            </div>
          )}

          {activeSection === 'workspace' && (
            <div className="space-y-8">
              {/* 4.1 Internet & Wi-Fi — toàn bộ tùy chọn, NULL = chưa cập nhật */}
              <div className="space-y-4">
                <ListingSectionTitle
                  description={
                    isVi
                      ? 'Không bắt buộc kiểm tra tốc độ để đăng listing. Để trống nếu chưa khai báo.'
                      : 'A speed test is never required to publish. Leave empty when not provided.'
                  }
                >
                  {isVi ? '4.1 Internet & Wi-Fi' : '4.1 Internet & Wi-Fi'}
                </ListingSectionTitle>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ListingSelect
                    label={isVi ? 'Có Wi-Fi tại chỗ ở?' : 'Wi-Fi available?'}
                    value={wifiHasService === null ? '' : String(wifiHasService)}
                    onChange={(v) => setWifiHasService(v === '' ? null : v === 'true')}
                    options={[
                      { value: '', label: isVi ? 'Chưa cập nhật' : 'Not updated' },
                      { value: 'true', label: isVi ? 'Có' : 'Yes' },
                      { value: 'false', label: isVi ? 'Không' : 'No' },
                    ]}
                  />
                  <ListingInput
                    type="number"
                    min={0}
                    max={10000}
                    label={isVi ? 'Download (Mbps)' : 'Download (Mbps)'}
                    value={wifiDownload ?? ''}
                    disabled={wifiHasService === false}
                    onChange={(v) =>
                      setWifiDownload(v === '' ? null : Math.max(0, Math.round(Number(v) || 0)))
                    }
                  />
                  <ListingInput
                    type="number"
                    min={0}
                    max={10000}
                    label="Upload (Mbps)"
                    value={wifiUpload ?? ''}
                    disabled={wifiHasService === false}
                    onChange={(v) =>
                      setWifiUpload(v === '' ? null : Math.max(0, Math.round(Number(v) || 0)))
                    }
                  />
                  <ListingInput
                    type="number"
                    min={0}
                    max={5000}
                    label="Ping (ms)"
                    value={wifiPing ?? ''}
                    disabled={wifiHasService === false}
                    onChange={(v) =>
                      setWifiPing(v === '' ? null : Math.max(0, Math.round(Number(v) || 0)))
                    }
                  />
                  <ListingInput
                    type="date"
                    label={isVi ? 'Ngày kiểm tra' : 'Test date'}
                    value={wifiTestedDate}
                    disabled={wifiHasService === false}
                    onChange={setWifiTestedDate}
                    hint={
                      wifiTestedDate
                        ? undefined
                        : isVi
                          ? 'Chưa có ngày kiểm tra.'
                          : 'No test date yet.'
                    }
                  />
                  <ListingInput
                    label={
                      isVi ? 'Đường dẫn hoặc ảnh kết quả kiểm tra' : 'Result link or image'
                    }
                    placeholder="https://…"
                    value={wifiProofUrl}
                    disabled={wifiHasService === false}
                    onChange={setWifiProofUrl}
                    hint={
                      isVi
                        ? 'Không bắt buộc — dán link speedtest hoặc URL ảnh kết quả.'
                        : 'Optional — paste a speed-test link or a result image URL.'
                    }
                  />
                </div>
                {/* Guidance — đúng câu ngắn + link bài CMS (không nhồi nội dung dài vào editor) */}
                <p className="text-xs leading-relaxed text-[#53635D]">
                  {isVi
                    ? 'Để cung cấp thông tin chính xác cho khách, hãy kết nối với mạng Wi-Fi tại chỗ ở và kiểm tra tốc độ Internet trước khi nhập kết quả.'
                    : 'For accurate guest information, connect to the property Wi-Fi and run an Internet speed test before entering your results.'}{' '}
                  <Link
                    href="/guides/wifi-speed-test-guide"
                    className="font-semibold text-[#1C7C64] underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {isVi
                      ? 'Hướng dẫn kiểm tra tốc độ Wi-Fi'
                      : 'How to test your Wi-Fi speed'}
                  </Link>
                </p>
                {(wifiDownload !== null || wifiUpload !== null || wifiPing !== null) && (
                  <p className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs text-[#53635D]">
                    {isVi ? 'Kết quả gần nhất: ' : 'Latest: '}
                    <span className="font-semibold text-[#17221E]">
                      {wifiDownload !== null ? `${wifiDownload} Mbps ↓` : ''}
                      {wifiUpload !== null ? ` · ${wifiUpload} Mbps ↑` : ''}
                      {wifiPing !== null ? ` · Ping ${wifiPing} ms` : ''}
                    </span>
                    {' · '}
                    {wifiStatusLabel(stay.wifiStatus, isVi)}
                    {wifiTestedDate ? ` · ${wifiTestedDate}` : ''}
                  </p>
                )}
                {stay.wifiStatus !== 'not_updated' &&
                  (wifiDownload === null && wifiUpload === null && wifiPing === null) && (
                    <p className="text-xs text-[#53635D]">
                      {wifiStatusLabel(stay.wifiStatus, isVi)}
                    </p>
                  )}
              </div>

              {/* 4.2 Workspace */}
              <div className="space-y-4">
                <ListingSectionTitle
                  description={
                    isVi
                      ? 'Tiện ích làm việc từ xa là tùy chọn và không ảnh hưởng tới điều kiện đăng phòng.'
                      : 'All workspace fields are optional and never block publishing.'
                  }
                >
                  {isVi ? '4.2 Không gian làm việc' : '4.2 Workspace'}
                </ListingSectionTitle>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <ListingCheckboxCard
                    label={isVi ? 'Bàn làm việc riêng' : 'Dedicated desk'}
                    checked={hasWorkspace}
                    onChange={setHasWorkspace}
                  />
                  <ListingCheckboxCard
                    label={isVi ? 'Ghế công thái học' : 'Ergonomic chair'}
                    checked={hasErgonomicChair}
                    onChange={setHasErgonomicChair}
                  />
                  <ListingCheckboxCard
                    label={isVi ? 'Màn hình rời' : 'External monitor'}
                    checked={hasExternalMonitor}
                    onChange={setHasExternalMonitor}
                  />
                  <ListingCheckboxCard
                    label={isVi ? 'Khu vực gọi video yên tĩnh' : 'Quiet call booth'}
                    checked={hasCallBooth}
                    onChange={setHasCallBooth}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ListingTextarea
                    label={isVi ? 'Mô tả bổ sung (EN)' : 'Additional description (EN)'}
                    value={workspaceSummaryEn}
                    onChange={setWorkspaceSummaryEn}
                  />
                  <ListingTextarea
                    label={isVi ? 'Mô tả bổ sung (VI)' : 'Additional description (VI)'}
                    value={workspaceSummaryVi}
                    onChange={setWorkspaceSummaryVi}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'location' && (
            <div className="space-y-4">
              <ListingSectionTitle>
                {isVi ? '5. Vị trí & Hướng dẫn nhận phòng' : '5. Location & Check-in Details'}
              </ListingSectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <ListingSelect
                  label={isVi ? 'Điểm đến' : 'Destination'}
                  value={destinationId}
                  onChange={setDestinationId}
                  options={destinations.map((d) => ({
                    value: d.id,
                    label: isVi
                      ? `${d.nameVi} · ${d.regionVi}`
                      : `${d.nameEn} · ${d.regionEn}`,
                  }))}
                  hint={
                    isVi
                      ? 'Chọn thành phố của chỗ ở.'
                      : 'Choose the city for this listing.'
                  }
                />
                <ListingInput
                  label="Neighborhood (EN)"
                  value={neighborhoodEn}
                  onChange={setNeighborhoodEn}
                />
                <ListingInput
                  label="Khu vực (VI)"
                  value={neighborhoodVi}
                  onChange={setNeighborhoodVi}
                />
                <ListingInput
                  className="sm:col-span-2"
                  label={
                    isVi
                      ? 'Địa chỉ chính xác (chỉ gửi khách sau khi xác nhận đặt phòng)'
                      : 'Exact address (shared after booking confirmation)'
                  }
                  value={exactAddress}
                  onChange={setExactAddress}
                />
                <ListingInput
                  className="sm:col-span-2"
                  label={
                    isVi
                      ? 'Link Google Maps của chỗ ở (tùy chọn — dùng cho khoảng cách gợi ý)'
                      : 'Google Maps link for this listing (optional — powers distance suggestions)'
                  }
                  placeholder="https://www.google.com/maps/..."
                  value={googleMapsUrl}
                  onChange={setGoogleMapsUrl}
                  hint={
                    isVi
                      ? 'Dán link chia sẻ từ Google Maps; tọa độ được đọc tự động, không gọi API trả phí.'
                      : 'Paste a Google Maps share link; coordinates are read automatically (no paid API).'
                  }
                />
                <ListingTextarea
                  label="Check-in instructions (EN)"
                  value={checkinInstructionsEn}
                  onChange={setCheckinInstructionsEn}
                />
                <ListingTextarea
                  label="Hướng dẫn nhận phòng (VI)"
                  value={checkinInstructionsVi}
                  onChange={setCheckinInstructionsVi}
                />
              </div>
            </div>
          )}

          {activeSection === 'local' && (
            <div className="space-y-4">
              <ListingSectionTitle
                description={
                  isVi
                    ? 'Tùy chọn: giới thiệu địa điểm hữu ích quanh chỗ ở. VietNomad kiểm duyệt trước khi hiển thị cho khách.'
                    : 'Optional: recommend useful nearby places. VietNomad reviews them before guests see them.'
                }
              >
                {isVi ? '6. Giới thiệu khu vực xung quanh' : '6. Local Recommendations'}
              </ListingSectionTitle>
              <HostLocalPlacesPanel stayId={stay.id} />
            </div>
          )}

          {activeSection === 'pricing' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <ListingSectionTitle
                  description={
                    isVi
                      ? `${hostCommissionPct}% hoa hồng chủ nhà. Bạn nhận đủ 100% các mức giá nhập dưới đây.`
                      : `${hostCommissionPct}% host commission. You receive 100% of these rates.`
                  }
                >
                  {isVi ? '7. Phòng & Bảng giá gói 7/14/21/30 đêm' : '7. Rooms & Package Rates'}
                </ListingSectionTitle>
                <Link href="/host/calendar" className="font-semibold text-[#164E3F] hover:underline">
                  {isVi ? 'Chỉnh giá theo từng ngày →' : 'Daily overrides on Calendar →'}
                </Link>
              </div>

              {rooms.map((rm, idx) => (
                <div
                  key={rm.id}
                  className="space-y-3 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ListingInput
                      label={isVi ? 'Tên phòng (EN)' : 'Room name (EN)'}
                      value={rm.nameEn}
                      onChange={(v) =>
                        setRooms((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, nameEn: v } : x))
                        )
                      }
                    />
                    <ListingInput
                      type="number"
                      min={1}
                      max={50}
                      label={isVi ? 'Số lượng căn/phòng' : 'Total units'}
                      value={rm.unitsTotal}
                      onChange={(v) =>
                        setRooms((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, unitsTotal: Number(v) } : x
                          )
                        )
                      }
                    />
                    <ListingInput
                      type="number"
                      min={1}
                      max={12}
                      label={isVi ? 'Số khách tối đa' : 'Max guests'}
                      value={rm.maxGuests}
                      onChange={(v) =>
                        setRooms((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, maxGuests: Number(v) } : x
                          )
                        )
                      }
                    />
                  </div>

                  <div className="grid gap-2 sm:grid-cols-5">
                    <div>
                      <label className="mb-1 block font-medium text-[#53635D]">7N (VND)</label>
                      <input
                        type="number"
                        step={50000}
                        value={rm.wholesale7Vnd}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, wholesale7Vnd: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full rounded border border-[#E5DFD3] bg-white px-2 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-[#53635D]">14N (VND)</label>
                      <input
                        type="number"
                        step={50000}
                        value={rm.wholesale14Vnd}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, wholesale14Vnd: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full rounded border border-[#E5DFD3] bg-white px-2 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-[#53635D]">21N (VND)</label>
                      <input
                        type="number"
                        step={50000}
                        value={rm.wholesale21Vnd}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, wholesale21Vnd: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full rounded border border-[#E5DFD3] bg-white px-2 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-[#53635D]">30N (VND)</label>
                      <input
                        type="number"
                        step={50000}
                        value={rm.wholesale30Vnd}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, wholesale30Vnd: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full rounded border border-[#E5DFD3] bg-white px-2 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-[#53635D]">
                        {isVi ? 'Đêm lẻ' : 'Extra/nt'}
                      </label>
                      <input
                        type="number"
                        step={10000}
                        value={rm.extraNightVnd}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, extraNightVnd: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full rounded border border-[#E5DFD3] bg-white px-2 py-1.5"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveRoomRates(idx)}
                    className="rounded-lg bg-[#164E3F] px-3 py-1.5 font-semibold text-white hover:bg-[#0F392E]"
                  >
                    {isVi ? 'Lưu giá phòng này' : 'Save room rates'}
                  </button>
                </div>
              ))}

              <div className="rounded-xl border border-dashed border-[#E5DFD3] p-4 space-y-2">
                <div className="font-semibold text-[#17221E]">
                  {isVi ? 'Thêm hạng phòng mới' : 'Add another room type'}
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <input
                    placeholder={isVi ? 'Tên phòng (EN)' : 'Room name (EN)'}
                    value={newRoomNameEn}
                    onChange={(e) => setNewRoomNameEn(e.target.value)}
                    className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                  <input
                    placeholder={isVi ? 'Mô tả ngắn' : 'Short description'}
                    value={newRoomDescEn}
                    onChange={(e) => setNewRoomDescEn(e.target.value)}
                    className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                  <input
                    type="number"
                    placeholder="16000000"
                    value={newRoomMonthlyVnd}
                    onChange={(e) => setNewRoomMonthlyVnd(e.target.value)}
                    className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#164E3F] font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isVi ? 'Thêm phòng' : 'Add room'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'availability' && (
            <div className="space-y-4">
              <ListingSectionTitle>
                {isVi ? '8. Tình trạng hiển thị & Số đêm tối thiểu' : '8. Availability Settings'}
              </ListingSectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <ListingSelect
                  label={isVi ? 'Trạng thái' : 'Listing visibility'}
                  value={status}
                  disabled={status === 'pending_review' || status === 'draft'}
                  onChange={setStatus}
                  options={[
                    ...(status === 'draft'
                      ? [{ value: 'draft', label: isVi ? 'Bản nháp' : 'Draft' }]
                      : []),
                    ...(status === 'pending_review'
                      ? [{ value: 'pending_review', label: 'Pending review' }]
                      : []),
                    { value: 'live', label: 'Live' },
                    { value: 'paused', label: 'Paused' },
                  ]}
                />
                <ListingInput
                  type="number"
                  min={7}
                  max={90}
                  label={
                    isVi
                      ? 'Số đêm tối thiểu mặc định (tối thiểu 7)'
                      : 'Default minimum nights (min 7)'
                  }
                  value={defaultMinNights}
                  onChange={setDefaultMinNights}
                />
              </div>
              <Link
                href="/host/calendar"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#164E3F] px-3.5 py-2 font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
              >
                {isVi ? 'Mở Lịch & Đồng bộ iCal →' : 'Open Calendar & iCal Sync →'}
              </Link>
            </div>
          )}

          {activeSection === 'rules' && (
            <div className="space-y-4">
              <ListingSectionTitle>
                {isVi ? '9. Nội quy & Giờ nhận/trả phòng' : '9. House Rules'}
              </ListingSectionTitle>
              <div className="grid gap-4 sm:grid-cols-3">
                <ListingInput
                  label={isVi ? 'Nhận phòng từ' : 'Check-in from'}
                  value={checkinFrom}
                  onChange={setCheckinFrom}
                />
                <ListingInput
                  label={isVi ? 'Trả phòng trước' : 'Check-out before'}
                  value={checkoutBefore}
                  onChange={setCheckoutBefore}
                />
                <ListingInput
                  label={isVi ? 'Giờ yên tĩnh' : 'Quiet hours'}
                  value={quietHours}
                  onChange={setQuietHours}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <ListingCheckboxCard
                  label={isVi ? 'Cho phép hút thuốc' : 'Smoking allowed'}
                  checked={smokingAllowed}
                  onChange={setSmokingAllowed}
                />
                <ListingCheckboxCard
                  label={isVi ? 'Cho phép tổ chức tiệc nhỏ' : 'Parties / small events allowed'}
                  checked={partiesAllowed}
                  onChange={setPartiesAllowed}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ListingInput
                  label={isVi ? 'Lưu ý thú cưng' : 'Pets note'}
                  value={petsNote}
                  onChange={setPetsNote}
                />
                <ListingInput
                  label={isVi ? 'Lưu ý khách thêm' : 'Extra guest note'}
                  value={extraGuestNote}
                  onChange={setExtraGuestNote}
                />
              </div>
            </div>
          )}

          {activeSection === 'policies' && (
            <div className="space-y-4">
              <ListingSectionTitle>
                {isVi ? '10. Chính sách đặt phòng & Hủy' : '10. Booking & Cancellation Policies'}
              </ListingSectionTitle>
              <label className="flex items-start gap-3 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4">
                <input
                  type="checkbox"
                  checked={isInstantBook}
                  onChange={(e) => setIsInstantBook(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-semibold text-[#17221E]">Instant Book</div>
                  <p className="mt-0.5 text-[#53635D]">
                    {isVi
                      ? 'Khi tắt, các đơn mới sẽ vào trạng thái Chờ chủ nhà duyệt (tối đa 24h) thay vì khóa phòng tự động.'
                      : 'When disabled, new bookings enter Pending Host Approval after checkout until you approve or decline.'}
                  </p>
                </div>
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(['flexible', 'moderate', 'strict'] as const).map((pol) => (
                  <button
                    key={pol}
                    type="button"
                    onClick={() => setCancellationPolicy(pol)}
                    className={`rounded-xl border p-3 text-left ${
                      cancellationPolicy === pol
                        ? 'border-[#164E3F] bg-[#E7F1EC] font-semibold text-[#164E3F]'
                        : 'border-[#E5DFD3] bg-white text-[#53635D]'
                    }`}
                  >
                    {formatCancellationPolicyLabel(pol, locale)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'preview' && (
            <div className="space-y-4">
              <ListingSectionTitle>
                {isVi ? '11. Xem trước hiển thị' : '11. Listing Preview'}
              </ListingSectionTitle>
              <div className="max-w-sm overflow-hidden rounded-xl border border-[#E5DFD3] bg-white">
                <img src={heroImage} alt="" className="aspect-[16/10] w-full object-cover" />
                <div className="p-4">
                  <div className="text-[11px] font-medium text-[#53635D]">
                    {isVi ? neighborhoodVi : neighborhoodEn} ·{' '}
                    {formatPropertyTypeLabel(propertyType, locale)}
                  </div>
                  <div className="mt-1 text-base font-semibold text-[#17221E]">
                    {isVi ? titleVi : titleEn}
                  </div>
                  <p className="mt-1 text-[#53635D]">{isVi ? subtitleVi : subtitleEn}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-[#E5DFD3] pt-3">
                    <span className="font-semibold text-[#164E3F]">
                      {rooms[0]?.wholesale7Vnd
                        ? `${formatVndExact(Math.round(rooms[0].wholesale7Vnd / 7))} / ${isVi ? 'đêm' : 'nt'}`
                        : '—'}
                    </span>
                    <span className="text-[11px] text-[#53635D]">
                      {checkinFrom} – {checkoutBefore}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
