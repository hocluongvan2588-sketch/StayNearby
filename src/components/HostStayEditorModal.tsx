'use client';

import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BedDouble,
  CheckCircle2,
  ImagePlus,
  Laptop,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { formatVndExact } from '@/lib/i18n';
import type { HostCoworkingSpot, HostStayRoomItem } from '@/modules/host';

export interface HostEditableStay {
  id: string;
  slug: string;
  titleEn: string;
  titleVi: string;
  subtitleEn: string;
  subtitleVi: string;
  descriptionEn: string;
  descriptionVi: string;
  neighborhoodEn: string;
  neighborhoodVi: string;
  exactAddress: string;
  checkinInstructionsEn: string;
  checkinInstructionsVi: string;
  propertyType: 'apartment' | 'coliving' | 'boutique_hotel' | 'villa' | 'eco_lodge';
  businessModel: 'booking_flow' | 'stay_direct';
  cancellationPolicy: 'flexible' | 'moderate' | 'strict';
  isInstantBook: boolean;
  workspaceSummaryEn: string;
  workspaceSummaryVi: string;
  workspacePhotoUrl: string;
  hasErgonomicChair: boolean;
  hasExternalMonitor: boolean;
  hasCallBooth: boolean;
  kitchenType: 'full' | 'kitchenette' | 'shared';
  laundryType: 'in_unit' | 'building' | 'service';
  petFriendly: boolean;
  wheelchairFriendly: boolean;
  heroImage: string;
  galleryImages: string[];
  amenities: string[];
  nearbyCoworking: HostCoworkingSpot[];
  rooms: HostStayRoomItem[];
  wholesale7Vnd: number;
  wholesale14Vnd: number;
  wholesale21Vnd: number;
  wholesale30Vnd: number;
  extraNightVnd: number;
}

