'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  Bell,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  formatApplicationStatusLabel,
  formatBookingStatusLabel,
  formatBusinessModelLabel,
  formatIcalSyncStatusLabel,
  formatVerificationTierLabel,
  formatVndExact,
} from '@/lib/i18n';
import { usePreferences } from './PreferencesProvider';

interface AdminConsoleData {
  applications: Array<{
    id: string;
    applicantName: string;
    applicantEmail: string;
    businessName: string;
    stayName: string;
    destinationSlug: string;
    propertyType: string;
    businessModel: string;
    measuredDownloadMbps: number;
    status: string;
    reviewNote: string;
  }>;
  stays: Array<{
    id: string;
    slug: string;
    titleEn: string;
    hostName: string;
    destinationNameEn: string;
    businessModel: string;
    status: string;
    wifiDownloadMbps: number;
    wifiUploadMbps: number;
    wifiJitterMs: number;
    verificationTier: string;
    isWifiVerified: boolean;
    isWorkReady: boolean;
    verifiedAt: string;
    speedtestProofUrl: string;
    workspaceVideoUrl: string;
    icalUrl: string;
    icalSyncStatus: string;
  }>;
  crmUsers: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    nationality: string;
    membershipTier: string;
    rewardCreditVnd: number;
    phone: string;
    crmStage: string;
    crmNote: string;
    bookingCount: number;
    totalSpentVnd: number;
  }>;
  recentBookings: Array<{
    id: string;
    bookingCode: string;
    stayTitleEn: string;
    guestName: string;
    businessModel: string;
    status: string;
    nights: number;
    guestTotalVnd: number;
    serviceFeeVnd: number;
    feeOnlineVnd: number;
    payAtCheckinVnd: number;
    mismatchReason: string;
  }>;
  notifications: Array<{
    id: string;
    bookingCode: string;
    recipientRole: string;
    channel: string;
    recipientContact: string;
    subject: string;
    status: string;
    createdAt: string;
  }>;
}

