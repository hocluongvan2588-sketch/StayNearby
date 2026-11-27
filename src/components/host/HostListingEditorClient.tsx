'use client';

import Link from 'next/link';
import { useState } from 'react';
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
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  formatCancellationPolicyLabel,
  formatPropertyTypeLabel,
  formatVndExact,
} from '@/lib/i18n';
import { clampHostMinNights, POLICY_MIN_NIGHTS } from '@/lib/business-rules';
import { usePreferences } from '@/components/PreferencesProvider';
import type { HostStayRoomItem, HostStaySummary } from '@/modules/host';

const SECTION_DEFS = [
  { key: 'basic', en: '1. Basic Information', vi: '1. Thông tin cơ bản', icon: FileText },
  { key: 'photos', en: '2. Photos & Videos', vi: '2. Hình ảnh & Video', icon: Camera },
  { key: 'amenities', en: '3. Amenities', vi: '3. Tiện nghi chỗ ở', icon: Sparkles },
  { key: 'workspace', en: '4. Workspace', vi: '4. Góc làm việc (Tùy chọn)', icon: Laptop },
  { key: 'location', en: '5. Location', vi: '5. Vị trí & Địa chỉ', icon: MapPin },
  { key: 'pricing', en: '6. Pricing', vi: '6. Bảng giá & Gói dài ngày', icon: DollarSign },
  { key: 'availability', en: '7. Availability', vi: '7. Tình trạng & Lịch mở bán', icon: CalendarClock },
  { key: 'rules', en: '8. House Rules', vi: '8. Nội quy chỗ ở', icon: ClipboardList },
  { key: 'policies', en: '9. Booking & Policies', vi: '9. Chính sách đặt & Hủy', icon: ShieldCheck },
  { key: 'preview', en: '10. Preview', vi: '10. Xem trước hiển thị', icon: Eye },
] as const;

type SectionKey = (typeof SECTION_DEFS)[number]['key'];