export function HostStayEditorModal({
  stay,
  isVi,
  supabaseConfigured,
  storageBucket,
  onClose,
  onUpdated,
}: {
  stay: HostEditableStay;
  isVi: boolean;
  supabaseConfigured: boolean;
  storageBucket: string;
  onClose: () => void;
  onUpdated: (feedback: string) => void;
}) {
  const [tab, setTab] = useState<'photos' | 'details' | 'rooms'>('photos');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Tab 1: Photos state
  const [heroImage, setHeroImage] = useState(stay.heroImage);
  const [workspacePhotoUrl, setWorkspacePhotoUrl] = useState(stay.workspacePhotoUrl);
  const [galleryImages, setGalleryImages] = useState<string[]>(
    stay.galleryImages.length > 0 ? stay.galleryImages : [stay.heroImage]
  );
  const [externalImageUrl, setExternalImageUrl] = useState('');

  // Tab 2: Details state
  const [titleVi, setTitleVi] = useState(stay.titleVi);
  const [titleEn, setTitleEn] = useState(stay.titleEn);
  const [subtitleVi, setSubtitleVi] = useState(stay.subtitleVi);
  const [subtitleEn, setSubtitleEn] = useState(stay.subtitleEn);
  const [descriptionVi, setDescriptionVi] = useState(stay.descriptionVi);
  const [descriptionEn, setDescriptionEn] = useState(stay.descriptionEn);
  const [neighborhoodVi, setNeighborhoodVi] = useState(stay.neighborhoodVi);
  const [neighborhoodEn, setNeighborhoodEn] = useState(stay.neighborhoodEn);
  const [exactAddress, setExactAddress] = useState(stay.exactAddress);
  const [checkinInstructionsVi, setCheckinInstructionsVi] = useState(stay.checkinInstructionsVi);
  const [checkinInstructionsEn, setCheckinInstructionsEn] = useState(stay.checkinInstructionsEn);
  const [propertyType, setPropertyType] = useState(stay.propertyType);
  const [cancellationPolicy, setCancellationPolicy] = useState(stay.cancellationPolicy);
  const [isInstantBook, setIsInstantBook] = useState(stay.isInstantBook);
  const [workspaceSummaryVi, setWorkspaceSummaryVi] = useState(stay.workspaceSummaryVi);
  const [workspaceSummaryEn, setWorkspaceSummaryEn] = useState(stay.workspaceSummaryEn);
  const [hasErgonomicChair, setHasErgonomicChair] = useState(stay.hasErgonomicChair);
  const [hasExternalMonitor, setHasExternalMonitor] = useState(stay.hasExternalMonitor);
  const [hasCallBooth, setHasCallBooth] = useState(stay.hasCallBooth);
  const [kitchenType, setKitchenType] = useState(stay.kitchenType);
  const [laundryType, setLaundryType] = useState(stay.laundryType);
  const [petFriendly, setPetFriendly] = useState(stay.petFriendly);
  const [wheelchairFriendly, setWheelchairFriendly] = useState(stay.wheelchairFriendly);
  const [amenities, setAmenities] = useState<string[]>(stay.amenities);
  const [newAmenity, setNewAmenity] = useState('');
  const [nearbyCoworking, setNearbyCoworking] = useState<HostCoworkingSpot[]>(stay.nearbyCoworking);

  // Tab 3: Rooms state
  const [rooms, setRooms] = useState<HostStayRoomItem[]>(stay.rooms);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomNameVi, setNewRoomNameVi] = useState('');
  const [newRoomNameEn, setNewRoomNameEn] = useState('');
  const [newRoomDescVi, setNewRoomDescVi] = useState('');
  const [newRoomDescEn, setNewRoomDescEn] = useState('');
  const [newRoomGuests, setNewRoomGuests] = useState(2);
  const [newRoomBeds, setNewRoomBeds] = useState(1);
  const [newRoomUnits, setNewRoomUnits] = useState(2);
  const [newRoomW7, setNewRoomW7] = useState(stay.wholesale7Vnd || 6_000_000);
  const [newRoomW30, setNewRoomW30] = useState(stay.wholesale30Vnd || 21_500_000);

  async function uploadFiles(
    fileList: FileList | File[],
    role: 'hero' | 'workspace' | 'gallery' | 'room' = 'gallery',
    roomId?: string
  ) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const fd = new FormData();
      fd.set('role', role);
      if (roomId) fd.set('roomId', roomId);
      for (const f of files.slice(0, 8)) {
        fd.append('files', f);
      }

      const res = await fetch(`/api/host/stays/${stay.id}/media`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(
          json.error?.message ?? (isVi ? 'Tải ảnh thất bại.' : 'Photo upload failed.')
        );
        return;
      }

      const urls: string[] = (json.uploaded ?? []).map((u: { url: string }) => u.url);
      if (urls.length > 0) {
        if (role === 'hero') {
          setHeroImage(urls[0]!);
          setGalleryImages((prev) => Array.from(new Set([...urls, ...prev])));
        } else if (role === 'workspace') {
          setWorkspacePhotoUrl(urls[0]!);
          setGalleryImages((prev) => Array.from(new Set([...prev, ...urls])));
        } else if (role === 'room' && roomId) {
          setRooms((prev) =>
            prev.map((r) => (r.id === roomId ? { ...r, roomImage: urls[0]! } : r))
          );
          setGalleryImages((prev) => Array.from(new Set([...prev, ...urls])));
        } else {
          setGalleryImages((prev) => Array.from(new Set([...prev, ...urls])));
        }
        setStatusMsg(
          isVi
            ? `Đã tải lên ${urls.length} ảnh thành công.`
            : `Uploaded ${urls.length} photo(s) successfully.`
        );
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleRemovePhoto(url: string) {
    if (galleryImages.length <= 1) {
      setErrorMsg(
        isVi
          ? 'Chỗ ở phải giữ ít nhất 1 ảnh đang hoạt động.'
          : 'A listing must retain at least 1 active photo.'
      );
      return;
    }
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stay.id}/media`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? (isVi ? 'Không thể xóa ảnh.' : 'Could not delete photo.'));
        return;
      }
      setHeroImage(json.heroImage);
      setWorkspacePhotoUrl(json.workspacePhotoUrl);
      setGalleryImages(json.galleryImages);
      setStatusMsg(isVi ? 'Đã gỡ ảnh khỏi thư viện.' : 'Removed photo from gallery.');
    } finally {
      setSaving(false);
    }
  }

  function handleMovePhoto(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= galleryImages.length) return;
    const copy = [...galleryImages];
    const [picked] = copy.splice(index, 1);
    copy.splice(target, 0, picked!);
    setGalleryImages(copy);
  }

  function handleAddExternalUrl() {
    const url = externalImageUrl.trim();
    if (!url.startsWith('https://') && !url.startsWith('/images/')) {
      setErrorMsg(
        isVi ? 'Vui lòng nhập đường dẫn bắt đầu bằng https://' : 'Enter a valid https:// image URL.'
      );
      return;
    }
    setGalleryImages((prev) => Array.from(new Set([...prev, url])));
    setExternalImageUrl('');
    setErrorMsg('');
  }

  async function handleSavePhotos() {
    setSaving(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heroImage,
          workspacePhotoUrl,
          galleryImages,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? (isVi ? 'Không thể lưu ảnh.' : 'Could not save photos.'));
      } else {
        const msg = isVi
          ? 'Đã lưu thứ tự ảnh, ảnh bìa và ảnh góc làm việc.'
          : 'Saved cover photo, workspace photo, and gallery order.';
        setStatusMsg(msg);
        onUpdated(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stay.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleVi,
          titleEn,
          subtitleVi,
          subtitleEn,
          descriptionVi,
          descriptionEn,
          neighborhoodVi,
          neighborhoodEn,
          exactAddress,
          checkinInstructionsVi,
          checkinInstructionsEn,
          propertyType,
          cancellationPolicy,
          isInstantBook,
          workspaceSummaryVi,
          workspaceSummaryEn,
          hasErgonomicChair,
          hasExternalMonitor,
          hasCallBooth,
          kitchenType,
          laundryType,
          petFriendly,
          wheelchairFriendly,
          amenities,
          nearbyCoworking,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(
          json.error?.message ?? (isVi ? 'Không thể cập nhật thông tin.' : 'Could not update details.')
        );
      } else {
        const msg = isVi
          ? 'Đã cập nhật đầy đủ thông tin, hướng dẫn nhận phòng và tiện ích.'
          : 'Updated stay description, check-in details, and workspace amenities.';
        setStatusMsg(msg);
        onUpdated(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRoom(room: HostStayRoomItem) {
    setSaving(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stay.id}/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameEn: room.nameEn,
          nameVi: room.nameVi,
          descriptionEn: room.descriptionEn,
          descriptionVi: room.descriptionVi,
          maxGuests: Number(room.maxGuests),
          bedsCount: Number(room.bedsCount),
          unitsTotal: Number(room.unitsTotal),
          roomImage: room.roomImage,
          roomFeatures: room.roomFeatures,
          wholesale7Vnd: Number(room.wholesale7Vnd),
          wholesale14Vnd: Number(room.wholesale14Vnd),
          wholesale21Vnd: Number(room.wholesale21Vnd),
          wholesale30Vnd: Number(room.wholesale30Vnd),
          extraNightVnd: Number(room.extraNightVnd),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? (isVi ? 'Không thể lưu phòng.' : 'Could not update room.'));
      } else {
        const msg = isVi
          ? `Đã lưu thông tin và giá cho phòng ${room.nameVi}.`
          : `Saved room ${room.nameEn} details and rates.`;
        setStatusMsg(msg);
        onUpdated(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoomNameEn.trim() && !newRoomNameVi.trim()) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const nameEn = newRoomNameEn.trim() || newRoomNameVi.trim();
      const nameVi = newRoomNameVi.trim() || newRoomNameEn.trim();
      const descEn = newRoomDescEn.trim() || newRoomDescVi.trim() || 'Private long-stay unit with desk and kitchen.';
      const descVi = newRoomDescVi.trim() || newRoomDescEn.trim() || 'Phòng riêng lưu trú dài ngày có bàn làm việc và bếp.';
      const w7 = Math.max(500_000, Number(newRoomW7));
      const w30 = Math.max(1_000_000, Number(newRoomW30));
      const res = await fetch(`/api/host/stays/${stay.id}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameEn,
          nameVi,
          descriptionEn: descEn,
          descriptionVi: descVi,
          maxGuests: Number(newRoomGuests),
          bedsCount: Number(newRoomBeds),
          unitsTotal: Number(newRoomUnits),
          roomImage: heroImage,
          roomFeatures: ['Dedicated desk', 'Fiber Wi-Fi'],
          wholesale7Vnd: w7,
          wholesale14Vnd: Math.round(w7 * 1.9),
          wholesale21Vnd: Math.round(w7 * 2.75),
          wholesale30Vnd: w30,
          extraNightVnd: Math.round(w30 / 30),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? (isVi ? 'Không thể thêm phòng mới.' : 'Could not add room.'));
      } else {
        setRooms((prev) => [
          ...prev,
          {
            id: json.roomId,
            stayId: stay.id,
            nameEn,
            nameVi,
            descriptionEn: descEn,
            descriptionVi: descVi,
            maxGuests: Number(newRoomGuests),
            bedsCount: Number(newRoomBeds),
            unitsTotal: Number(newRoomUnits),
            roomImage: heroImage,
            roomFeatures: ['Dedicated desk', 'Fiber Wi-Fi'],
            icalUrl: '',
            icalLastSyncedAt: null,
            icalSyncStatus: 'idle',
            packageId: json.packageId,
            wholesale7Vnd: w7,
            wholesale14Vnd: Math.round(w7 * 1.9),
            wholesale21Vnd: Math.round(w7 * 2.75),
            wholesale30Vnd: w30,
            extraNightVnd: Math.round(w30 / 30),
          },
        ]);
        setShowAddRoom(false);
        setNewRoomNameVi('');
        setNewRoomNameEn('');
        setNewRoomDescVi('');
        setNewRoomDescEn('');
        setStatusMsg(isVi ? `Đã thêm phòng ${nameVi}.` : `Added room ${nameEn}.`);
        onUpdated(isVi ? `Đã thêm phòng ${nameVi}.` : `Added room ${nameEn}.`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRoom(roomId: string) {
    setSaving(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stay.id}/rooms/${roomId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? (isVi ? 'Không thể xóa phòng.' : 'Could not delete room.'));
      } else {
        setRooms((prev) => prev.filter((r) => r.id !== roomId));
        setStatusMsg(isVi ? 'Đã xóa loại phòng.' : 'Room removed.');
        onUpdated(isVi ? 'Đã xóa loại phòng.' : 'Room removed.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[#E5DFD3] bg-[#FAF8F3] shadow-2xl">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DFD3] bg-white px-5 py-4 sm:px-7">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#164E3F]">
              {isVi ? 'Studio quản lý chỗ ở' : 'Host Listing Studio'}
            </span>
            <h2 className="font-serif-display text-xl font-semibold text-[#17221E] sm:text-2xl">
              {isVi ? stay.titleVi : stay.titleEn}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-[#E7F1EC] px-3 py-1 text-[11px] font-semibold text-[#164E3F] sm:inline-block">
              {supabaseConfigured
                ? `Supabase Storage (${storageBucket})`
                : isVi
                  ? 'Lưu ảnh nội bộ (/api/uploads)'
                  : 'Local Media Storage (/api/uploads)'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#E5DFD3] p-2 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-[#E5DFD3] bg-white px-5 pt-2 sm:px-7">
          {(
            [
              {
                id: 'photos',
                icon: ImagePlus,
                label: isVi ? `Ảnh & Góc làm việc (${galleryImages.length})` : `Photos & Desk (${galleryImages.length})`,
              },
              {
                id: 'details',
                icon: Laptop,
                label: isVi ? 'Thông tin & Tiện ích' : 'Details & Amenities',
              },
              {
                id: 'rooms',
                icon: BedDouble,
                label: isVi ? `Phòng & Tồn kho (${rooms.length})` : `Rooms & Units (${rooms.length})`,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setErrorMsg('');
                  setStatusMsg('');
                }}
                className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition sm:text-sm ${
                  active
                    ? 'border-[#164E3F] text-[#164E3F]'
                    : 'border-transparent text-[#53635D] hover:text-[#17221E]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-7">
          {statusMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-3 text-xs font-semibold text-[#164E3F]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
              {errorMsg}
            </div>
          )}

          {/* TAB 1: PHOTOS */}
          {tab === 'photos' && (
            <div className="space-y-6">
              {/* Upload dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files?.length) {
                    uploadFiles(e.dataTransfer.files, 'gallery');
                  }
                }}
                className={`flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-7 text-center transition ${
                  dragActive
                    ? 'border-[#164E3F] bg-[#E7F1EC]/50'
                    : 'border-[#D8D0C2] bg-white'
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E7F1EC] text-[#164E3F]">
                  {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#17221E]">
                    {isVi
                      ? 'Kéo thả hoặc tải nhiều ảnh chất lượng cao (JPEG, PNG, WebP tối đa 10 MB/ảnh)'
                      : 'Drag and drop or select high-resolution photos (JPEG, PNG, WebP up to 10 MB each)'}
                  </p>
                  <p className="text-xs text-[#53635D]">
                    {isVi
                      ? 'Nên có tối thiểu 5 ảnh: phòng khách, phòng ngủ, bếp, phòng tắm và góc bàn làm việc.'
                      : 'Aim for at least 5 photos: living area, bedroom, kitchen, bathroom, and dedicated desk.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <label className="cursor-pointer rounded-xl bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F392E]">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          uploadFiles(e.target.files, 'gallery');
                          e.target.value = '';
                        }
                      }}
                    />
                    {uploading
                      ? isVi
                        ? 'Đang tải ảnh lên...'
                        : 'Uploading...'
                      : isVi
                        ? 'Chọn ảnh từ thiết bị'
                        : 'Upload from device'}
                  </label>
                  <label className="cursor-pointer rounded-xl border border-[#164E3F]/30 bg-white px-4 py-2 text-xs font-semibold text-[#164E3F] hover:bg-[#FAF8F3]">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) {
                          uploadFiles(e.target.files, 'workspace');
                          e.target.value = '';
                        }
                      }}
                    />
                    {isVi ? 'Tải riêng ảnh bàn làm việc' : 'Upload desk photo'}
                  </label>
                </div>

                {/* Add external URL */}
                <div className="mt-2 flex w-full max-w-lg gap-2">
                  <input
                    type="text"
                    value={externalImageUrl}
                    onChange={(e) => setExternalImageUrl(e.target.value)}
                    placeholder="https://images.example.com/your-stay-photo.jpg"
                    className="flex-1 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddExternalUrl}
                    className="rounded-xl border border-[#E5DFD3] bg-white px-3 py-2 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
                  >
                    {isVi ? 'Thêm link ảnh' : 'Add URL'}
                  </button>
                </div>
              </div>

              {/* Photo Gallery Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {galleryImages.map((url, idx) => {
                  const isHero = url === heroImage;
                  const isWorkspace = url === workspacePhotoUrl;
                  return (
                    <div
                      key={`${url}-${idx}`}
                      className={`overflow-hidden rounded-2xl border bg-white ${
                        isHero ? 'border-[#164E3F] ring-2 ring-[#164E3F]/20' : 'border-[#E5DFD3]'
                      }`}
                    >
                      <div className="relative aspect-[16/10] w-full bg-[#EFEAE0]">
                        <img
                          src={url}
                          alt={`Stay photo ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white">
                            #{idx + 1}
                          </span>
                          {isHero && (
                            <span className="rounded-full bg-[#164E3F] px-2.5 py-0.5 text-[10px] font-bold text-white">
                              {isVi ? 'Ảnh bìa chính' : 'Cover Photo'}
                            </span>
                          )}
                          {isWorkspace && (
                            <span className="rounded-full bg-[#C25E28] px-2.5 py-0.5 text-[10px] font-bold text-white">
                              {isVi ? 'Góc làm việc' : 'Workspace'}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2 p-3">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setHeroImage(url)}
                            disabled={isHero}
                            className="rounded-lg border border-[#E5DFD3] px-2.5 py-1 text-[11px] font-semibold text-[#164E3F] hover:bg-[#E7F1EC] disabled:opacity-45"
                          >
                            {isVi ? 'Đặt làm ảnh bìa' : 'Set cover'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setWorkspacePhotoUrl(url)}
                            disabled={isWorkspace}
                            className="rounded-lg border border-[#E5DFD3] px-2.5 py-1 text-[11px] font-semibold text-[#C25E28] hover:bg-[#FAEDE5] disabled:opacity-45"
                          >
                            {isVi ? 'Góc làm việc' : 'Set desk'}
                          </button>
                        </div>

                        <div className="flex items-center justify-between border-t border-[#F0EBE0] pt-2">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleMovePhoto(idx, -1)}
                              disabled={idx === 0}
                              className="rounded-lg border border-[#E5DFD3] p-1 text-[#53635D] disabled:opacity-35"
                              title={isVi ? 'Di chuyển lên trước' : 'Move left'}
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePhoto(idx, 1)}
                              disabled={idx === galleryImages.length - 1}
                              className="rounded-lg border border-[#E5DFD3] p-1 text-[#53635D] disabled:opacity-35"
                              title={isVi ? 'Di chuyển ra sau' : 'Move right'}
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(url)}
                            disabled={saving || galleryImages.length <= 1}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-35"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {isVi ? 'Xóa' : 'Remove'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSavePhotos}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isVi ? 'Lưu bố cục thư viện ảnh' : 'Save gallery layout'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: DETAILS & AMENITIES */}
          {tab === 'details' && (
            <form onSubmit={handleSaveDetails} className="space-y-6">
              <div className="grid gap-4 rounded-2xl border border-[#E5DFD3] bg-white p-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tên chỗ ở (Tiếng Việt)' : 'Property Title (Vietnamese)'}
                  </label>
                  <input
                    required
                    value={titleVi}
                    onChange={(e) => setTitleVi(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tên chỗ ở (Tiếng Anh)' : 'Property Title (English)'}
                  </label>
                  <input
                    required
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tiêu đề phụ (Tiếng Việt)' : 'Subtitle (Vietnamese)'}
                  </label>
                  <input
                    required
                    value={subtitleVi}
                    onChange={(e) => setSubtitleVi(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tiêu đề phụ (Tiếng Anh)' : 'Subtitle (English)'}
                  </label>
                  <input
                    required
                    value={subtitleEn}
                    onChange={(e) => setSubtitleEn(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Khu vực / Quận (Tiếng Việt)' : 'Neighborhood (Vietnamese)'}
                  </label>
                  <input
                    required
                    value={neighborhoodVi}
                    onChange={(e) => setNeighborhoodVi(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Khu vực / Quận (Tiếng Anh)' : 'Neighborhood (English)'}
                  </label>
                  <input
                    required
                    value={neighborhoodEn}
                    onChange={(e) => setNeighborhoodEn(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Địa chỉ chính xác (chỉ gửi khách sau khi giữ chỗ 12%)' : 'Exact Street Address (shared after 12% reservation)'}
                  </label>
                  <input
                    required
                    value={exactAddress}
                    onChange={(e) => setExactAddress(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Mô tả chi tiết (Tiếng Việt)' : 'Full Description (Vietnamese)'}
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={descriptionVi}
                    onChange={(e) => setDescriptionVi(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Mô tả chi tiết (Tiếng Anh)' : 'Full Description (English)'}
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Hướng dẫn nhận phòng (Tiếng Việt)' : 'Check-in Instructions (Vietnamese)'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={checkinInstructionsVi}
                    onChange={(e) => setCheckinInstructionsVi(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Hướng dẫn nhận phòng (Tiếng Anh)' : 'Check-in Instructions (English)'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={checkinInstructionsEn}
                    onChange={(e) => setCheckinInstructionsEn(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Workspace & Long-stay attributes */}
              <div className="space-y-4 rounded-2xl border border-[#E5DFD3] bg-white p-5">
                <h3 className="font-serif-display text-lg font-semibold text-[#17221E]">
                  {isVi ? 'Trang bị làm việc, chính sách & sinh hoạt dài ngày' : 'Workspace setup, policies & long-stay amenities'}
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                      {isVi ? 'Mô tả góc làm việc (Tiếng Việt)' : 'Workspace summary (Vietnamese)'}
                    </label>
                    <input
                      value={workspaceSummaryVi}
                      onChange={(e) => setWorkspaceSummaryVi(e.target.value)}
                      className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                      {isVi ? 'Mô tả góc làm việc (Tiếng Anh)' : 'Workspace summary (English)'}
                    </label>
                    <input
                      value={workspaceSummaryEn}
                      onChange={(e) => setWorkspaceSummaryEn(e.target.value)}
                      className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                      {isVi ? 'Loại hình chỗ ở' : 'Property type'}
                    </label>
                    <select
                      value={propertyType}
                      onChange={(e) => setPropertyType(e.target.value as HostEditableStay['propertyType'])}
                      className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
                    >
                      <option value="apartment">{isVi ? 'Căn hộ' : 'Apartment'}</option>
                      <option value="coliving">Coliving</option>
                      <option value="boutique_hotel">{isVi ? 'Khách sạn boutique' : 'Boutique hotel'}</option>
                      <option value="villa">{isVi ? 'Biệt thự' : 'Villa'}</option>
                      <option value="eco_lodge">Eco lodge</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                      {isVi ? 'Chính sách hủy' : 'Cancellation'}
                    </label>
                    <select
                      value={cancellationPolicy}
                      onChange={(e) =>
                        setCancellationPolicy(e.target.value as HostEditableStay['cancellationPolicy'])
                      }
                      className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
                    >
                      <option value="flexible">{isVi ? 'Linh hoạt' : 'Flexible'}</option>
                      <option value="moderate">{isVi ? 'Trung bình' : 'Moderate'}</option>
                      <option value="strict">{isVi ? 'Nghiêm ngặt' : 'Strict'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                      {isVi ? 'Khu bếp' : 'Kitchen'}
                    </label>
                    <select
                      value={kitchenType}
                      onChange={(e) => setKitchenType(e.target.value as HostEditableStay['kitchenType'])}
                      className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
                    >
                      <option value="full">{isVi ? 'Bếp riêng đầy đủ' : 'Full kitchen'}</option>
                      <option value="kitchenette">{isVi ? 'Bếp nhỏ gọn' : 'Kitchenette'}</option>
                      <option value="shared">{isVi ? 'Bếp chung' : 'Shared kitchen'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                      {isVi ? 'Giặt sấy' : 'Laundry'}
                    </label>
                    <select
                      value={laundryType}
                      onChange={(e) => setLaundryType(e.target.value as HostEditableStay['laundryType'])}
                      className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
                    >
                      <option value="in_unit">{isVi ? 'Máy giặt trong phòng' : 'In-unit washer'}</option>
                      <option value="building">{isVi ? 'Giặt sấy tòa nhà' : 'Building laundry'}</option>
                      <option value="service">{isVi ? 'Dịch vụ giặt ủi' : 'Laundry service'}</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-1 text-xs font-medium text-[#17221E]">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={isInstantBook} onChange={(e) => setIsInstantBook(e.target.checked)} className="accent-[#164E3F]" />
                    {isVi ? 'Đặt phòng tức thì' : 'Instant booking'}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hasErgonomicChair} onChange={(e) => setHasErgonomicChair(e.target.checked)} className="accent-[#164E3F]" />
                    {isVi ? 'Ghế công thái học' : 'Ergonomic chair'}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hasExternalMonitor} onChange={(e) => setHasExternalMonitor(e.target.checked)} className="accent-[#164E3F]" />
                    {isVi ? 'Có màn hình rời' : 'External monitor'}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={hasCallBooth} onChange={(e) => setHasCallBooth(e.target.checked)} className="accent-[#164E3F]" />
                    {isVi ? 'Buồng gọi điện riêng' : 'Soundproof call booth'}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={petFriendly} onChange={(e) => setPetFriendly(e.target.checked)} className="accent-[#164E3F]" />
                    {isVi ? 'Nhận thú cưng' : 'Pet friendly'}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={wheelchairFriendly} onChange={(e) => setWheelchairFriendly(e.target.checked)} className="accent-[#164E3F]" />
                    {isVi ? 'Lối đi xe lăn' : 'Wheelchair accessible'}
                  </label>
                </div>

                {/* Amenities chips */}
                <div className="space-y-2 border-t border-[#F0EBE0] pt-4">
                  <label className="block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Danh sách tiện ích nổi bật' : 'Highlighted amenities'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {amenities.map((a, idx) => (
                      <span
                        key={`${a}-${idx}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1 text-xs font-medium text-[#17221E]"
                      >
                        <Sparkles className="h-3 w-3 text-[#164E3F]" />
                        {a}
                        <button
                          type="button"
                          onClick={() => setAmenities((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-[#53635D] hover:text-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex max-w-md gap-2 pt-1">
                    <input
                      type="text"
                      value={newAmenity}
                      onChange={(e) => setNewAmenity(e.target.value)}
                      placeholder={isVi ? 'Ví dụ: Máy lọc không khí, Bàn nâng hạ' : 'e.g. Standing desk, Water filter'}
                      className="flex-1 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = newAmenity.trim();
                        if (val && !amenities.includes(val)) {
                          setAmenities((prev) => [...prev, val]);
                          setNewAmenity('');
                        }
                      }}
                      className="rounded-xl border border-[#E5DFD3] bg-white px-3 py-1.5 text-xs font-semibold text-[#164E3F]"
                    >
                      {isVi ? '+ Thêm tiện ích' : '+ Add amenity'}
                    </button>
                  </div>
                </div>

                {/* Nearby coworking */}
                <div className="space-y-2 border-t border-[#F0EBE0] pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#53635D]">
                      {isVi ? 'Không gian coworking / cafe làm việc gần kề' : 'Nearby coworking spaces'}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setNearbyCoworking((prev) => [...prev, { name: '', distance: '5 min walk' }])
                      }
                      className="text-xs font-semibold text-[#164E3F] hover:underline"
                    >
                      {isVi ? '+ Thêm địa điểm' : '+ Add spot'}
                    </button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {nearbyCoworking.map((spot, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-xl bg-[#FAF8F3] p-2">
                        <input
                          value={spot.name}
                          onChange={(e) =>
                            setNearbyCoworking((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, name: e.target.value } : s))
                            )
                          }
                          placeholder={isVi ? 'Tên coworking' : 'Coworking name'}
                          className="flex-1 rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1.5 text-xs"
                        />
                        <input
                          value={spot.distance}
                          onChange={(e) =>
                            setNearbyCoworking((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, distance: e.target.value } : s))
                            )
                          }
                          placeholder="5 min walk"
                          className="w-28 rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNearbyCoworking((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#164E3F] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isVi ? 'Lưu toàn bộ thông tin' : 'Save stay details'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: ROOMS & INVENTORY */}
          {tab === 'rooms' && (
            <div className="space-y-5">
              {rooms.map((room, idx) => (
                <div key={room.id} className="space-y-4 rounded-2xl border border-[#E5DFD3] bg-white p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F0EBE0] pb-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={room.roomImage}
                        alt={room.nameEn}
                        className="h-20 w-28 rounded-xl border border-[#E5DFD3] object-cover"
                      />
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-[#164E3F]">
                          {isVi ? `Loại phòng #${idx + 1}` : `Room Category #${idx + 1}`}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="cursor-pointer rounded-lg border border-[#164E3F]/30 bg-[#E7F1EC] px-2.5 py-1 text-[11px] font-semibold text-[#164E3F]">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.length) {
                                  uploadFiles(e.target.files, 'room', room.id);
                                  e.target.value = '';
                                }
                              }}
                            />
                            {isVi ? 'Tải ảnh phòng mới' : 'Upload room photo'}
                          </label>
                          <select
                            value={room.roomImage}
                            onChange={(e) =>
                              setRooms((prev) =>
                                prev.map((r) =>
                                  r.id === room.id ? { ...r, roomImage: e.target.value } : r
                                )
                              )
                            }
                            className="max-w-[200px] rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-2 py-1 text-[11px]"
                          >
                            {galleryImages.map((g, gIdx) => (
                              <option key={g} value={g}>
                                {isVi ? `Ảnh thư viện #${gIdx + 1}` : `Gallery photo #${gIdx + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {rooms.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRoom(room.id)}
                          disabled={saving}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {isVi ? 'Xóa phòng' : 'Delete'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSaveRoom(room)}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#164E3F] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0F392E]"
                      >
                        <Save className="h-3.5 w-3.5" />
                        {isVi ? 'Lưu phòng' : 'Save room'}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        {isVi ? 'Tên phòng (VI)' : 'Room name (VI)'}
                      </label>
                      <input
                        value={room.nameVi}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) => (r.id === room.id ? { ...r, nameVi: e.target.value } : r))
                          )
                        }
                        className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        {isVi ? 'Tên phòng (EN)' : 'Room name (EN)'}
                      </label>
                      <input
                        value={room.nameEn}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) => (r.id === room.id ? { ...r, nameEn: e.target.value } : r))
                          )
                        }
                        className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        {isVi ? 'Số khách tối đa' : 'Max guests'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={room.maxGuests}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id ? { ...r, maxGuests: Number(e.target.value) } : r
                            )
                          )
                        }
                        className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        {isVi ? 'Số giường' : 'Beds'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={room.bedsCount}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id ? { ...r, bedsCount: Number(e.target.value) } : r
                            )
                          )
                        }
                        className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        {isVi ? 'Số căn đang mở' : 'Total units'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={room.unitsTotal}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id ? { ...r, unitsTotal: Number(e.target.value) } : r
                            )
                          )
                        }
                        className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        {isVi ? 'Mô tả phòng (VI)' : 'Room description (VI)'}
                      </label>
                      <input
                        value={room.descriptionVi}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id ? { ...r, descriptionVi: e.target.value } : r
                            )
                          )
                        }
                        className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        {isVi ? 'Mô tả phòng (EN)' : 'Room description (EN)'}
                      </label>
                      <input
                        value={room.descriptionEn}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id ? { ...r, descriptionEn: e.target.value } : r
                            )
                          )
                        }
                        className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-5 rounded-xl bg-[#FAF8F3] p-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-[#53635D]">
                        7N (VND)
                      </label>
                      <input
                        type="number"
                        value={room.wholesale7Vnd}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id ? { ...r, wholesale7Vnd: Number(e.target.value) } : r
                            )
                          )
                        }
                        className="w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1.5 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-[#53635D]">
                        14N (VND)
                      </label>
                      <input
                        type="number"
                        value={room.wholesale14Vnd}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id ? { ...r, wholesale14Vnd: Number(e.target.value) } : r
                            )
                          )
                        }
                        className="w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1.5 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-[#53635D]">
                        21N (VND)
                      </label>
                      <input
                        type="number"
                        value={room.wholesale21Vnd}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id ? { ...r, wholesale21Vnd: Number(e.target.value) } : r
                            )
                          )
                        }
                        className="w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1.5 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-[#53635D]">
                        30N (VND)
                      </label>
                      <input
                        type="number"
                        value={room.wholesale30Vnd}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id ? { ...r, wholesale30Vnd: Number(e.target.value) } : r
                            )
                          )
                        }
                        className="w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1.5 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold text-[#53635D]">
                        {isVi ? 'Đêm thêm' : 'Extra night'}
                      </label>
                      <input
                        type="number"
                        value={room.extraNightVnd}
                        onChange={(e) =>
                          setRooms((prev) =>
                            prev.map((r) =>
                              r.id === room.id ? { ...r, extraNightVnd: Number(e.target.value) } : r
                            )
                          )
                        }
                        className="w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1.5 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add room drawer */}
              {showAddRoom ? (
                <form
                  onSubmit={handleCreateRoom}
                  className="space-y-4 rounded-2xl border border-[#164E3F]/30 bg-white p-5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif-display text-lg font-semibold text-[#17221E]">
                      {isVi ? 'Thêm loại phòng mới' : 'Create new room category'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddRoom(false)}
                      className="text-xs font-semibold text-[#53635D]"
                    >
                      {isVi ? 'Hủy' : 'Cancel'}
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      required
                      value={newRoomNameVi}
                      onChange={(e) => setNewRoomNameVi(e.target.value)}
                      placeholder={isVi ? 'Tên phòng tiếng Việt (VD: Studio Ban Công)' : 'Room name (Vietnamese)'}
                      className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
                    />
                    <input
                      required
                      value={newRoomNameEn}
                      onChange={(e) => setNewRoomNameEn(e.target.value)}
                      placeholder={isVi ? 'Tên phòng tiếng Anh (VD: Balcony Corner Studio)' : 'Room name (English)'}
                      className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
                    />
                    <input
                      value={newRoomDescVi}
                      onChange={(e) => setNewRoomDescVi(e.target.value)}
                      placeholder={isVi ? 'Mô tả ngắn tiếng Việt' : 'Short description (Vietnamese)'}
                      className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
                    />
                    <input
                      value={newRoomDescEn}
                      onChange={(e) => setNewRoomDescEn(e.target.value)}
                      placeholder={isVi ? 'Mô tả ngắn tiếng Anh' : 'Short description (English)'}
                      className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-5">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        {isVi ? 'Khách' : 'Guests'}
                      </label>
                      <input type="number" min={1} max={12} value={newRoomGuests} onChange={(e) => setNewRoomGuests(Number(e.target.value))} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        {isVi ? 'Giường' : 'Beds'}
                      </label>
                      <input type="number" min={1} max={10} value={newRoomBeds} onChange={(e) => setNewRoomBeds(Number(e.target.value))} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        {isVi ? 'Số căn' : 'Units'}
                      </label>
                      <input type="number" min={1} max={50} value={newRoomUnits} onChange={(e) => setNewRoomUnits(Number(e.target.value))} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        7N (VND)
                      </label>
                      <input type="number" value={newRoomW7} onChange={(e) => setNewRoomW7(Number(e.target.value))} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs" />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                        30N (VND)
                      </label>
                      <input type="number" value={newRoomW30} onChange={(e) => setNewRoomW30(Number(e.target.value))} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-[#53635D]">
                      {isVi ? 'Giá gốc tháng hiển thị:' : 'Monthly host rate:'}{' '}
                      <strong>{formatVndExact(newRoomW30)}</strong>
                    </span>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#164E3F] px-5 py-2 text-xs font-semibold text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isVi ? 'Tạo loại phòng' : 'Create room'}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddRoom(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#D8D0C2] bg-white py-4 text-xs font-semibold text-[#164E3F] hover:border-[#164E3F] hover:bg-[#E7F1EC]/30"
                >
                  <Plus className="h-4 w-4" />
                  {isVi ? 'Thêm loại phòng mới cho chỗ ở này' : 'Add another room category'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