export function AdminConsoleClient({ data }: { data: AdminConsoleData }) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [crmRows, setCrmRows] = useState(data.crmUsers);
  const [stayQuery, setStayQuery] = useState('');
  const [crmQuery, setCrmQuery] = useState('');

  const pendingApps = data.applications.filter((a) => a.status === 'submitted');
  const liveStays = data.stays.filter((s) => s.status === 'live');
  const adminAlerts = data.notifications.filter((n) => n.recipientRole === 'admin');

  const filteredStays = useMemo(() => {
    const q = stayQuery.trim().toLowerCase();
    if (!q) return data.stays;
    return data.stays.filter((s) =>
      `${s.titleEn} ${s.hostName} ${s.destinationNameEn}`.toLowerCase().includes(q)
    );
  }, [data.stays, stayQuery]);

  const filteredCrm = useMemo(() => {
    const q = crmQuery.trim().toLowerCase();
    if (!q) return crmRows;
    return crmRows.filter((u) =>
      `${u.fullName} ${u.email} ${u.role} ${u.nationality}`.toLowerCase().includes(q)
    );
  }, [crmRows, crmQuery]);

  async function handleReview(appId: string, decision: 'approved' | 'rejected') {
    setErrorMsg('');
    const res = await fetch(`/api/admin/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        reviewNote:
          decision === 'approved'
            ? 'Approved and published live'
            : 'Did not meet listing requirements',
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setNotice(
        decision === 'approved'
          ? isVi
            ? `Đã duyệt và đăng chỗ ở mới (${json.createdStaySlug}).`
            : `Approved and published stay (${json.createdStaySlug}).`
          : isVi
            ? 'Đã từ chối hồ sơ.'
            : 'Application rejected.'
      );
      window.location.reload();
    } else {
      setErrorMsg(json.error?.message ?? 'Action failed.');
    }
  }

  async function handleStayPatch(
    stayId: string,
    payload: {
      status?: 'live' | 'limited' | 'paused';
      verificationTier?: 'SELF_DECLARED' | 'HOST_VERIFIED' | 'VIETNOMAD_CERTIFIED';
      isWifiVerified?: boolean;
      isWorkReady?: boolean;
    }
  ) {
    setErrorMsg('');
    const res = await fetch(`/api/admin/stays/${stayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.ok) {
      setNotice(isVi ? 'Đã cập nhật trạng thái & huy hiệu chỗ ở.' : 'Updated stay settings & badges.');
      window.location.reload();
    } else {
      setErrorMsg(json.error?.message ?? 'Update failed.');
    }
  }

  async function handleBookingMismatchRefund(bookingId: string) {
    setErrorMsg('');
    const res = await fetch(`/api/bookings/${bookingId}/mismatch-refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Admin verified exceptional technical case and approved booking fee refund',
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setNotice(
        isVi
          ? `Đã hoàn phí giữ chỗ (${formatVndExact(json.refund.refundAmountVnd)}).`
          : `Refunded booking fee (${formatVndExact(json.refund.refundAmountVnd)}).`
      );
      window.location.reload();
    } else {
      setErrorMsg(json.error?.message ?? 'Refund failed.');
    }
  }

  async function handleSaveCrm(userId: string, stage: string, note: string) {
    setErrorMsg('');
    const res = await fetch(`/api/admin/crm/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crmStage: stage, crmNote: note }),
    });
    const json = await res.json();
    if (json.ok) {
      setNotice(isVi ? 'Đã lưu ghi chú khách hàng.' : 'Saved customer note.');
    } else {
      setErrorMsg(json.error?.message ?? 'Save failed.');
    }
  }

  return (
    <div className="space-y-8">
      {/* Overview Header & KPIs */}
      <section id="overview" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif-display text-2xl font-semibold text-[#17221E] sm:text-3xl">
              {isVi ? 'Kiểm duyệt & Vận hành nền tảng' : 'Moderation & Platform Operations'}
            </h1>
            <p className="mt-1 text-sm text-[#53635D]">
              {isVi
                ? 'Duyệt hồ sơ đăng chỗ ở miễn phí (€0), cấp huy hiệu Wi-Fi Verified / Work-Ready tùy chọn và hỗ trợ đặt phòng.'
                : 'Review free (€0) host applications, toggle optional Wi-Fi Verified / Work-Ready badges, and monitor bookings.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-[#E5DFD3] bg-white p-4">
            <div className="flex items-center justify-between text-xs font-medium text-[#53635D]">
              <span>{isVi ? 'Hồ sơ chờ duyệt' : 'Pending applications'}</span>
              <ClipboardCheck className="h-4 w-4 text-[#C25E28]" strokeWidth={1.75} />
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#17221E]">{pendingApps.length}</div>
          </div>
          <div className="rounded-xl border border-[#E5DFD3] bg-white p-4">
            <div className="flex items-center justify-between text-xs font-medium text-[#53635D]">
              <span>{isVi ? 'Chỗ ở đang mở đặt' : 'Live listings'}</span>
              <Building2 className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#17221E]">
              {liveStays.length} / {data.stays.length}
            </div>
          </div>
          <div className="rounded-xl border border-[#E5DFD3] bg-white p-4">
            <div className="flex items-center justify-between text-xs font-medium text-[#53635D]">
              <span>{isVi ? 'Cảnh báo Zalo SLA' : 'Admin Zalo alerts'}</span>
              <Bell className="h-4 w-4 text-[#A67C2E]" strokeWidth={1.75} />
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#17221E]">{adminAlerts.length}</div>
          </div>
          <div className="rounded-xl border border-[#E5DFD3] bg-white p-4">
            <div className="flex items-center justify-between text-xs font-medium text-[#53635D]">
              <span>{isVi ? 'Thành viên & Chủ nhà' : 'Members & Hosts'}</span>
              <Users className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
            </div>
            <div className="mt-2 text-2xl font-semibold text-[#17221E]">{crmRows.length}</div>
          </div>
        </div>
      </section>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-3 text-sm font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-[#C25E28]/30 bg-[#FAEDE5] px-4 py-3 text-sm font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      {/* Booking Alerts */}
      <section id="alerts" className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#17221E]">
            <Bell className="h-4 w-4 text-[#C25E28]" strokeWidth={1.75} />
            {isVi ? 'Thông báo đặt phòng & nhắc liên hệ Zalo trong 30 phút' : 'Booking alerts & 30-minute Zalo follow-ups'}
          </h2>
          <span className="text-xs text-[#53635D]">{data.notifications.length} records</span>
        </div>
        <div className="max-h-60 divide-y divide-[#E5DFD3] overflow-y-auto text-xs">
          {data.notifications.length === 0 ? (
            <p className="py-6 text-center text-[#53635D]">
              {isVi ? 'Chưa có thông báo đặt phòng.' : 'No notifications recorded yet.'}
            </p>
          ) : (
            data.notifications.map((n) => (
              <div
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      n.recipientRole === 'admin'
                        ? 'bg-[#FAEDE5] text-[#C25E28]'
                        : 'bg-[#FAF8F3] text-[#53635D]'
                    }`}
                  >
                    {n.recipientRole} · {n.channel}
                  </span>
                  <span className="font-medium text-[#17221E]">{n.subject}</span>
                </div>
                <span className="text-[#53635D]">
                  {n.recipientContact} · {n.createdAt.slice(0, 16).replace('T', ' ')}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Applications Queue */}
      <section id="applications" className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#17221E]">
            <ClipboardCheck className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
            {isVi ? 'Hồ sơ đăng chỗ ở mới' : 'Property listing applications'}
          </h2>
          <span className="text-xs text-[#53635D]">{data.applications.length} total</span>
        </div>
        <div className="divide-y divide-[#E5DFD3]">
          {data.applications.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#53635D]">
              {isVi ? 'Chưa có hồ sơ đăng chỗ ở nào.' : 'No applications submitted yet.'}
            </p>
          ) : (
            data.applications.map((app) => (
              <div
                key={app.id}
                className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span
                      className={`rounded-md px-2 py-0.5 ${
                        app.status === 'submitted'
                          ? 'bg-[#FAEDE5] text-[#C25E28]'
                          : app.status === 'approved'
                            ? 'bg-[#E7F1EC] text-[#164E3F]'
                            : 'bg-[#FAF8F3] text-[#53635D]'
                      }`}
                    >
                      {formatApplicationStatusLabel(app.status, locale)}
                    </span>
                    <span className="text-[#53635D]">
                      {formatBusinessModelLabel(app.businessModel, locale)}
                    </span>
                    <span className="text-[#53635D]">{app.measuredDownloadMbps} Mbps</span>
                  </div>
                  <div className="text-sm font-semibold text-[#17221E]">
                    {app.stayName} <span className="font-normal text-[#53635D]">({app.businessName})</span>
                  </div>
                  <div className="text-xs text-[#53635D]">
                    {app.applicantName} ({app.applicantEmail}) · {app.destinationSlug} · {app.reviewNote}
                  </div>
                </div>
                {app.status === 'submitted' && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleReview(app.id, 'approved')}
                      className="rounded-lg bg-[#164E3F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0F392E]"
                    >
                      {isVi ? 'Duyệt và đăng' : 'Approve & publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReview(app.id, 'rejected')}
                      className="rounded-lg border border-[#C25E28]/40 px-3.5 py-2 text-xs font-semibold text-[#C25E28] hover:bg-[#FAEDE5]"
                    >
                      {isVi ? 'Từ chối' : 'Reject'}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* Listed Properties & Badges */}
      <section id="stays" className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#17221E]">
            <ShieldCheck className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
            {isVi ? 'Chỗ ở & Huy hiệu kiểm định tùy chọn' : 'Listed properties & optional trust badges'}
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#53635D]" />
            <input
              type="text"
              value={stayQuery}
              onChange={(e) => setStayQuery(e.target.value)}
              placeholder={isVi ? 'Tìm theo tên căn, chủ nhà...' : 'Filter properties or hosts...'}
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#164E3F]"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="border-b border-[#E5DFD3] text-[11px] uppercase tracking-wider text-[#53635D]">
              <tr>
                <th className="py-2.5 pr-4">{isVi ? 'Cơ sở lưu trú' : 'Property'}</th>
                <th className="py-2.5 pr-4">{isVi ? 'Chủ nhà' : 'Host'}</th>
                <th className="py-2.5 pr-4">{isVi ? 'Wi-Fi & Minh chứng' : 'Wi-Fi & proof'}</th>
                <th className="py-2.5 pr-4">{isVi ? 'Mức xác minh & Huy hiệu' : 'Verification & badges'}</th>
                <th className="py-2.5">{isVi ? 'Trạng thái' : 'Visibility'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {filteredStays.map((s) => (
                <tr key={s.id}>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/stays/${s.slug}`}
                      className="inline-flex items-center gap-1 font-semibold text-[#164E3F] hover:underline"
                    >
                      {s.titleEn}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <div className="text-[11px] text-[#53635D]">
                      {s.destinationNameEn} · {isVi ? 'iCal:' : 'Calendar:'}{' '}
                      {formatIcalSyncStatusLabel(s.icalSyncStatus, locale)}
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-medium text-[#17221E]">{s.hostName}</td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-[#17221E]">
                      {s.wifiDownloadMbps}/{s.wifiUploadMbps} Mbps ({s.wifiJitterMs}ms)
                    </div>
                    <div className="flex gap-2 text-[11px]">
                      {s.speedtestProofUrl && (
                        <a
                          href={s.speedtestProofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#164E3F] underline"
                        >
                          {isVi ? 'Ảnh Speedtest' : 'Wi-Fi proof'}
                        </a>
                      )}
                      {s.workspaceVideoUrl && (
                        <a
                          href={s.workspaceVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#C25E28] underline"
                        >
                          {isVi ? 'Góc làm việc' : 'Desk setup'}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={s.verificationTier}
                        onChange={(e) =>
                          handleStayPatch(s.id, {
                            verificationTier: e.target.value as
                              | 'SELF_DECLARED'
                              | 'HOST_VERIFIED'
                              | 'VIETNOMAD_CERTIFIED',
                          })
                        }
                        className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-2 py-1 text-xs font-medium"
                      >
                        <option value="SELF_DECLARED">
                          {formatVerificationTierLabel('SELF_DECLARED', locale)}
                        </option>
                        <option value="HOST_VERIFIED">
                          {formatVerificationTierLabel('HOST_VERIFIED', locale)}
                        </option>
                        <option value="VIETNOMAD_CERTIFIED">
                          {formatVerificationTierLabel('VIETNOMAD_CERTIFIED', locale)}
                        </option>
                      </select>
                      <div className="flex flex-wrap gap-3 text-[11px] font-medium">
                        <label className="flex cursor-pointer items-center gap-1.5 text-[#164E3F]">
                          <input
                            type="checkbox"
                            checked={s.isWifiVerified}
                            onChange={(e) =>
                              handleStayPatch(s.id, { isWifiVerified: e.target.checked })
                            }
                            className="accent-[#164E3F]"
                          />
                          Wi-Fi Verified
                        </label>
                        <label className="flex cursor-pointer items-center gap-1.5 text-[#A67C2E]">
                          <input
                            type="checkbox"
                            checked={s.isWorkReady}
                            onChange={(e) =>
                              handleStayPatch(s.id, { isWorkReady: e.target.checked })
                            }
                            className="accent-[#A67C2E]"
                          />
                          Work-Ready
                        </label>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <select
                      value={s.status}
                      onChange={(e) =>
                        handleStayPatch(s.id, {
                          status: e.target.value as 'live' | 'limited' | 'paused',
                        })
                      }
                      className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-1 text-xs font-semibold"
                    >
                      <option value="live">{isVi ? 'Đang mở' : 'Live'}</option>
                      <option value="limited">{isVi ? 'Giới hạn' : 'Limited'}</option>
                      <option value="paused">{isVi ? 'Tạm ẩn' : 'Paused'}</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bookings & Refunds */}
      <section id="bookings" className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#17221E]">
            <CalendarCheck2 className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
            {isVi
              ? 'Đơn đặt phòng gần đây (12% online, phần thuê trả Host khi nhận phòng)'
              : 'Recent bookings (12% online fee, rent paid to host at check-in)'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-[#E5DFD3] text-[11px] uppercase tracking-wider text-[#53635D]">
              <tr>
                <th className="py-2 pr-3">{isVi ? 'Mã đơn' : 'Code'}</th>
                <th className="py-2 pr-3">{isVi ? 'Chỗ ở & Khách' : 'Stay & guest'}</th>
                <th className="py-2 pr-3">{isVi ? 'Trạng thái' : 'Status'}</th>
                <th className="py-2 pr-3">{isVi ? 'Phí giữ chỗ 12%' : '12% online fee'}</th>
                <th className="py-2 pr-3">{isVi ? 'Trả Host khi nhận phòng' : 'Due at check-in'}</th>
                <th className="py-2">{isVi ? 'Xử lý' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {data.recentBookings.map((b) => (
                <tr key={b.id}>
                  <td className="py-2.5 pr-3 font-semibold text-[#164E3F]">{b.bookingCode}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold text-[#17221E]">{b.stayTitleEn}</div>
                    <div className="text-[#53635D]">
                      {b.guestName} · {b.nights} {isVi ? 'đêm' : 'nights'}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 font-medium">
                    {formatBookingStatusLabel(b.status, locale)}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-[#164E3F]">
                    {formatVndExact(b.feeOnlineVnd)}
                  </td>
                  <td className="py-2.5 pr-3">{formatVndExact(b.payAtCheckinVnd)}</td>
                  <td className="py-2.5">
                    {(b.status === 'RESERVED_LOCKED' || b.status === 'confirmed') && (
                      <button
                        type="button"
                        onClick={() => handleBookingMismatchRefund(b.id)}
                        className="rounded-lg border border-[#C25E28]/40 px-2.5 py-1 font-semibold text-[#C25E28] hover:bg-[#FAEDE5]"
                      >
                        {isVi ? 'Hoàn phí (Admin)' : 'Admin fee refund'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Customer CRM */}
      <section id="crm" className="rounded-xl border border-[#E5DFD3] bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#17221E]">
            <Users className="h-4 w-4 text-[#164E3F]" strokeWidth={1.75} />
            {isVi ? 'Danh sách khách thuê & chủ nhà (CRM)' : 'Members and hosts (CRM)'}
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#53635D]" />
            <input
              type="text"
              value={crmQuery}
              onChange={(e) => setCrmQuery(e.target.value)}
              placeholder={isVi ? 'Tìm theo tên, email...' : 'Search name, email, role...'}
              className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[#164E3F]"
            />
          </div>
        </div>
        <div className="divide-y divide-[#E5DFD3]">
          {filteredCrm.map((u) => (
            <div
              key={u.id}
              className="grid gap-3 py-3 md:grid-cols-12 md:items-center"
            >
              <div className="md:col-span-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[#17221E]">{u.fullName}</span>
                  <span className="rounded bg-[#FAF8F3] border border-[#E5DFD3] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#164E3F]">
                    {u.role} · {u.membershipTier}
                  </span>
                </div>
                <div className="text-xs text-[#53635D]">
                  {u.email} · {u.nationality} · {u.bookingCount} {isVi ? 'đơn' : 'bookings'} ·{' '}
                  {formatVndExact(u.totalSpentVnd)}
                </div>
              </div>
              <div className="md:col-span-2">
                <select
                  value={u.crmStage}
                  onChange={(e) =>
                    setCrmRows((prev) =>
                      prev.map((row) =>
                        row.id === u.id ? { ...row, crmStage: e.target.value } : row
                      )
                    )
                  }
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-1.5 text-xs font-medium"
                >
                  <option value="lead">{isVi ? 'Tiềm năng' : 'Lead'}</option>
                  <option value="active">{isVi ? 'Đang hoạt động' : 'Active'}</option>
                  <option value="vip">VIP</option>
                  <option value="follow_up">{isVi ? 'Cần liên hệ' : 'Follow up'}</option>
                  <option value="paused">{isVi ? 'Tạm ngưng' : 'Paused'}</option>
                </select>
              </div>
              <div className="md:col-span-4">
                <input
                  type="text"
                  value={u.crmNote}
                  onChange={(e) =>
                    setCrmRows((prev) =>
                      prev.map((row) =>
                        row.id === u.id ? { ...row, crmNote: e.target.value } : row
                      )
                    )
                  }
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 text-xs"
                />
              </div>
              <div className="md:col-span-2 text-right">
                <button
                  type="button"
                  onClick={() => handleSaveCrm(u.id, u.crmStage, u.crmNote)}
                  className="w-full rounded-lg bg-[#164E3F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0F392E]"
                >
                  {isVi ? 'Lưu ghi chú' : 'Save note'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