export function HostListingEditorClient({
  initialStay,
}: {
  initialStay: HostStaySummary;
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

  // 5. Location
  const [neighborhoodEn, setNeighborhoodEn] = useState(stay.neighborhoodEn);
  const [neighborhoodVi, setNeighborhoodVi] = useState(stay.neighborhoodVi);
  const [exactAddress, setExactAddress] = useState(stay.exactAddress);
  const [checkinInstructionsEn, setCheckinInstructionsEn] = useState(
    stay.checkinInstructionsEn
  );
  const [checkinInstructionsVi, setCheckinInstructionsVi] = useState(
    stay.checkinInstructionsVi
  );

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
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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
          workspaceSummaryEn,
          workspaceSummaryVi,
          neighborhoodEn,
          neighborhoodVi,
          exactAddress,
          checkinInstructionsEn,
          checkinInstructionsVi,
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
      setNotice(isVi ? 'Đã lưu toàn bộ cấu hình chỗ ở.' : 'Saved listing configuration.');
    } finally {
      setSaving(false);
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
          <Link
            href={`/stays/${stay.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
          >
            <ExternalLink className="h-3.5 w-3.5 text-[#53635D]" />
            {isVi ? 'Xem trang khách' : 'Public view'}
          </Link>
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
              <h2 className="text-base font-semibold text-[#17221E]">
                {isVi ? '1. Thông tin cơ bản' : '1. Basic Information'}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">Title (EN)</label>
                  <input
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">Tiêu đề (VI)</label>
                  <input
                    value={titleVi}
                    onChange={(e) => setTitleVi(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">Subtitle (EN)</label>
                  <input
                    value={subtitleEn}
                    onChange={(e) => setSubtitleEn(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">Phụ đề (VI)</label>
                  <input
                    value={subtitleVi}
                    onChange={(e) => setSubtitleVi(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Loại hình chỗ ở' : 'Property type'}
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) =>
                      setPropertyType(e.target.value as HostStaySummary['propertyType'])
                    }
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  >
                    <option value="apartment">Serviced Apartment</option>
                    <option value="coliving">Coliving House</option>
                    <option value="boutique_hotel">Boutique Hotel</option>
                    <option value="villa">Villa</option>
                    <option value="eco_lodge">Eco Lodge</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">Description (EN)</label>
                <textarea
                  rows={4}
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">Mô tả (VI)</label>
                <textarea
                  rows={4}
                  value={descriptionVi}
                  onChange={(e) => setDescriptionVi(e.target.value)}
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                />
              </div>
            </div>
          )}

          {activeSection === 'photos' && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-[#17221E]">
                {isVi ? '2. Hình ảnh & Bộ sưu tập' : '2. Photos & Media'}
              </h2>
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

              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'URL ảnh góc làm việc (tùy chọn)' : 'Workspace photo URL (optional)'}
                </label>
                <input
                  value={workspacePhotoUrl}
                  onChange={(e) => setWorkspacePhotoUrl(e.target.value)}
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                />
              </div>
            </div>
          )}

          {activeSection === 'amenities' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#17221E]">
                {isVi ? '3. Tiện nghi chỗ ở' : '3. Amenities'}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Khu vực bếp' : 'Kitchen'}
                  </label>
                  <select
                    value={kitchenType}
                    onChange={(e) =>
                      setKitchenType(e.target.value as HostStaySummary['kitchenType'])
                    }
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  >
                    <option value="full">Full kitchen</option>
                    <option value="kitchenette">Kitchenette</option>
                    <option value="shared">Shared kitchen</option>
                    <option value="none">No kitchen</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Giặt sấy' : 'Laundry'}
                  </label>
                  <select
                    value={laundryType}
                    onChange={(e) =>
                      setLaundryType(e.target.value as HostStaySummary['laundryType'])
                    }
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  >
                    <option value="in_unit">In-unit</option>
                    <option value="building">Building laundry</option>
                    <option value="service">Laundry service</option>
                    <option value="none">None</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={petFriendly}
                    onChange={(e) => setPetFriendly(e.target.checked)}
                  />
                  {isVi ? 'Thân thiện với thú cưng' : 'Pet friendly'}
                </label>
                <label className="flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={wheelchairFriendly}
                    onChange={(e) => setWheelchairFriendly(e.target.checked)}
                  />
                  {isVi ? 'Hỗ trợ xe lăn' : 'Wheelchair accessible'}
                </label>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[#17221E]">
                  {isVi ? 'Danh sách tiện nghi (mỗi dòng 1 mục)' : 'Amenities list (one per line)'}
                </label>
                <textarea
                  rows={6}
                  value={amenitiesText}
                  onChange={(e) => setAmenitiesText(e.target.value)}
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                />
              </div>
            </div>
          )}

          {activeSection === 'workspace' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#17221E]">
                {isVi ? '4. Góc làm việc & Wi-Fi (Tùy chọn)' : '4. Workspace (Optional)'}
              </h2>
              <p className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] p-3 text-[#53635D]">
                {isVi
                  ? 'Các tiện ích làm việc từ xa là tùy chọn và không ảnh hưởng tới điều kiện đăng phòng.'
                  : 'All workspace fields are optional and never block publishing.'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-[#E5DFD3] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={hasWorkspace}
                    onChange={(e) => setHasWorkspace(e.target.checked)}
                  />
                  {isVi ? 'Bàn làm việc riêng' : 'Dedicated desk'}
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[#E5DFD3] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={hasErgonomicChair}
                    onChange={(e) => setHasErgonomicChair(e.target.checked)}
                  />
                  {isVi ? 'Ghế công thái học' : 'Ergonomic chair'}
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[#E5DFD3] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={hasExternalMonitor}
                    onChange={(e) => setHasExternalMonitor(e.target.checked)}
                  />
                  {isVi ? 'Màn hình rời' : 'External monitor'}
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[#E5DFD3] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={hasCallBooth}
                    onChange={(e) => setHasCallBooth(e.target.checked)}
                  />
                  {isVi ? 'Khu vực gọi video yên tĩnh' : 'Quiet call booth'}
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    Workspace summary (EN)
                  </label>
                  <textarea
                    rows={3}
                    value={workspaceSummaryEn}
                    onChange={(e) => setWorkspaceSummaryEn(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    Mô tả không gian làm việc (VI)
                  </label>
                  <textarea
                    rows={3}
                    value={workspaceSummaryVi}
                    onChange={(e) => setWorkspaceSummaryVi(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'location' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#17221E]">
                {isVi ? '5. Vị trí & Hướng dẫn nhận phòng' : '5. Location & Check-in Details'}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    Neighborhood (EN)
                  </label>
                  <input
                    value={neighborhoodEn}
                    onChange={(e) => setNeighborhoodEn(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    Khu vực (VI)
                  </label>
                  <input
                    value={neighborhoodVi}
                    onChange={(e) => setNeighborhoodVi(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Địa chỉ chính xác (chỉ gửi khách sau khi xác nhận đặt phòng)' : 'Exact address (shared after booking confirmation)'}
                  </label>
                  <input
                    value={exactAddress}
                    onChange={(e) => setExactAddress(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    Check-in instructions (EN)
                  </label>
                  <textarea
                    rows={3}
                    value={checkinInstructionsEn}
                    onChange={(e) => setCheckinInstructionsEn(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    Hướng dẫn nhận phòng (VI)
                  </label>
                  <textarea
                    rows={3}
                    value={checkinInstructionsVi}
                    onChange={(e) => setCheckinInstructionsVi(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'pricing' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-[#17221E]">
                    {isVi ? '6. Phòng & Bảng giá gói 7/14/21/30 đêm' : '6. Rooms & Package Rates'}
                  </h2>
                  <p className="text-[#53635D]">
                    {isVi
                      ? `${hostCommissionPct}% hoa hồng chủ nhà. Bạn nhận đủ 100% các mức giá nhập dưới đây.`
                      : `${hostCommissionPct}% host commission. You receive 100% of these rates.`}
                  </p>
                </div>
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
                    <div>
                      <label className="mb-1 block font-semibold text-[#17221E]">
                        {isVi ? 'Tên phòng (EN)' : 'Room name (EN)'}
                      </label>
                      <input
                        value={rm.nameEn}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, nameEn: e.target.value } : x))
                          )
                        }
                        className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-[#17221E]">
                        {isVi ? 'Số lượng căn/phòng' : 'Total units'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={rm.unitsTotal}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, unitsTotal: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-semibold text-[#17221E]">
                        {isVi ? 'Số khách tối đa' : 'Max guests'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={rm.maxGuests}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((x, i) =>
                              i === idx ? { ...x, maxGuests: Number(e.target.value) } : x
                            )
                          )
                        }
                        className="w-full rounded-lg border border-[#E5DFD3] bg-white px-3 py-2"
                      />
                    </div>
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
              <h2 className="text-base font-semibold text-[#17221E]">
                {isVi ? '7. Tình trạng hiển thị & Số đêm tối thiểu' : '7. Availability Settings'}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Trạng thái' : 'Listing visibility'}
                  </label>
                  <select
                    value={status}
                    disabled={status === 'pending_review'}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 disabled:opacity-60"
                  >
                    {status === 'pending_review' && (
                      <option value="pending_review">Pending review</option>
                    )}
                    <option value="live">Live</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Số đêm tối thiểu mặc định (tối thiểu 7)' : 'Default minimum nights (min 7)'}
                  </label>
                  <input
                    type="number"
                    min={7}
                    max={90}
                    value={defaultMinNights}
                    onChange={(e) => setDefaultMinNights(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
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
              <h2 className="text-base font-semibold text-[#17221E]">
                {isVi ? '8. Nội quy & Giờ nhận/trả phòng' : '8. House Rules'}
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Nhận phòng từ' : 'Check-in from'}
                  </label>
                  <input
                    value={checkinFrom}
                    onChange={(e) => setCheckinFrom(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Trả phòng trước' : 'Check-out before'}
                  </label>
                  <input
                    value={checkoutBefore}
                    onChange={(e) => setCheckoutBefore(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Giờ yên tĩnh' : 'Quiet hours'}
                  </label>
                  <input
                    value={quietHours}
                    onChange={(e) => setQuietHours(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-lg border border-[#E5DFD3] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={smokingAllowed}
                    onChange={(e) => setSmokingAllowed(e.target.checked)}
                  />
                  {isVi ? 'Cho phép hút thuốc' : 'Smoking allowed'}
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[#E5DFD3] px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={partiesAllowed}
                    onChange={(e) => setPartiesAllowed(e.target.checked)}
                  />
                  {isVi ? 'Cho phép tổ chức tiệc nhỏ' : 'Parties / small events allowed'}
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Lưu ý thú cưng' : 'Pets note'}
                  </label>
                  <input
                    value={petsNote}
                    onChange={(e) => setPetsNote(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-[#17221E]">
                    {isVi ? 'Lưu ý khách thêm' : 'Extra guest note'}
                  </label>
                  <input
                    value={extraGuestNote}
                    onChange={(e) => setExtraGuestNote(e.target.value)}
                    className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2"
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'policies' && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[#17221E]">
                {isVi ? '9. Chính sách đặt phòng & Hủy' : '9. Booking & Cancellation Policies'}
              </h2>
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
              <h2 className="text-base font-semibold text-[#17221E]">
                {isVi ? '10. Xem trước hiển thị' : '10. Listing Preview'}
              </h2>
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
