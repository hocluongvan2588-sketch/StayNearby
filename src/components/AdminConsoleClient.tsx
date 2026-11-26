'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Bell, CheckCircle2, ClipboardCheck, ShieldCheck, Users } from 'lucide-react';
import { formatVndExact } from '@/lib/i18n';
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
        reviewNote: decision === 'approved' ? 'Verified live & Stay ID issued' : 'Incomplete criteria',
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setNotice(
        decision === 'approved'
          ? `Approved & published new Stay (${json.createdStaySlug})!`
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
      setNotice('Stay verification / visibility updated.');
      window.location.reload();
    }
  }

  async function handleBookingMismatchRefund(bookingId: string) {
    const res = await fetch(`/api/bookings/${bookingId}/mismatch-refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Admin verified Wi-Fi mismatch under 100% Booking Fee Refund Guarantee',
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setNotice(`Refunded 100% booking fee (${formatVndExact(json.refund.refundAmountVnd)}).`);
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
      setNotice('CRM record saved.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#E5DFD3] bg-[#0F392E] p-7 text-white lacquer-shadow">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
            <ShieldCheck className="h-4 w-4" /> Platform Operations, Verification Tiers & 30m Zalo SLA
          </span>
          <h1 className="font-serif-display mt-2 text-3xl font-semibold">
            {isVi ? 'Trung tâm Kiểm duyệt, Xác minh Wi-Fi & CRM' : 'Admin Moderation, Wi-Fi Certification & CRM'}
          </h1>
        </div>
        <Link
          href="/admin/demo"
          className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
        >
          Internal Role Switcher →
        </Link>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-sm font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{notice}</span>
        </div>
      )}

      {/* Ops & 30-minute Zalo SLA Alert Feed */}
      <section className="space-y-4 rounded-3xl border border-[#C25E28]/30 bg-white p-6">
        <h2 className="font-serif-display flex items-center gap-2 text-2xl font-semibold text-[#17221E]">
          <Bell className="h-5 w-5 text-[#C25E28]" />
          {isVi ? 'Nhật ký Cảnh báo & Xác nhận Zalo 30 phút' : 'Booking Confirmation & 30-Min Zalo SLA Alert Log'}
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
                  {n.recipientRole} · {n.channel}
                </span>
                <span className="font-semibold text-[#17221E]">{n.subject}</span>
              </div>
              <span className="text-[#53635D]">
                {n.recipientContact} · {n.createdAt.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Stay Partner Applications Queue */}
      <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
        <h2 className="font-serif-display flex items-center gap-2 text-2xl font-semibold text-[#17221E]">
          <ClipboardCheck className="h-5 w-5 text-[#C25E28]" />
          {isVi ? 'Hàng đợi duyệt hồ sơ Chủ nhà mới (€39)' : 'Host Stay Applications Queue'}
        </h2>
        <div className="space-y-3">
          {data.applications.map((app) => (
            <div
              key={app.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 sm:flex-row sm:items-center"
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-[#164E3F] px-2.5 py-0.5 text-white uppercase">
                    {app.status}
                  </span>
                  <span className="text-[#C25E28]">{app.businessModel}</span>
                  <span className="text-[#53635D]">{app.measuredDownloadMbps} Mbps</span>
                </div>
                <div className="mt-1 font-semibold text-[#17221E]">
                  {app.stayName} ({app.businessName})
                </div>
                <div className="text-xs text-[#53635D]">
                  {app.applicantName} · {app.applicantEmail} · {app.destinationSlug} · {app.reviewNote}
                </div>
              </div>
              {app.status === 'submitted' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleReview(app.id, 'approved')}
                    className="rounded-xl bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Approve & Publish
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(app.id, 'rejected')}
                    className="rounded-xl border border-[#C25E28]/40 px-4 py-2 text-xs font-semibold text-[#C25E28]"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Live Inventory, Speedtest Proof & Verification Tier Audit */}
      <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
        <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Kho chỗ ở, Cấp độ Xác minh & iCal' : 'Stay Inventory, Verification Tier & iCal Audit'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs sm:text-sm">
            <thead className="border-b border-[#E5DFD3] text-xs uppercase text-[#53635D]">
              <tr>
                <th className="py-2 pr-4">Stay</th>
                <th className="py-2 pr-4">Host</th>
                <th className="py-2 pr-4">Wi-Fi & Proof</th>
                <th className="py-2 pr-4">Verification Tier</th>
                <th className="py-2">Status</th>
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
                      {s.destinationNameEn} · iCal: {s.icalSyncStatus}
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
                          Speedtest Proof
                        </a>
                      )}
                      {s.workspaceVideoUrl && (
                        <a href={s.workspaceVideoUrl} target="_blank" rel="noopener noreferrer" className="text-[#C25E28] underline">
                          Workspace Tour
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
                      <option value="VIETNOMAD_CERTIFIED">VIETNOMAD_CERTIFIED</option>
                      <option value="HOST_VERIFIED">HOST_VERIFIED</option>
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
                      <option value="live">Live</option>
                      <option value="limited">Limited</option>
                      <option value="paused">Paused</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bookings & 100% Wi-Fi Guarantee Disputes */}
      <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
        <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Đơn đặt phòng (12% Online / 88% Tại chỗ) & Bảo chứng Wi-Fi' : 'Recent Bookings (12% Online / Pay at Check-in)'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-[#E5DFD3] uppercase text-[#53635D]">
              <tr>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Stay & Guest</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">12% Online Fee</th>
                <th className="py-2 pr-3">Pay at Check-in</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {data.recentBookings.map((b) => (
                <tr key={b.id}>
                  <td className="py-2.5 pr-3 font-bold text-[#164E3F]">{b.bookingCode}</td>
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold">{b.stayTitleEn}</div>
                    <div className="text-[#53635D]">{b.guestName} · {b.nights}N</div>
                  </td>
                  <td className="py-2.5 pr-3 font-semibold">{b.status}</td>
                  <td className="py-2.5 pr-3 font-semibold text-[#164E3F]">{formatVndExact(b.feeOnlineVnd)}</td>
                  <td className="py-2.5 pr-3">{formatVndExact(b.payAtCheckinVnd)}</td>
                  <td className="py-2.5">
                    {(b.status === 'RESERVED_LOCKED' || b.status === 'confirmed') && (
                      <button
                        type="button"
                        onClick={() => handleBookingMismatchRefund(b.id)}
                        className="rounded-lg border border-[#C25E28]/40 px-2.5 py-1 font-semibold text-[#C25E28] hover:bg-[#FAEDE5]"
                      >
                        100% Wi-Fi Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Admin CRM */}
      <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
        <h2 className="font-serif-display flex items-center gap-2 text-2xl font-semibold text-[#17221E]">
          <Users className="h-5 w-5 text-[#164E3F]" />
          {isVi ? 'CRM Quản trị Khách hàng & Đối tác' : 'Member & Partner CRM'}
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
                    {u.role} · {u.membershipTier}
                  </span>
                </div>
                <div className="text-xs text-[#53635D]">
                  {u.email} · {u.nationality} · {u.bookingCount} bookings · {formatVndExact(u.totalSpentVnd)}
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
                  <option value="lead">Lead</option>
                  <option value="active">Active</option>
                  <option value="vip">VIP</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="paused">Paused</option>
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
                  Save CRM
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
