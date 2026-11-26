'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Building2,
  Edit3,
  ExternalLink,
  Eye,
  LayoutGrid,
  List as ListIcon,
  PauseCircle,
  PlayCircle,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import {
  formatMoneyFromVnd,
  formatPropertyTypeLabel,
  formatVndExact,
} from '@/lib/i18n';
import { usePreferences } from '@/components/PreferencesProvider';
import type { HostStaySummary } from '@/modules/host';

export interface HostDraftSummary {
  id: string;
  currentStep: number;
  titlePreview: string;
  city: string;
  updatedAt: string;
}

export function HostListingsClient({
  initialStays,
  initialDrafts,
}: {
  initialStays: HostStaySummary[];
  initialDrafts: HostDraftSummary[];
}) {
  const { locale, currency } = usePreferences();
  const isVi = locale === 'vi';

  const [stays, setStays] = useState<HostStaySummary[]>(initialStays);
  const [drafts, setDrafts] = useState<HostDraftSummary[]>(initialDrafts);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [busyId, setBusyId] = useState<string>('');
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function toggleStatus(stay: HostStaySummary) {
    if (stay.status === 'pending_review') return;
    const nextStatus = stay.status === 'live' ? 'paused' : 'live';
    setBusyId(stay.id);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/host/stays/${stay.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not update status.');
        return;
      }
      setStays((prev) =>
        prev.map((s) => (s.id === stay.id ? { ...s, status: nextStatus } : s))
      );
      setNotice(
        nextStatus === 'live'
          ? isVi
            ? 'Đã mở hiển thị chỗ ở lại trên sàn.'
            : 'Listing is now live.'
          : isVi
            ? 'Đã tạm ẩn chỗ ở khỏi tìm kiếm công khai.'
            : 'Listing paused.'
      );
    } finally {
      setBusyId('');
    }
  }

  async function deleteDraft(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/host/drafts/${id}`, { method: 'DELETE' });
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setBusyId('');
    }
  }

  function statusBadge(status: string) {
    if (status === 'live') {
      return {
        label: isVi ? 'Đang hoạt động' : 'Live',
        cls: 'border-[#164E3F]/30 bg-[#E7F1EC] text-[#164E3F]',
      };
    }
    if (status === 'paused') {
      return {
        label: isVi ? 'Tạm ẩn' : 'Paused',
        cls: 'border-[#D4CEC2] bg-[#FAF8F3] text-[#53635D]',
      };
    }
    return {
      label: isVi ? 'Chờ Admin duyệt' : 'Pending review',
      cls: 'border-[#A67C2E]/40 bg-[#FDF4DF] text-[#8E651A]',
    };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Chỗ ở & Phòng đang quản lý' : 'Your Listings'}
          </h1>
          <p className="mt-0.5 text-xs text-[#53635D]">
            {isVi
              ? `${stays.length} cơ sở lưu trú · Chỉnh sửa đầy đủ 10 nhóm thông tin, ảnh và giá gói.`
              : `${stays.length} listing(s) · Edit photos, amenities, house rules, workspace, and pricing.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#E5DFD3] bg-white p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              aria-label="Card view"
              className={`rounded-md p-1.5 ${
                viewMode === 'card'
                  ? 'bg-[#164E3F] text-white'
                  : 'text-[#53635D] hover:text-[#17221E]'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="List view"
              className={`rounded-md p-1.5 ${
                viewMode === 'list'
                  ? 'bg-[#164E3F] text-white'
                  : 'text-[#53635D] hover:text-[#17221E]'
              }`}
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>

          <Link
            href="/host/listings/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F392E]"
          >
            <Plus className="h-4 w-4" />
            {isVi ? 'Thêm chỗ ở mới' : 'Create listing'}
          </Link>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-2.5 text-xs font-medium text-[#164E3F]">
          {notice}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-2.5 text-xs font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      {/* Drafts Section */}
      {drafts.length > 0 && (
        <section className="rounded-xl border border-[#E5DFD3] bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#53635D]">
            {isVi ? 'Bản nháp đang tạo dở' : 'In-progress Drafts'}
          </h2>
          <div className="mt-3 divide-y divide-[#E5DFD3]">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#17221E]">{d.titlePreview}</span>
                  <span className="ml-2 text-[#53635D]">
                    {d.city} · {isVi ? `Bước ${d.currentStep}/7` : `Step ${d.currentStep}/7`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/host/listings/new?draft=${d.id}`}
                    className="rounded-lg border border-[#164E3F] px-3 py-1 font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
                  >
                    {isVi ? 'Tiếp tục tạo' : 'Resume wizard'}
                  </Link>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => deleteDraft(d.id)}
                    className="rounded-lg border border-[#E5DFD3] p-1.5 text-[#53635D] hover:text-[#C25E28]"
                    aria-label="Delete draft"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {stays.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5DFD3] bg-white p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-[#53635D]" strokeWidth={1.5} />
          <h2 className="mt-3 text-base font-semibold text-[#17221E]">
            {isVi ? 'Bạn chưa có chỗ ở nào được tạo' : 'You have no listings yet'}
          </h2>
          <p className="mt-1 text-xs text-[#53635D]">
            {isVi
              ? 'Bắt đầu với trình hướng dẫn 7 bước để đăng chỗ ở và bán ngay với 0% hoa hồng chủ nhà.'
              : 'Launch your first listing with our step-by-step wizard and keep 100% of your room rate.'}
          </p>
          <Link
            href="/host/listings/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F392E]"
          >
            <Plus className="h-4 w-4" />
            {isVi ? 'Tạo chỗ ở đầu tiên' : 'Start your first listing'}
          </Link>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stays.map((stay) => {
            const badge = statusBadge(stay.status);
            const firstRoom = stay.rooms[0];
            const baseNightly = firstRoom?.wholesale7Vnd
              ? Math.round(firstRoom.wholesale7Vnd / 7)
              : stay.wholesale7Vnd > 0
                ? Math.round(stay.wholesale7Vnd / 7)
                : 0;
            return (
              <article
                key={stay.id}
                className="flex flex-col overflow-hidden rounded-xl border border-[#E5DFD3] bg-white"
              >
                <div className="relative aspect-[16/10] w-full bg-[#FAF8F3]">
                  <img
                    src={stay.heroImage}
                    alt={isVi ? stay.titleVi : stay.titleEn}
                    className="h-full w-full object-cover"
                  />
                  <span
                    className={`absolute left-3 top-3 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>

                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[#17221E]">
                        {isVi ? stay.titleVi : stay.titleEn}
                      </h3>
                      {stay.googleRating > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#17221E]">
                          <Star className="h-3.5 w-3.5 text-[#A67C2E]" />
                          {stay.googleRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#53635D]">
                      {isVi ? stay.neighborhoodVi : stay.neighborhoodEn},{' '}
                      {isVi ? stay.destinationNameVi : stay.destinationNameEn} ·{' '}
                      {formatPropertyTypeLabel(stay.propertyType, locale)}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-[#164E3F]">
                      {baseNightly > 0
                        ? `${formatMoneyFromVnd(baseNightly, currency)} / ${isVi ? 'đêm' : 'night'}`
                        : isVi
                          ? 'Chưa cài đặt phòng'
                          : 'No rooms yet'}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#E5DFD3] pt-3 text-xs">
                    <Link
                      href={`/host/listings/${stay.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-3 py-1.5 font-semibold text-white hover:bg-[#0F392E]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      {isVi ? 'Chỉnh sửa' : 'Edit'}
                    </Link>

                    <div className="flex items-center gap-1.5">
                      {stay.status !== 'pending_review' && (
                        <button
                          type="button"
                          disabled={busyId === stay.id}
                          onClick={() => toggleStatus(stay)}
                          title={stay.status === 'live' ? 'Pause' : 'Resume'}
                          className="rounded-lg border border-[#E5DFD3] p-1.5 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
                        >
                          {stay.status === 'live' ? (
                            <PauseCircle className="h-4 w-4" />
                          ) : (
                            <PlayCircle className="h-4 w-4 text-[#164E3F]" />
                          )}
                        </button>
                      )}
                      <Link
                        href={`/stays/${stay.slug}`}
                        target="_blank"
                        title={isVi ? 'Xem trang khách' : 'Preview public page'}
                        className="rounded-lg border border-[#E5DFD3] p-1.5 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="overflow-x-auto rounded-xl border border-[#E5DFD3] bg-white">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[#53635D]">
                <th className="px-4 py-3 font-semibold">{isVi ? 'Chỗ ở' : 'Listing'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Địa điểm' : 'Location'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Giá cơ bản' : 'Base rate'}</th>
                <th className="px-4 py-3 font-semibold">{isVi ? 'Trạng thái' : 'Status'}</th>
                <th className="px-4 py-3 text-right font-semibold">{isVi ? 'Thao tác' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {stays.map((stay) => {
                const badge = statusBadge(stay.status);
                const base = stay.rooms[0]?.wholesale7Vnd
                  ? Math.round(stay.rooms[0].wholesale7Vnd / 7)
                  : stay.wholesale7Vnd > 0
                    ? Math.round(stay.wholesale7Vnd / 7)
                    : 0;
                return (
                  <tr key={stay.id} className="hover:bg-[#FAF8F3]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={stay.heroImage}
                          alt=""
                          className="h-10 w-14 rounded-md object-cover border border-[#E5DFD3]"
                        />
                        <div>
                          <div className="font-semibold text-[#17221E]">
                            {isVi ? stay.titleVi : stay.titleEn}
                          </div>
                          <div className="text-[11px] text-[#53635D]">
                            {stay.rooms.length} {isVi ? 'phòng' : 'room(s)'} ·{' '}
                            {stay.galleryImages.length + 1} {isVi ? 'ảnh' : 'photos'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#53635D]">
                      {isVi ? stay.neighborhoodVi : stay.neighborhoodEn},{' '}
                      {isVi ? stay.destinationNameVi : stay.destinationNameEn}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#164E3F]">
                      {base > 0 ? formatVndExact(base) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          href={`/host/listings/${stay.id}`}
                          className="rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1 font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
                        >
                          {isVi ? 'Sửa' : 'Edit'}
                        </Link>
                        <Link
                          href={`/stays/${stay.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1 text-[#53635D] hover:text-[#17221E]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
