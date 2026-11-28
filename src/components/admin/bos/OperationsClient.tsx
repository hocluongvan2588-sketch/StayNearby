'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Plus,
  ShieldAlert,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  ModalDialog,
  PageHeader,
  PaginationBar,
  SavedViewToolbar,
  SideDrawer,
  StatusBadge,
  fmtVnd,
  statusToTone,
} from './BosPrimitives';
import { AdminServiceRequestsPanel } from './AdminServiceRequestsPanel';
import type {
  getBookingDetail360,
  listAdminBookings,
  listAdminListings,
  listAdminReviews,
  listSafetyReports,
  listSupportTickets,
  StayLifecycleStatus,
} from '@/modules/admin-bos';
import type { PendingRevisionSummary } from '@/modules/listing-revisions';

type ListingsData = Awaited<ReturnType<typeof listAdminListings>>;
type BookingsList = Awaited<ReturnType<typeof listAdminBookings>>;
type Booking360 = Awaited<ReturnType<typeof getBookingDetail360>>;
type ReviewsList = Awaited<ReturnType<typeof listAdminReviews>>;
type TicketsList = Awaited<ReturnType<typeof listSupportTickets>>;
type SafetyList = Awaited<ReturnType<typeof listSafetyReports>>;

export function ListingsModerationView({
  initialData,
  initialRevisions,
}: {
  initialData: ListingsData;
  initialRevisions: PendingRevisionSummary[];
}) {
  const [stays, setStays] = useState(initialData.stays);
  const [apps, setApps] = useState(initialData.applications);
  const [revisions, setRevisions] = useState<PendingRevisionSummary[]>(initialRevisions);
  const [tab, setTab] = useState<'listings' | 'applications'>('listings');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [selectedStay, setSelectedStay] = useState<ListingsData['stays'][number] | null>(null);
  const [editStatus, setEditStatus] = useState<StayLifecycleStatus>('live');
  const [editFeatured, setEditFeatured] = useState(false);
  const [editRank, setEditRank] = useState(100);
  const [editReason, setEditReason] = useState('');
  const [editWifi, setEditWifi] = useState(false);
  const [editWork, setEditWork] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const res = await fetch('/api/admin/operations/listings');
    if (res.ok) {
      const d = (await res.json()) as ListingsData;
      setStays(d.stays);
      setApps(d.applications);
    }
  }

  async function refreshRevisions() {
    const res = await fetch('/api/admin/operations/listings/revisions');
    if (res.ok) {
      const d = (await res.json()) as { revisions?: PendingRevisionSummary[] };
      setRevisions(d.revisions ?? []);
    }
  }

  async function reviewRevision(id: string, action: 'approve' | 'reject') {
    const note = window.prompt(
      action === 'approve' ? 'Optional approval note:' : 'Reason for rejection:'
    );
    if (note === null) return;
    const res = await fetch(`/api/admin/operations/listings/revisions/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note }),
    });
    if (res.ok) {
      await refreshRevisions();
      await refresh();
    }
  }

  function openModeration(stay: ListingsData['stays'][number]) {
    setSelectedStay(stay);
    setEditStatus(stay.status);
    setEditFeatured(stay.isFeatured);
    setEditRank(stay.featuredRank);
    setEditReason(stay.moderationReason);
    setEditWifi(stay.isWifiVerified);
    setEditWork(stay.isWorkReady);
  }

  async function saveListing() {
    if (!selectedStay) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/operations/listings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stayId: selectedStay.id,
          status: editStatus,
          isFeatured: editFeatured,
          featuredRank: editRank,
          moderationReason: editReason,
          isWifiVerified: editWifi,
          isWorkReady: editWork,
        }),
      });
      if (res.ok) {
        setSelectedStay(null);
        await refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function reviewApplication(id: string, decision: 'approved' | 'rejected') {
    const note = window.prompt(
      decision === 'approved' ? 'Optional approval note:' : 'Reason for rejection:'
    );
    if (note === null) return;
    const res = await fetch(`/api/admin/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reviewNote: note }),
    });
    if (res.ok) await refresh();
  }

  const filteredStays = stays.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.titleEn.toLowerCase().includes(q) ||
        s.slug.toLowerCase().includes(q) ||
        s.hostName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingApps = apps.filter((a) => a.status === 'submitted');

  return (
    <div>
      <PageHeader
        title="Listings & Supply Moderation"
        subtitle="Full listing lifecycle, featured placement, and optional trust badges (Wi-Fi/Work-Ready verification never blocks publication)."
      />

      {revisions.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#C25E28]">
            <ShieldAlert className="h-4 w-4" />
            Pending price/policy revisions ({revisions.length})
          </div>
          <ul className="mt-3 space-y-3">
            {revisions.map((r) => {
              const patch =
                r.snapshot && typeof r.snapshot === 'object'
                  ? ((r.snapshot as { patch?: Record<string, unknown> }).patch ?? {})
                  : {};
              return (
                <li key={r.id} className="rounded-lg border border-[#E5DFD3] bg-white p-3 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-semibold text-[#17221E]">{r.titleEn}</span>
                      <span className="ml-2 text-[#53635D]">
                        by {r.hostName} · {r.slug} · {r.stayStatus}
                      </span>
                      <div className="mt-1 text-[#53635D]">
                        {r.changedFields.join(', ')} · submitted{' '}
                        {new Date(r.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {Object.entries(patch).map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded bg-[#FAF8F3] px-1.5 py-0.5 font-mono text-[10px] text-[#17221E]"
                          >
                            {k}:{' '}
                            {typeof v === 'number' && k.includes('Vnd')
                              ? fmtVnd(v)
                              : String(v)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void reviewRevision(r.id, 'approve')}
                        className="rounded-lg bg-[#164E3F] px-3 py-1.5 font-semibold text-white hover:bg-[#0F392E]"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void reviewRevision(r.id, 'reject')}
                        className="rounded-lg border border-[#C25E28] px-3 py-1.5 font-semibold text-[#C25E28] hover:bg-[#FAEDE5]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mb-4 flex gap-3 border-b border-[#E5DFD3]">
        <button
          type="button"
          onClick={() => setTab('listings')}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === 'listings'
              ? 'border-[#164E3F] text-[#164E3F]'
              : 'border-transparent text-[#53635D]'
          }`}
        >
          All Properties ({stays.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('applications')}
          className={`border-b-2 px-3 py-2 text-xs font-semibold ${
            tab === 'applications'
              ? 'border-[#164E3F] text-[#164E3F]'
              : 'border-transparent text-[#53635D]'
          }`}
        >
          Host Applications ({pendingApps.length} pending)
        </button>
      </div>

      {tab === 'listings' ? (
        <>
          <SavedViewToolbar
            moduleKey="listings"
            currentFilters={{ statusFilter }}
            onApplyFilters={(f) => {
              if (typeof f.statusFilter === 'string') setStatusFilter(f.statusFilter);
            }}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search listings or hosts..."
            extraControls={
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs"
              >
                <option value="all">All statuses</option>
                <option value="live">Live</option>
                <option value="pending_review">Pending Review</option>
                <option value="draft">Draft</option>
                <option value="limited">Limited</option>
                <option value="paused">Paused</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
                <option value="archived">Archived</option>
              </select>
            }
          />

          <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
                <tr>
                  <th className="px-4 py-2.5">Property</th>
                  <th className="px-4 py-2.5">Host / Hub</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Featured</th>
                  <th className="px-4 py-2.5">Optional Badges</th>
                  <th className="px-4 py-2.5 text-right">Bookings</th>
                  <th className="px-4 py-2.5 text-right">Moderate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5DFD3]">
                {filteredStays.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAF8F3]/60">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-[#17221E]">{s.titleEn}</div>
                      <div className="text-[11px] text-[#53635D]">{s.slug}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#53635D]">
                      <div>{s.hostName}</div>
                      <div>{s.destinationNameEn}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={s.status} tone={statusToTone(s.status)} />
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {s.isFeatured ? (
                        <StatusBadge label={`Featured #${s.featuredRank}`} tone="terracotta" />
                      ) : (
                        <span className="text-[#53635D]">Standard</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {s.isWifiVerified && <StatusBadge label="Wi-Fi" tone="emerald" />}
                        {s.isWorkReady && <StatusBadge label="Work-Ready" tone="blue" />}
                        {!s.isWifiVerified && !s.isWorkReady && (
                          <span className="text-[#53635D]">Self-declared</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{s.bookingsCount}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openModeration(s)}
                        className="rounded border border-[#E5DFD3] px-2.5 py-1 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
                      >
                        Moderate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
              <tr>
                <th className="px-4 py-2.5">Applicant / Business</th>
                <th className="px-4 py-2.5">Stay Proposed</th>
                <th className="px-4 py-2.5">Destination</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {apps.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#53635D]">
                    No host applications submitted yet.
                  </td>
                </tr>
              ) : (
                apps.map((a) => (
                  <tr key={a.id} className="hover:bg-[#FAF8F3]/60">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-[#17221E]">{a.applicantName}</div>
                      <div className="text-[11px] text-[#53635D]">
                        {a.businessName} · {a.applicantEmail}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[#17221E]">{a.stayName}</td>
                    <td className="px-4 py-2.5 text-xs text-[#53635D]">
                      {a.destinationSlug} ({a.propertyType})
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge label={a.status} tone={statusToTone(a.status)} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {a.status === 'submitted' ? (
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => reviewApplication(a.id, 'approved')}
                            className="inline-flex items-center gap-1 rounded bg-[#164E3F] px-2.5 py-1 text-xs font-semibold text-white"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Approve & Publish
                          </button>
                          <button
                            type="button"
                            onClick={() => reviewApplication(a.id, 'rejected')}
                            className="inline-flex items-center gap-1 rounded border border-[#F4C7C3] bg-[#FDF1F0] px-2.5 py-1 text-xs font-semibold text-[#B42318]"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-[#53635D]">{a.reviewNote || 'Reviewed'}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <SideDrawer
        open={Boolean(selectedStay)}
        onClose={() => setSelectedStay(null)}
        title={selectedStay ? selectedStay.titleEn : ''}
        subtitle={selectedStay ? `Host: ${selectedStay.hostName} · ${selectedStay.slug}` : undefined}
      >
        {selectedStay && (
          <div className="space-y-4 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-[#17221E]">Listing Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as StayLifecycleStatus)}
                className="h-9 w-full rounded border border-[#E5DFD3] px-2.5"
              >
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="live">Live (Published)</option>
                <option value="limited">Limited</option>
                <option value="paused">Paused</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded border border-[#E5DFD3] p-2.5">
                <input
                  type="checkbox"
                  checked={editFeatured}
                  onChange={(e) => setEditFeatured(e.target.checked)}
                />
                <span>Featured Homepage / Hub</span>
              </label>
              <div>
                <label className="mb-1 block text-[11px] text-[#53635D]">Featured Priority Rank</label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={editRank}
                  onChange={(e) => setEditRank(Number(e.target.value))}
                  className="h-9 w-full rounded border border-[#E5DFD3] px-2.5"
                />
              </div>
            </div>

            <div className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] p-3 space-y-2">
              <div className="font-semibold text-[#17221E]">
                Optional Trust Badges (Non-blocking for publication)
              </div>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editWifi}
                    onChange={(e) => setEditWifi(e.target.checked)}
                  />
                  <span>Wi-Fi Verified</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editWork}
                    onChange={(e) => setEditWork(e.target.checked)}
                  />
                  <span>Work-Ready Verified</span>
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-[#17221E]">
                Moderation Reason / Audit Note
              </label>
              <textarea
                rows={3}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full rounded border border-[#E5DFD3] p-2.5"
              />
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={saveListing}
              className="h-9 w-full rounded-md bg-[#164E3F] font-semibold text-white hover:bg-[#0F392E]"
            >
              {saving ? 'Saving moderation...' : 'Save Moderation Changes'}
            </button>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}

export function BookingsOperationsView({ initialBookings }: { initialBookings: BookingsList }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  // Stay Extras (§14): a dedicated tab inside the bookings module — no new
  // sidebar entry.
  const [subTab, setSubTab] = useState<'bookings' | 'extras'>('bookings');

  const [detail, setDetail] = useState<Booking360 | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [bStatus, setBStatus] = useState('confirmed');
  const [sStatus, setSStatus] = useState('upcoming');
  const [pStatus, setPStatus] = useState('paid');
  const [payStatus, setPayStatus] = useState('direct_at_checkin');
  const [rStatus, setRStatus] = useState('none');
  const [dispute, setDispute] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function openBooking360(bookingId: string) {
    setDrawerOpen(true);
    const res = await fetch(`/api/admin/operations/bookings/${bookingId}`);
    if (res.ok) {
      const d = (await res.json()) as Booking360;
      setDetail(d);
      setBStatus(d.booking.bookingStatus);
      setSStatus(d.booking.stayStatus);
      setPStatus(d.booking.paymentStatus);
      setPayStatus(d.booking.payoutStatus);
      setRStatus(d.booking.refundStatus);
      setDispute(d.booking.disputeFlag);
      setReason('');
    }
  }

  async function saveAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !reason.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/operations/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: detail.booking.id,
          bookingStatus: bStatus,
          stayStatus: sStatus,
          paymentStatus: pStatus,
          payoutStatus: payStatus,
          refundStatus: rStatus,
          disputeFlag: dispute,
          reason: reason.trim(),
        }),
      });
      if (res.ok) {
        const listRes = await fetch('/api/admin/operations/bookings');
        if (listRes.ok) {
          const listData = (await listRes.json()) as { bookings: BookingsList };
          setBookings(listData.bookings);
        }
        await openBooking360(detail.booking.id);
      }
    } finally {
      setSaving(false);
    }
  }

  const filtered = bookings.filter((b) => {
    if (statusFilter !== 'all' && b.bookingStatus !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        b.bookingCode.toLowerCase().includes(q) ||
        b.stayTitle.toLowerCase().includes(q) ||
        b.guestName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pageSize = 20;
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const bookingsTabBar = (
    <div className="mb-4 flex gap-2">
      <button
        type="button"
        onClick={() => setSubTab('bookings')}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
          subTab === 'bookings'
            ? 'bg-[#164E3F] text-white'
            : 'border border-[#E5DFD3] bg-white text-[#53635D] hover:bg-[#FAF8F3]'
        }`}
      >
        Bookings
      </button>
      <button
        type="button"
        onClick={() => setSubTab('extras')}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
          subTab === 'extras'
            ? 'bg-[#164E3F] text-white'
            : 'border border-[#E5DFD3] bg-white text-[#53635D] hover:bg-[#FAF8F3]'
        }`}
      >
        Stay Extras
      </button>
    </div>
  );

  if (subTab === 'extras') {
    return (
      <div>
        <PageHeader
          title="Bookings & Stay Extras"
          subtitle="Service requests across all stays. Hosts respond in their reservation drawer; admins monitor, filter, and disable violating services."
        />
        {bookingsTabBar}
        <AdminServiceRequestsPanel />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Bookings & 5-Axis Lifecycle Sync"
        subtitle="Synced with Guest Platform and Host Console across Booking, Stay, Payment, Payout, and Refund status."
      />
      {bookingsTabBar}

      <SavedViewToolbar
        moduleKey="bookings"
        currentFilters={{ statusFilter }}
        onApplyFilters={(f) => {
          if (typeof f.statusFilter === 'string') setStatusFilter(f.statusFilter);
        }}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search booking code, guest, stay..."
        extraControls={
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs"
          >
            <option value="all">All booking statuses</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
              <tr>
                <th className="px-3 py-2.5">Code / Property</th>
                <th className="px-3 py-2.5">Guest / Dates</th>
                <th className="px-3 py-2.5">Booking</th>
                <th className="px-3 py-2.5">Stay</th>
                <th className="px-3 py-2.5">Payment</th>
                <th className="px-3 py-2.5">Payout</th>
                <th className="px-3 py-2.5">Refund</th>
                <th className="px-3 py-2.5 text-right">Fee / Total</th>
                <th className="px-3 py-2.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-xs text-[#53635D]">
                    No bookings found matching current filters.
                  </td>
                </tr>
              ) : (
                pageItems.map((b) => (
                  <tr key={b.id} className="hover:bg-[#FAF8F3]/60">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-[#17221E]">{b.bookingCode}</div>
                      <div className="max-w-[180px] truncate text-[11px] text-[#53635D]">
                        {b.stayTitle}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[#17221E]">{b.guestName}</div>
                      <div className="text-[11px] tabular-nums text-[#53635D]">
                        {b.checkIn} ({b.nights}n)
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={b.bookingStatus} tone={statusToTone(b.bookingStatus)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={b.stayStatus} tone={statusToTone(b.stayStatus)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={b.paymentStatus} tone={statusToTone(b.paymentStatus)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={b.payoutStatus} tone={statusToTone(b.payoutStatus)} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge label={b.refundStatus} tone={statusToTone(b.refundStatus)} />
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <div className="font-medium text-[#164E3F]">{fmtVnd(b.serviceFeeVnd)}</div>
                      <div className="text-[11px] text-[#53635D]">{fmtVnd(b.guestTotalVnd)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openBooking360(b.id)}
                        className="rounded border border-[#E5DFD3] px-2 py-1 text-[11px] font-medium text-[#17221E] hover:bg-[#FAF8F3]"
                      >
                        360°
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <PaginationBar
          page={page}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      </div>

      <SideDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDetail(null);
        }}
        title={detail ? `Booking ${detail.booking.bookingCode}` : 'Loading Booking 360...'}
        subtitle={
          detail ? `${detail.booking.stayTitle} · Host: ${detail.booking.hostName}` : undefined
        }
      >
        {detail && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] p-3">
              <div>
                <div className="text-[11px] text-[#53635D]">Platform Fee (Online)</div>
                <div className="font-semibold text-[#164E3F] tabular-nums">
                  {fmtVnd(detail.booking.serviceFeeVnd)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#53635D]">Pay Host at Check-in</div>
                <div className="font-semibold text-[#17221E] tabular-nums">
                  {fmtVnd(detail.booking.payAtCheckinVnd)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#53635D]">Total GMV</div>
                <div className="font-semibold text-[#17221E] tabular-nums">
                  {fmtVnd(detail.booking.guestTotalVnd)}
                </div>
              </div>
            </div>

            <form
              onSubmit={saveAdjustment}
              className="space-y-3 rounded-lg border border-[#E5DFD3] p-3.5"
            >
              <div className="font-semibold text-[#17221E]">
                Controlled 5-Axis Status Adjustment (Audited)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-[#53635D]">Booking Status</label>
                  <select
                    value={bStatus}
                    onChange={(e) => setBStatus(e.target.value)}
                    className="h-8 w-full rounded border border-[#E5DFD3] px-2"
                  >
                    <option value="pending_payment">Pending Payment</option>
                    <option value="pending_approval">Pending Approval</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#53635D]">Stay Status</label>
                  <select
                    value={sStatus}
                    onChange={(e) => setSStatus(e.target.value)}
                    className="h-8 w-full rounded border border-[#E5DFD3] px-2"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="checked_in">Checked In</option>
                    <option value="in_house">In House</option>
                    <option value="checked_out">Checked Out</option>
                    <option value="no_show">No Show</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#53635D]">Payment Status</label>
                  <select
                    value={pStatus}
                    onChange={(e) => setPStatus(e.target.value)}
                    className="h-8 w-full rounded border border-[#E5DFD3] px-2"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="partially_refunded">Partially Refunded</option>
                    <option value="refunded">Refunded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#53635D]">Payout Status</label>
                  <select
                    value={payStatus}
                    onChange={(e) => setPayStatus(e.target.value)}
                    className="h-8 w-full rounded border border-[#E5DFD3] px-2"
                  >
                    <option value="direct_at_checkin">Direct at Check-in</option>
                    <option value="pending">Pending</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="paid">Paid</option>
                    <option value="on_hold">On Hold</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dispute}
                  onChange={(e) => setDispute(e.target.checked)}
                />
                <span>Flag as Disputed Booking</span>
              </label>
              <div>
                <label className="mb-1 block text-[11px] text-[#53635D]">
                  Mandatory Audit Reason
                </label>
                <input
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why statuses are adjusted..."
                  className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="h-8 rounded bg-[#164E3F] px-3 font-semibold text-white"
              >
                {saving ? 'Applying...' : 'Apply & Audit'}
              </button>
            </form>

            {detail.auditHistory.length > 0 && (
              <div>
                <div className="mb-1.5 font-semibold text-[#17221E]">Audit History</div>
                <div className="space-y-1.5">
                  {detail.auditHistory.map((a: Record<string, unknown>) => (
                    <div key={String(a.id)} className="rounded border border-[#E5DFD3] bg-[#FAF8F3] p-2">
                      <div className="font-medium text-[#17221E]">
                        {String(a.actor_email)} · {String(a.action)}
                      </div>
                      <div className="text-[11px] text-[#53635D]">{String(a.reason ?? '')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SideDrawer>
    </div>
  );
}

export function ReviewsModerationView({ initialReviews }: { initialReviews: ReviewsList }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [search, setSearch] = useState('');

  async function handleDelete(reviewId: string) {
    const reason = window.prompt('Provide moderation reason to remove this review:');
    if (!reason?.trim()) return;
    const res = await fetch('/api/admin/operations/reviews', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId, reason }),
    });
    if (res.ok) {
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    }
  }

  const filtered = reviews.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.stayTitle.toLowerCase().includes(q) ||
      r.reviewerName.toLowerCase().includes(q) ||
      r.comment.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Reviews Moderation"
        subtitle="Guest ratings, Wi-Fi/workspace scores, and policy moderation."
      />
      <SavedViewToolbar
        moduleKey="reviews"
        currentFilters={{}}
        onApplyFilters={() => undefined}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search review text or stay..."
      />
      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Property & Reviewer</th>
              <th className="px-4 py-2.5">Scores</th>
              <th className="px-4 py-2.5">Comment</th>
              <th className="px-4 py-2.5 text-right">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-[#17221E]">{r.stayTitle}</div>
                  <div className="text-[11px] text-[#53635D]">{r.reviewerName}</div>
                </td>
                <td className="px-4 py-2.5 text-xs tabular-nums">
                  <span className="inline-flex items-center gap-1 font-semibold text-[#17221E]">
                    <Star className="h-3.5 w-3.5 text-[#A67C2E]" />
                    {r.overallRating}
                  </span>
                  <div className="text-[11px] text-[#53635D]">
                    Wi-Fi {r.wifiRating} · Desk {r.workspaceRating}
                  </div>
                </td>
                <td className="max-w-md px-4 py-2.5 text-xs text-[#17221E]">{r.comment}</td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="inline-flex items-center gap-1 rounded border border-[#F4C7C3] bg-[#FDF1F0] px-2 py-1 text-xs text-[#B42318]"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SupportTicketsView({ initialTickets }: { initialTickets: TicketsList }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<TicketsList[number] | null>(null);

  const [category, setCategory] = useState('booking_issue');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('high');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [nextStatus, setNextStatus] = useState<'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'>('in_progress');

  async function refresh() {
    const res = await fetch('/api/admin/operations/support');
    if (res.ok) {
      const d = (await res.json()) as { tickets: TicketsList };
      setTickets(d.tickets);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/operations/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, priority, subject, description }),
    });
    if (res.ok) {
      setCreateOpen(false);
      setSubject('');
      setDescription('');
      await refresh();
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const res = await fetch('/api/admin/operations/support', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: selected.id,
        status: nextStatus,
        messageBody: replyBody,
        isInternalNote: replyInternal,
        resolutionSummary: nextStatus === 'resolved' && !replyInternal ? replyBody : undefined,
      }),
    });
    if (res.ok) {
      setSelected(null);
      setReplyBody('');
      setReplyInternal(false);
      await refresh();
    }
  }

  return (
    <div>
      <PageHeader
        title="Customer Support & SLA Desk"
        subtitle="Centralized guest and host support queue with automatic SLA tasks for urgent tickets."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New ticket
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Ticket</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Priority</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">SLA Target</th>
              <th className="px-4 py-2.5 text-right">Handle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5">
                  <div className="font-semibold text-[#17221E]">
                    {t.ticketCode} · {t.subject}
                  </div>
                  <div className="text-[11px] text-[#53635D]">
                    {t.guestName || 'General'} · {t.stayTitle || t.bookingCode || 'Platform'}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs capitalize text-[#53635D]">
                  {t.category.replace('_', ' ')}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge label={t.priority} tone={statusToTone(t.priority)} />
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge label={t.status} tone={statusToTone(t.status)} />
                </td>
                <td className="px-4 py-2.5 text-xs tabular-nums text-[#53635D]">
                  {t.slaDueAt ? t.slaDueAt.slice(0, 16).replace('T', ' ') : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(t);
                      setNextStatus(
                        t.status as 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'
                      );
                    }}
                    className="rounded border border-[#E5DFD3] px-2.5 py-1 text-xs font-medium"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SideDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.ticketCode}: ${selected.subject}` : ''}
      >
        {selected && (
          <form onSubmit={handleUpdate} className="space-y-4 text-xs">
            <div className="rounded border border-[#E5DFD3] bg-[#FAF8F3] p-3 leading-relaxed">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#53635D]">
                <span>{selected.guestName || 'Guest'}</span>
                {selected.bookingCode && <span>· {selected.bookingCode}</span>}
                {selected.issueSubCategory && <span>· {selected.issueSubCategory}</span>}
              </div>
              <div>{selected.description}</div>
              {selected.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.attachments.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-[#E5DFD3] bg-white px-2 py-0.5 text-[11px] text-[#164E3F] underline"
                    >
                      Attachment #{idx + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
            {selected.messages.length > 0 && (
              <div className="max-h-56 space-y-2 overflow-y-auto rounded border border-[#E5DFD3] bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#53635D]">
                  Conversation Thread
                </div>
                {selected.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-md p-2 text-[11px] ${
                      m.isInternalNote
                        ? 'border border-[#E7C69C] bg-[#FDF7ED]'
                        : 'border border-[#E5DFD3] bg-[#FAF8F3]'
                    }`}
                  >
                    <div className="mb-0.5 flex items-center justify-between font-semibold text-[#17221E]">
                      <span>
                        {m.senderName} ({m.senderRole}) {m.isInternalNote ? '· INTERNAL NOTE' : ''}
                      </span>
                      <span className="font-normal text-[#53635D]">
                        {m.createdAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-[#17221E]">{m.body}</div>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="mb-1 block font-semibold">Status</label>
              <select
                value={nextStatus}
                onChange={(e) =>
                  setNextStatus(
                    e.target.value as 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed'
                  )
                }
                className="h-8 w-full rounded border border-[#E5DFD3] px-2"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="waiting_user">Waiting User</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold">
                {replyInternal ? 'Internal Staff Note (hidden from guest)' : 'Public Reply to Guest'}
              </label>
              <textarea
                rows={4}
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder={
                  replyInternal
                    ? 'Internal investigation note...'
                    : 'Write reply visible to guest in Member Dashboard...'
                }
                className="w-full rounded border border-[#E5DFD3] p-2.5"
              />
              <label className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[#53635D]">
                <input
                  type="checkbox"
                  checked={replyInternal}
                  onChange={(e) => setReplyInternal(e.target.checked)}
                />
                Save as internal staff note only (hidden from guest)
              </label>
            </div>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Save Update
            </button>
          </form>
        )}
      </SideDrawer>

      <ModalDialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create Support Ticket">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="booking_issue">Booking Issue</option>
              <option value="payment_refund">Payment / Refund</option>
              <option value="checkin_access">Check-in Access</option>
              <option value="listing_accuracy">Listing Accuracy</option>
              <option value="host_payout">Host Payout</option>
              <option value="other">Other</option>
            </select>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as 'low' | 'medium' | 'high' | 'urgent')
              }
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <input
            required
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <textarea
            required
            rows={3}
            placeholder="Detailed description..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded border border-[#E5DFD3] p-2.5"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Create Ticket
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function TrustSafetyView({ initialReports }: { initialReports: SafetyList }) {
  const [reports, setReports] = useState(initialReports);
  const [createOpen, setCreateOpen] = useState(false);
  const [reportType, setReportType] = useState('misleading_listing');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [summary, setSummary] = useState('');

  async function refresh() {
    const res = await fetch('/api/admin/operations/safety');
    if (res.ok) {
      const d = (await res.json()) as { reports: SafetyList };
      setReports(d.reports);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/operations/safety', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportType, severity, summary }),
    });
    if (res.ok) {
      setCreateOpen(false);
      setSummary('');
      await refresh();
    }
  }

  async function resolveReport(
    reportId: string,
    status: 'action_taken' | 'dismissed',
    suspendStay: boolean
  ) {
    const actionTaken = window.prompt('Record investigation outcome / action taken:');
    if (!actionTaken?.trim()) return;
    const res = await fetch('/api/admin/operations/safety', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportId, status, actionTaken, suspendStay }),
    });
    if (res.ok) await refresh();
  }

  return (
    <div>
      <PageHeader
        title="Trust & Safety"
        subtitle="Violation investigations, dispute resolution, and protective listing suspensions."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Log incident
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Type / Severity</th>
              <th className="px-4 py-2.5">Target</th>
              <th className="px-4 py-2.5">Summary</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {reports.map((r) => (
              <tr key={r.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5">
                  <div className="font-medium capitalize text-[#17221E]">
                    {r.reportType.replace('_', ' ')}
                  </div>
                  <StatusBadge label={r.severity} tone={statusToTone(r.severity)} />
                </td>
                <td className="px-4 py-2.5 text-xs text-[#53635D]">
                  {r.stayTitle || r.reportedUserName || r.bookingCode || 'Platform'}
                </td>
                <td className="max-w-md px-4 py-2.5 text-xs text-[#17221E]">{r.summary}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge label={r.status} tone={statusToTone(r.status)} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  {r.status === 'open' || r.status === 'investigating' ? (
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => resolveReport(r.id, 'action_taken', false)}
                        className="rounded bg-[#164E3F] px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => resolveReport(r.id, 'dismissed', false)}
                        className="rounded border border-[#E5DFD3] px-2.5 py-1 text-xs"
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-[#53635D]">{r.actionTaken}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDialog open={createOpen} onClose={() => setCreateOpen(false)} title="Log Safety Report">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="misleading_listing">Misleading Listing</option>
              <option value="suspicious_account">Suspicious Account</option>
              <option value="safety_incident">Safety Incident</option>
              <option value="dispute">Dispute</option>
              <option value="policy_violation">Policy Violation</option>
            </select>
            <select
              value={severity}
              onChange={(e) =>
                setSeverity(e.target.value as 'low' | 'medium' | 'high' | 'critical')
              }
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <textarea
            required
            rows={3}
            placeholder="Incident summary & evidence links..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full rounded border border-[#E5DFD3] p-2.5"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Submit Report
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
