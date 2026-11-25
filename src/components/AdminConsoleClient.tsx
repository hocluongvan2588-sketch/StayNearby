'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, ShieldCheck, Users } from 'lucide-react';
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

  async function handleStayStatus(stayId: string, status: 'live' | 'limited' | 'paused') {
    const res = await fetch(`/api/admin/stays/${stayId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (json.ok) {
      setNotice(`Stay status updated to ${status}.`);
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
      <div className="rounded-3xl border border-[#E5DFD3] bg-[#0F392E] p-7 text-white lacquer-shadow">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
          <ShieldCheck className="h-4 w-4" /> Platform Operations, Verification & CRM
        </span>
        <h1 className="font-serif-display mt-2 text-3xl font-semibold">
          {isVi ? 'Trung tâm Kiểm duyệt & Quản trị CRM VietNomad' : 'Admin Moderation, Wi-Fi Audit & CRM'}
        </h1>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-sm font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{notice}</span>
        </div>
      )}

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

      {/* Live Inventory & Wi-Fi Audit */}
      <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
        <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Kho chỗ ở & Kiểm soát trạng thái' : 'Stay Inventory & Visibility Control'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-[#E5DFD3] text-xs uppercase text-[#53635D]">
              <tr>
                <th className="py-2 pr-4">Stay</th>
                <th className="py-2 pr-4">Host</th>
                <th className="py-2 pr-4">Channel</th>
                <th className="py-2 pr-4">Wi-Fi</th>
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
                    <div className="text-xs text-[#53635D]">{s.destinationNameEn}</div>
                  </td>
                  <td className="py-3 pr-4">{s.hostName}</td>
                  <td className="py-3 pr-4">{s.businessModel}</td>
                  <td className="py-3 pr-4 font-semibold">
                    {s.wifiDownloadMbps} / {s.wifiUploadMbps} Mbps
                  </td>
                  <td className="py-3">
                    <select
                      value={s.status}
                      onChange={(e) =>
                        handleStayStatus(s.id, e.target.value as 'live' | 'limited' | 'paused')
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
