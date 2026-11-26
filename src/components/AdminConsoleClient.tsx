'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bell, CheckCircle2, ClipboardCheck, ShieldCheck, Users } from 'lucide-react';
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
    verifiedAt: string;
    speedtestProofUrl: string;
    workspaceVideoUrl: string;
    icalUrl: string;
    icalSyncStatus: string;
    walletBalanceVnd: number;
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
  const [crmRows, setCrmRows] = useState(data.crmUsers);

  async function handleReview(appId: string, decision: 'approved' | 'rejected') {
    const res = await fetch(`/api/admin/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        reviewNote: decision === 'approved' ? 'Approved and published live' : 'Did not meet listing requirements',
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
    }
  }

  async function handleStayPatch(
    stayId: string,
    payload: {
      status?: 'live' | 'limited' | 'paused';
      verificationTier?: 'HOST_VERIFIED' | 'VIETNOMAD_CERTIFIED';
    }
  ) {
    const res = await fetch(`/api/admin/stays/${stayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (json.ok) {
      setNotice(isVi ? 'Đã cập nhật trạng thái chỗ ở.' : 'Updated stay settings.');
      window.location.reload();
    }
  }

  async function handleBookingMismatchRefund(bookingId: string) {
    const res = await fetch(`/api/bookings/${bookingId}/mismatch-refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Admin verified slow Wi-Fi speed and approved 100% booking fee refund',
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setNotice(
        isVi
          ? `Đã hoàn 100% phí giữ chỗ (${formatVndExact(json.refund.refundAmountVnd)}).`
          : `Refunded 100% booking fee (${formatVndExact(json.refund.refundAmountVnd)}).`
      );
      window.location.reload();
    }
  }

  async function handleSaveCrm(userId: string, stage: string, note: string) {
    const res = await fetch(`/api/admin/crm/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crmStage: stage, crmNote: note }),
    });
    const json = await res.json();
    if (json.ok) {
      setNotice(isVi ? 'Đã lưu ghi chú khách hàng.' : 'Saved customer note.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#E5DFD3] bg-[#0F392E] p-7 text-white lacquer-shadow">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
            <ShieldCheck className="h-4 w-4" />
            {isVi ? 'Vận hành, kiểm duyệt Wi-Fi và xác nhận chủ nhà trong 30 phút' : 'Moderation, Wi-Fi checks, and 30-minute host alerts'}
          </span>
          <h1 className="font-serif-display mt-2 text-3xl font-semibold">
            {isVi ? 'Trang kiểm duyệt và quản lý khách hàng' : 'Admin Moderation and Customer Management'}
          </h1>
        </div>
        <Link
          href="/admin/demo"
          className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
        >
          {isVi ? 'Chuyển nhanh tài khoản mẫu' : 'Switch demo account'}
        </Link>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-sm font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{notice}</span>
        </div>
      )}

      <section className="space-y-4 rounded-3xl border border-[#C25E28]/30 bg-white p-6">
        <h2 className="font-serif-display flex items-center gap-2 text-2xl font-semibold text-[#17221E]">
          <Bell className="h-5 w-5 text-[#C25E28]" />
          {isVi ? 'Thông báo đặt phòng và nhắc liên hệ chủ nhà qua Zalo' : 'Booking alerts and 30-minute Zalo follow-ups'}
        </h2>
        <div className="max-h-64 space-y-2 overflow-y-auto text-xs">
          {data.notifications.map((n) => (
            <div
              key={n.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 ${
                n.recipientRole === 'admin'
                  ? 'border border-[#C25E28]/30 bg-[#FAEDE5]'
                  : 'bg-[#FAF8F3]'
              }`}
            >
              <div>
                <span className="mr-2 rounded bg-[#164E3F] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  {n.recipientRole} ({n.channel})
                </span>
                <span className="font-semibold text-[#17221E]">{n.subject}</span>
              </div>
              <span className="text-[#53635D]">
                {n.recipientContact}, {n.createdAt.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
        <h2 className="font-serif-display flex items-center gap-2 text-2xl font-semibold text-[#17221E]">
          <ClipboardCheck className="h-5 w-5 text-[#C25E28]" />
          {isVi ? 'Hồ sơ chỗ ở mới chờ duyệt' : 'Properties pending review'}
        </h2>
        <div className="space-y-3">
          {data.applications.map((app) => (
            <div
              key={app.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 sm:flex-row sm:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-[#164E3F] px-2.5 py-0.5 text-white">
                    {formatApplicationStatusLabel(app.status, locale)}
                  </span>
                  <span className="text-[#C25E28]">{formatBusinessModelLabel(app.businessModel, locale)}</span>
                  <span className="text-[#53635D]">{app.measuredDownloadMbps} Mbps</span>
                </div>
                <div className="mt-1 font-semibold text-[#17221E]">
                  {app.stayName} ({app.businessName})
                </div>
                <div className="text-xs text-[#53635D]">
                  {app.applicantName}, {app.applicantEmail}, {app.destinationSlug}. {app.reviewNote}
                </div>
              </div>
              {app.status === 'submitted' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleReview(app.id, 'approved')}
                    className="rounded-xl bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white"
                  >
                    {isVi ? 'Duyệt và đăng' : 'Approve & publish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(app.id, 'rejected')}
                    className="rounded-xl border border-[#C25E28]/40 px-4 py-2 text-xs font-semibold text-[#C25E28]"
                  >
                    {isVi ? 'Từ chối' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
        <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Chỗ ở đang hoạt động và cấp độ kiểm tra' : 'Listed properties and verification status'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs sm:text-sm">
            <thead className="border-b border-[#E5DFD3] text-xs uppercase text-[#53635D]">
              <tr>
                <th className="py-2 pr-4">{isVi ? 'Chỗ ở' : 'Property'}</th>
                <th className="py-2 pr-4">{isVi ? 'Chủ nhà' : 'Host'}</th>
                <th className="py-2 pr-4">{isVi ? 'Tốc độ Wi-Fi' : 'Wi-Fi & proof'}</th>
                <th className="py-2 pr-4">{isVi ? 'Mức xác minh' : 'Verification'}</th>
                <th className="py-2">{isVi ? 'Hiển thị' : 'Visibility'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {data.stays.map((s) => (
                <tr key={s.id}>
                  <td className="py-3 pr-4">
                    <Link href={`/stays/${s.slug}`} className="font-semibold text-[#164E3F] hover:underline">
                      {s.titleEn}
                    </Link>
                    <div className="text-xs text-[#53635D]">
                      {s.destinationNameEn}, {isVi ? 'Lịch phòng:' : 'Calendar:'} {formatIcalSyncStatusLabel(s.icalSyncStatus, locale)}
                    </div>
                  </td>
                  <td className="py-3 pr-4">{s.hostName}</td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold">
                      {s.wifiDownloadMbps}/{s.wifiUploadMbps} Mbps ({s.wifiJitterMs}ms)
                    </div>
                    <div className="flex gap-2 text-[11px]">
                      {s.speedtestProofUrl && (
                        <a href={s.speedtestProofUrl} target="_blank" rel="noopener noreferrer" className="text-[#164E3F] underline">
                          {isVi ? 'Chứng nhận Wi-Fi' : 'Wi-Fi proof'}
                        </a>
                      )}
                      {s.workspaceVideoUrl && (
                        <a href={s.workspaceVideoUrl} target="_blank" rel="noopener noreferrer" className="text-[#C25E28] underline">
                          {isVi ? 'Góc làm việc' : 'Desk setup'}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      value={s.verificationTier}
                      onChange={(e) =>
                        handleStayPatch(s.id, {
                          verificationTier: e.target.value as 'HOST_VERIFIED' | 'VIETNOMAD_CERTIFIED',
                        })
                      }
                      className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-2 py-1 text-xs font-semibold"
                    >
                      <option value="VIETNOMAD_CERTIFIED">{formatVerificationTierLabel('VIETNOMAD_CERTIFIED', locale)}</option>
                      <option value="HOST_VERIFIED">{formatVerificationTierLabel('HOST_VERIFIED', locale)}</option>
                    </select>
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

      <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
        <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Đơn đặt phòng gần đây (12% online, phần thuê trả khi nhận phòng)' : 'Recent bookings (12% online, rent paid at check-in)'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-[#E5DFD3] uppercase text-[#53635D]">
              <tr>
                <th className="py-2 pr-3">{isVi ? 'Mã đơn' : 'Code'}</th>
                <th className="py-2 pr-3">{isVi ? 'Chỗ ở và khách' : 'Stay & guest'}</th>
                <th className="py-2 pr-3">{isVi ? 'Trạng thái' : 'Status'}</th>
                <th className="py-2 pr-3">{isVi ? 'Phí giữ chỗ 12%' : '12% online fee'}</th>
                <th className="py-2 pr-3">{isVi ? 'Trả tại chỗ' : 'Due at check-in'}</th>
                <th className="py-2">{isVi ? 'Xử lý' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {data.recentBookings.map((b) => (
                <tr key={b.id}>
                  <td className="py-2.5 pr-3 font-bold text-[#164E3F]">{b.bookingCode}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold">{b.stayTitleEn}</div>
                    <div className="text-[#53635D]">{b.guestName}, {b.nights} {isVi ? 'đêm' : 'nights'}</div>
                  </td>
                  <td className="py-2.5 pr-3 font-semibold">{formatBookingStatusLabel(b.status, locale)}</td>
                  <td className="py-2.5 pr-3 font-semibold text-[#164E3F]">{formatVndExact(b.feeOnlineVnd)}</td>
                  <td className="py-2.5 pr-3">{formatVndExact(b.payAtCheckinVnd)}</td>
                  <td className="py-2.5">
                    {(b.status === 'RESERVED_LOCKED' || b.status === 'confirmed') && (
                      <button
                        type="button"
                        onClick={() => handleBookingMismatchRefund(b.id)}
                        className="rounded-lg border border-[#C25E28]/40 px-2.5 py-1 font-semibold text-[#C25E28] hover:bg-[#FAEDE5]"
                      >
                        {isVi ? 'Hoàn 100% phí Wi-Fi' : 'Issue 100% Wi-Fi refund'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
        <h2 className="font-serif-display flex items-center gap-2 text-2xl font-semibold text-[#17221E]">
          <Users className="h-5 w-5 text-[#164E3F]" />
          {isVi ? 'Danh sách khách thuê và chủ nhà' : 'Members and hosts'}
        </h2>
        <div className="space-y-3">
          {crmRows.map((u) => (
            <div
              key={u.id}
              className="grid gap-3 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 md:grid-cols-12 md:items-center"
            >
              <div className="md:col-span-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#17221E]">{u.fullName}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#164E3F]">
                    {u.role} ({u.membershipTier})
                  </span>
                </div>
                <div className="text-xs text-[#53635D]">
                  {u.email}, {u.nationality}, {u.bookingCount} {isVi ? 'đơn' : 'bookings'}, {formatVndExact(u.totalSpentVnd)}
                </div>
              </div>
              <div className="md:col-span-2">
                <select
                  value={u.crmStage}
                  onChange={(e) =>
                    setCrmRows((prev) =>
                      prev.map((row) => (row.id === u.id ? { ...row, crmStage: e.target.value } : row))
                    )
                  }
                  className="w-full rounded-xl border border-[#E5DFD3] bg-white px-2.5 py-1.5 text-xs font-semibold"
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
                      prev.map((row) => (row.id === u.id ? { ...row, crmNote: e.target.value } : row))
                    )
                  }
                  className="w-full rounded-xl border border-[#E5DFD3] bg-white px-3 py-1.5 text-xs"
                />
              </div>
              <div className="md:col-span-2 text-right">
                <button
                  type="button"
                  onClick={() => handleSaveCrm(u.id, u.crmStage, u.crmNote)}
                  className="w-full rounded-xl bg-[#164E3F] px-3 py-1.5 text-xs font-semibold text-white"
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
