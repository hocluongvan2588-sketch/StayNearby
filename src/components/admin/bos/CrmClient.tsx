'use client';

import { useState } from 'react';
import {
  ArrowRightCircle,
  Columns3,
  List,
  Lock,
  Plus,
  ShieldCheck,
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
import type {
  getGuestDetail360,
  getHostDetail360,
  listGuestsCrm,
  listHostLeads,
  listHostsCrm,
  listLocalPartners,
} from '@/modules/admin-bos';
import { HOST_LEAD_STAGES, type HostLeadStage } from '@/lib/admin-constants';

type HostsList = Awaited<ReturnType<typeof listHostsCrm>>;
type Host360 = Awaited<ReturnType<typeof getHostDetail360>>;
type GuestsList = Awaited<ReturnType<typeof listGuestsCrm>>;
type Guest360 = Awaited<ReturnType<typeof getGuestDetail360>>;
type LeadsList = Awaited<ReturnType<typeof listHostLeads>>;
type PartnersData = Awaited<ReturnType<typeof listLocalPartners>>;

export function HostCrmView({
  initialHosts,
  hasPiiAccess,
}: {
  initialHosts: HostsList;
  hasPiiAccess: boolean;
}) {
  const [hosts, setHosts] = useState(initialHosts);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<Host360 | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [crmStage, setCrmStage] = useState<'lead' | 'active' | 'vip' | 'follow_up' | 'paused'>('active');
  const [crmNote, setCrmNote] = useState('');
  const [kycVerified, setKycVerified] = useState(false);
  const [riskFlag, setRiskFlag] = useState<'none' | 'watch' | 'restricted'>('none');
  const [activitySummary, setActivitySummary] = useState('');
  const [saving, setSaving] = useState(false);

  async function openHost360(hostId: string) {
    setDrawerOpen(true);
    const res = await fetch(`/api/admin/crm/hosts/${hostId}`);
    if (res.ok) {
      const d = (await res.json()) as Host360;
      setDetail(d);
      setCrmStage(
        (d.host.crmStage as 'lead' | 'active' | 'vip' | 'follow_up' | 'paused') || 'active'
      );
      setCrmNote(d.host.crmNote || '');
      setKycVerified(d.host.kycVerified);
      setRiskFlag((d.host.riskFlag as 'none' | 'watch' | 'restricted') || 'none');
    }
  }

  async function saveProfile() {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/hosts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: detail.host.id,
          crmStage,
          crmNote,
          kycVerified,
          riskFlag,
        }),
      });
      if (res.ok) {
        setHosts((prev) =>
          prev.map((h) =>
            h.id === detail.host.id
              ? { ...h, crmStage, crmNote, kycVerified, riskFlag }
              : h
          )
        );
        await openHost360(detail.host.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!detail || !activitySummary.trim()) return;
    const res = await fetch('/api/admin/crm/hosts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entityId: detail.host.id,
        activityType: 'note',
        summary: activitySummary.trim(),
      }),
    });
    if (res.ok) {
      setActivitySummary('');
      await openHost360(detail.host.id);
    }
  }

  const filtered = hosts.filter((h) => {
    if (stageFilter !== 'all' && h.crmStage !== stageFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        h.fullName.toLowerCase().includes(q) ||
        h.displayName.toLowerCase().includes(q) ||
        h.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pageSize = 20;
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <PageHeader
        title="Host CRM"
        subtitle={`Supply partners, KYC verification, properties performance, and interaction timeline${
          !hasPiiAccess ? ' · Contact PII Masked' : ''
        }`}
      />

      <SavedViewToolbar
        moduleKey="host_crm"
        currentFilters={{ stageFilter }}
        onApplyFilters={(f) => {
          if (typeof f.stageFilter === 'string') setStageFilter(f.stageFilter);
        }}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search hosts by name or email..."
        extraControls={
          <select
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs"
          >
            <option value="all">All CRM stages</option>
            <option value="active">Active</option>
            <option value="vip">VIP</option>
            <option value="follow_up">Follow up</option>
            <option value="lead">Lead</option>
            <option value="paused">Paused</option>
          </select>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
              <tr>
                <th className="px-4 py-2.5">Host / Brand</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Stage</th>
                <th className="px-4 py-2.5">KYC / Risk</th>
                <th className="px-4 py-2.5 text-right">Listings</th>
                <th className="px-4 py-2.5 text-right">Bookings</th>
                <th className="px-4 py-2.5 text-right">GMV</th>
                <th className="px-4 py-2.5 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {pageItems.map((h) => (
                <tr key={h.id} className="hover:bg-[#FAF8F3]/60">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[#17221E]">{h.displayName}</div>
                    <div className="text-[11px] text-[#53635D]">{h.fullName}</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#53635D]">
                    <div>{h.email}</div>
                    <div>{h.phone || h.whatsappNumber || '—'}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge label={h.crmStage} tone={statusToTone(h.crmStage)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge
                        label={h.kycVerified ? 'verified' : 'unverified'}
                        tone={h.kycVerified ? 'emerald' : 'neutral'}
                      />
                      {h.riskFlag !== 'none' && (
                        <StatusBadge label={h.riskFlag} tone={statusToTone(h.riskFlag)} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#17221E]">
                    {h.liveStaysCount} / {h.staysCount}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#17221E]">
                    {h.bookingsCount}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[#164E3F]">
                    {fmtVnd(h.gmvVnd)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => openHost360(h.id)}
                      className="rounded border border-[#E5DFD3] px-2.5 py-1 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
                    >
                      Host 360
                    </button>
                  </td>
                </tr>
              ))}
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
        title={detail ? detail.host.displayName : 'Loading Host 360...'}
        subtitle={detail ? `${detail.host.fullName} · ${detail.host.email}` : undefined}
      >
        {detail && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] p-3">
              <div>
                <div className="text-[11px] text-[#53635D]">Phone / Zalo</div>
                <div className="font-medium text-[#17221E]">
                  {detail.host.phone || '—'} / {detail.host.zaloHandle || '—'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-[#53635D]">Payout Account</div>
                <div className="font-medium text-[#17221E]">
                  {detail.host.payoutBankName || 'Not set'} {detail.host.payoutAccountMasked}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-[#E5DFD3] p-3.5">
              <div className="font-semibold text-[#17221E]">CRM & Risk Controls</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-[#53635D]">CRM Stage</label>
                  <select
                    value={crmStage}
                    onChange={(e) =>
                      setCrmStage(
                        e.target.value as 'lead' | 'active' | 'vip' | 'follow_up' | 'paused'
                      )
                    }
                    className="h-8 w-full rounded border border-[#E5DFD3] px-2"
                  >
                    <option value="lead">Lead</option>
                    <option value="active">Active</option>
                    <option value="vip">VIP</option>
                    <option value="follow_up">Follow up</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#53635D]">Risk Flag</label>
                  <select
                    value={riskFlag}
                    onChange={(e) =>
                      setRiskFlag(e.target.value as 'none' | 'watch' | 'restricted')
                    }
                    className="h-8 w-full rounded border border-[#E5DFD3] px-2"
                  >
                    <option value="none">None</option>
                    <option value="watch">Watch</option>
                    <option value="restricted">Restricted</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex h-8 w-full cursor-pointer items-center gap-2 rounded border border-[#E5DFD3] px-2.5">
                    <input
                      type="checkbox"
                      checked={kycVerified}
                      onChange={(e) => setKycVerified(e.target.checked)}
                    />
                    <span>KYC Verified</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-[#53635D]">Internal CRM Note</label>
                <textarea
                  rows={2}
                  value={crmNote}
                  onChange={(e) => setCrmNote(e.target.value)}
                  className="w-full rounded border border-[#E5DFD3] p-2"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={saveProfile}
                className="h-8 rounded bg-[#164E3F] px-3 font-semibold text-white hover:bg-[#0F392E]"
              >
                {saving ? 'Saving...' : 'Update Host CRM'}
              </button>
            </div>

            <div>
              <div className="mb-2 font-semibold text-[#17221E]">
                Properties ({detail.stays.length})
              </div>
              <div className="divide-y divide-[#E5DFD3] rounded-lg border border-[#E5DFD3]">
                {detail.stays.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2">
                    <span className="font-medium text-[#17221E]">{s.titleEn}</span>
                    <StatusBadge label={s.status} tone={statusToTone(s.status)} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 font-semibold text-[#17221E]">Activity Log</div>
              <form onSubmit={addNote} className="mb-2 flex gap-2">
                <input
                  value={activitySummary}
                  onChange={(e) => setActivitySummary(e.target.value)}
                  placeholder="Add interaction note..."
                  className="h-8 flex-1 rounded border border-[#E5DFD3] px-2.5"
                />
                <button
                  type="submit"
                  className="h-8 rounded border border-[#E5DFD3] bg-[#FAF8F3] px-3 font-medium"
                >
                  Log
                </button>
              </form>
              <div className="space-y-1.5">
                {detail.activities.map((a) => (
                  <div key={a.id} className="rounded border border-[#E5DFD3] bg-[#FAF8F3] p-2.5">
                    <div className="flex justify-between font-medium text-[#17221E]">
                      <span>{a.summary}</span>
                      <span className="text-[10px] text-[#53635D]">
                        {a.createdAt.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}

export function GuestCrmView({
  initialGuests,
  hasPiiAccess,
}: {
  initialGuests: GuestsList;
  hasPiiAccess: boolean;
}) {
  const [guests, setGuests] = useState(initialGuests);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [detail, setDetail] = useState<Guest360 | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [crmStage, setCrmStage] = useState<'lead' | 'active' | 'vip' | 'follow_up' | 'paused'>('active');
  const [riskFlag, setRiskFlag] = useState<'none' | 'watch' | 'restricted'>('none');
  const [crmNote, setCrmNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function openGuest360(guestId: string) {
    setDrawerOpen(true);
    const res = await fetch(`/api/admin/crm/guests/${guestId}`);
    if (res.ok) {
      const d = (await res.json()) as Guest360;
      setDetail(d);
      setCrmStage(
        (d.guest.crmStage as 'lead' | 'active' | 'vip' | 'follow_up' | 'paused') || 'active'
      );
      setRiskFlag((d.guest.riskFlag as 'none' | 'watch' | 'restricted') || 'none');
      setCrmNote(d.guest.crmNote || '');
    }
  }

  async function saveGuest() {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/guests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: detail.guest.id,
          crmStage,
          riskFlag,
          crmNote,
        }),
      });
      if (res.ok) {
        setGuests((prev) =>
          prev.map((g) =>
            g.id === detail.guest.id ? { ...g, crmStage, riskFlag, crmNote } : g
          )
        );
        await openGuest360(detail.guest.id);
      }
    } finally {
      setSaving(false);
    }
  }

  const filtered = guests.filter((g) => {
    if (tierFilter !== 'all' && g.membershipTier !== tierFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return g.fullName.toLowerCase().includes(q) || g.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Guest CRM (Customer 360)"
        subtitle="Long-stay guest accounts, booking spend, cancellations, and trust flags."
        actions={
          !hasPiiAccess ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#E5DFD3] bg-white px-2.5 py-1 text-xs text-[#53635D]">
              <Lock className="h-3.5 w-3.5" />
              PII Masked by RBAC
            </span>
          ) : undefined
        }
      />

      <SavedViewToolbar
        moduleKey="guest_crm"
        currentFilters={{ tierFilter }}
        onApplyFilters={(f) => {
          if (typeof f.tierFilter === 'string') setTierFilter(f.tierFilter);
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search guests..."
        extraControls={
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs"
          >
            <option value="all">All tiers</option>
            <option value="free">Free</option>
            <option value="nomad_plus">Nomad+</option>
          </select>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Guest</th>
              <th className="px-4 py-2.5">Email / Nationality</th>
              <th className="px-4 py-2.5">Tier</th>
              <th className="px-4 py-2.5">Stage / Risk</th>
              <th className="px-4 py-2.5 text-right">Bookings</th>
              <th className="px-4 py-2.5 text-right">Total Spend</th>
              <th className="px-4 py-2.5 text-right">Profile</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-[#53635D]">
                  No registered guest records match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((g) => (
                <tr key={g.id} className="hover:bg-[#FAF8F3]/60">
                  <td className="px-4 py-2.5 font-medium text-[#17221E]">{g.fullName}</td>
                  <td className="px-4 py-2.5 text-xs text-[#53635D]">
                    {g.email} · {g.nationality}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      label={g.membershipTier}
                      tone={g.membershipTier === 'nomad_plus' ? 'terracotta' : 'neutral'}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      <StatusBadge label={g.crmStage} tone={statusToTone(g.crmStage)} />
                      {g.riskFlag !== 'none' && (
                        <StatusBadge label={g.riskFlag} tone={statusToTone(g.riskFlag)} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[#17221E]">
                    {g.bookingsCount} ({g.cancelledCount} canc.)
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[#164E3F]">
                    {fmtVnd(g.totalSpentVnd)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => openGuest360(g.id)}
                      className="rounded border border-[#E5DFD3] px-2.5 py-1 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
                    >
                      Guest 360
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SideDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDetail(null);
        }}
        title={detail ? detail.guest.fullName : 'Loading Guest 360...'}
        subtitle={detail ? `${detail.guest.email} · ${detail.guest.nationality}` : undefined}
      >
        {detail && (
          <div className="space-y-4 text-xs">
            <div className="space-y-2.5 rounded-lg border border-[#E5DFD3] p-3.5">
              <div className="font-semibold text-[#17221E]">Customer Classification</div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={crmStage}
                  onChange={(e) =>
                    setCrmStage(
                      e.target.value as 'lead' | 'active' | 'vip' | 'follow_up' | 'paused'
                    )
                  }
                  className="h-8 rounded border border-[#E5DFD3] px-2"
                >
                  <option value="lead">Lead</option>
                  <option value="active">Active</option>
                  <option value="vip">VIP</option>
                  <option value="follow_up">Follow up</option>
                  <option value="paused">Paused</option>
                </select>
                <select
                  value={riskFlag}
                  onChange={(e) =>
                    setRiskFlag(e.target.value as 'none' | 'watch' | 'restricted')
                  }
                  className="h-8 rounded border border-[#E5DFD3] px-2"
                >
                  <option value="none">Risk: None</option>
                  <option value="watch">Risk: Watch</option>
                  <option value="restricted">Risk: Restricted</option>
                </select>
              </div>
              <textarea
                rows={2}
                value={crmNote}
                onChange={(e) => setCrmNote(e.target.value)}
                placeholder="Guest internal note..."
                className="w-full rounded border border-[#E5DFD3] p-2"
              />
              <button
                type="button"
                disabled={saving}
                onClick={saveGuest}
                className="h-8 rounded bg-[#164E3F] px-3 font-semibold text-white"
              >
                {saving ? 'Saving...' : 'Save Guest Profile'}
              </button>
            </div>

            <div>
              <div className="mb-2 font-semibold text-[#17221E]">
                Bookings History ({detail.bookings.length})
              </div>
              <div className="divide-y divide-[#E5DFD3] rounded-lg border border-[#E5DFD3]">
                {detail.bookings.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2">
                    <div>
                      <div className="font-medium text-[#17221E]">
                        {b.bookingCode} · {b.stayTitle}
                      </div>
                      <div className="text-[11px] text-[#53635D]">
                        {b.checkIn} to {b.checkOut} ({b.nights}n)
                      </div>
                    </div>
                    <div className="text-right">
                      <StatusBadge label={b.bookingStatus} tone={statusToTone(b.bookingStatus)} />
                      <div className="mt-1 font-medium tabular-nums">{fmtVnd(b.guestTotalVnd)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </SideDrawer>
    </div>
  );
}

export function HostAcquisitionView({ initialLeads }: { initialLeads: LeadsList }) {
  const [leads, setLeads] = useState(initialLeads);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [destinationSlug, setDestinationSlug] = useState('da-nang');
  const [estimatedUnits, setEstimatedUnits] = useState(5);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  async function refresh() {
    const res = await fetch('/api/admin/crm/acquisition');
    if (res.ok) {
      const d = (await res.json()) as { leads: LeadsList };
      setLeads(d.leads);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/crm/acquisition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          contactName,
          email,
          phone,
          destinationSlug,
          estimatedUnits,
          notes,
        }),
      });
      if (res.ok) {
        setCreateOpen(false);
        setBusinessName('');
        setContactName('');
        setEmail('');
        await refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function moveStage(leadId: string, stage: HostLeadStage) {
    const res = await fetch('/api/admin/crm/acquisition', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', leadId, stage }),
    });
    if (res.ok) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    }
  }

  async function convertToHost(leadId: string) {
    const res = await fetch('/api/admin/crm/acquisition', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert', leadId }),
    });
    if (res.ok) {
      const d = (await res.json()) as {
        hostUserId: string;
        createdNewAccount: boolean;
        stage: HostLeadStage;
      };
      setToast(
        d.createdNewAccount
          ? `Converted to new Host CRM account (${d.hostUserId.slice(0, 8)}).`
          : `Linked to existing Host CRM account (${d.hostUserId.slice(0, 8)}).`
      );
      await refresh();
    }
  }

  const filtered = leads.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.businessName.toLowerCase().includes(q) ||
      l.contactName.toLowerCase().includes(q) ||
      l.destinationSlug.toLowerCase().includes(q)
    );
  });

  const activeKanbanStages = HOST_LEAD_STAGES.slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Host Acquisition Pipeline"
        subtitle="Track prospective hosts from inbound lead through KYC, onboarding, and non-duplicative Host CRM conversion."
        actions={
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-md border border-[#E5DFD3] bg-white p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
                  viewMode === 'kanban' ? 'bg-[#164E3F] text-white' : 'text-[#53635D]'
                }`}
              >
                <Columns3 className="h-3.5 w-3.5" />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
                  viewMode === 'table' ? 'bg-[#164E3F] text-white' : 'text-[#53635D]'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Table
              </button>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white hover:bg-[#0F392E]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add host lead
            </button>
          </div>
        }
      />

      {toast && (
        <div className="mb-3 rounded-md border border-[#CBE1D6] bg-[#E7F1EC] px-3 py-2 text-xs font-medium text-[#164E3F]">
          {toast}
        </div>
      )}

      <SavedViewToolbar
        moduleKey="host_acquisition"
        currentFilters={{ viewMode }}
        onApplyFilters={(f) => {
          if (f.viewMode === 'kanban' || f.viewMode === 'table') setViewMode(f.viewMode);
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search lead property or contact..."
      />

      {viewMode === 'kanban' ? (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {activeKanbanStages.map((stage) => {
            const stageLeads = filtered.filter((l) => l.stage === stage);
            return (
              <div
                key={stage}
                className="w-64 shrink-0 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3]"
              >
                <div className="flex items-center justify-between border-b border-[#E5DFD3] bg-white px-3 py-2 rounded-t-lg">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#17221E]">
                    {stage.replace(/_/g, ' ')}
                  </span>
                  <span className="rounded bg-[#FAF8F3] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#53635D]">
                    {stageLeads.length}
                  </span>
                </div>
                <div className="space-y-2 p-2">
                  {stageLeads.map((l) => (
                    <div
                      key={l.id}
                      className="rounded-md border border-[#E5DFD3] bg-white p-2.5 text-xs space-y-1.5"
                    >
                      <div className="font-semibold text-[#17221E]">{l.businessName}</div>
                      <div className="text-[11px] text-[#53635D]">
                        {l.contactName} · {l.estimatedUnits} units · {l.destinationSlug}
                      </div>
                      {(l.applicationId || l.sourceDetail || l.utmSource) && (
                        <div className="flex flex-wrap gap-1 text-[10px] text-[#53635D]">
                          {l.applicationId && (
                            <span className="rounded bg-[#E7F1EC] px-1.5 py-0.5 font-medium text-[#164E3F]">
                              App Linked
                            </span>
                          )}
                          {l.utmSource && (
                            <span className="rounded bg-[#FAF8F3] px-1.5 py-0.5">
                              UTM: {l.utmSource}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-1 pt-1">
                        <StatusBadge label={`KYC:${l.kycStatus}`} tone={statusToTone(l.kycStatus)} />
                        <select
                          value={l.stage}
                          onChange={(e) => moveStage(l.id, e.target.value as HostLeadStage)}
                          className="rounded border border-[#E5DFD3] bg-[#FAF8F3] px-1 py-0.5 text-[10px]"
                        >
                          {HOST_LEAD_STAGES.map((st) => (
                            <option key={st} value={st}>
                              {st.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </div>
                      {!l.linkedUserId ? (
                        <button
                          type="button"
                          onClick={() => convertToHost(l.id)}
                          className="mt-1 flex w-full items-center justify-center gap-1 rounded border border-[#CBE1D6] bg-[#E7F1EC] py-1 text-[11px] font-semibold text-[#164E3F] hover:bg-[#d8ebdf]"
                        >
                          <ArrowRightCircle className="h-3 w-3" />
                          Convert to Host
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-[10px] font-medium text-[#164E3F]">
                          <ShieldCheck className="h-3 w-3" />
                          Linked to Host Account
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
              <tr>
                <th className="px-4 py-2.5">Property / Lead</th>
                <th className="px-4 py-2.5">Contact</th>
                <th className="px-4 py-2.5">Destination</th>
                <th className="px-4 py-2.5">Units</th>
                <th className="px-4 py-2.5">Stage</th>
                <th className="px-4 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-[#FAF8F3]/60">
                  <td className="px-4 py-2.5 font-medium text-[#17221E]">{l.businessName}</td>
                  <td className="px-4 py-2.5 text-xs text-[#53635D]">
                    {l.contactName} ({l.email})
                  </td>
                  <td className="px-4 py-2.5 text-xs text-[#17221E]">{l.destinationSlug}</td>
                  <td className="px-4 py-2.5 tabular-nums">{l.estimatedUnits}</td>
                  <td className="px-4 py-2.5">
                    <select
                      value={l.stage}
                      onChange={(e) => moveStage(l.id, e.target.value as HostLeadStage)}
                      className="rounded border border-[#E5DFD3] bg-white px-2 py-1 text-xs"
                    >
                      {HOST_LEAD_STAGES.map((st) => (
                        <option key={st} value={st}>
                          {st.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!l.linkedUserId ? (
                      <button
                        type="button"
                        onClick={() => convertToHost(l.id)}
                        className="rounded bg-[#164E3F] px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        Convert to Host
                      </button>
                    ) : (
                      <StatusBadge label="converted" tone="emerald" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog open={createOpen} onClose={() => setCreateOpen(false)} title="Add Host Lead">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-medium">Business / Property Name</label>
            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium">Contact Person</label>
              <input
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-medium">Phone / Zalo</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium">Destination</label>
              <select
                value={destinationSlug}
                onChange={(e) => setDestinationSlug(e.target.value)}
                className="h-8 w-full rounded border border-[#E5DFD3] px-2"
              >
                <option value="da-nang">Da Nang</option>
                <option value="hanoi">Hanoi</option>
                <option value="ho-chi-minh-city">Ho Chi Minh City</option>
                <option value="hoi-an">Hoi An</option>
                <option value="da-lat">Da Lat</option>
                <option value="phu-quoc">Phu Quoc</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">Est. Units</label>
              <input
                type="number"
                min={1}
                value={estimatedUnits}
                onChange={(e) => setEstimatedUnits(Number(e.target.value))}
                className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block font-medium">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded border border-[#E5DFD3] p-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white"
            >
              Create Lead
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function LocalPartnersView({ initialData }: { initialData: PartnersData }) {
  const [partners, setPartners] = useState(initialData.partners);
  const [createOpen, setCreateOpen] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('coworking');
  const [destinationId, setDestinationId] = useState(initialData.destinations[0]?.id ?? '');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [perkOffer, setPerkOffer] = useState('');

  async function refresh() {
    const res = await fetch('/api/admin/crm/partners');
    if (res.ok) {
      const d = (await res.json()) as PartnersData;
      setPartners(d.partners);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/crm/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName,
        category,
        destinationId: destinationId || null,
        contactName,
        contactEmail,
        perkOffer,
        partnershipStatus: 'in_discussion',
      }),
    });
    if (res.ok) {
      setCreateOpen(false);
      setBusinessName('');
      setPerkOffer('');
      await refresh();
    }
  }

  async function updateStatus(partnerId: string, partnershipStatus: string) {
    const res = await fetch('/api/admin/crm/partners', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partnerId, partnershipStatus }),
    });
    if (res.ok) {
      setPartners((prev) =>
        prev.map((p) => (p.id === partnerId ? { ...p, partnershipStatus } : p))
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="Local Partners CRM"
        subtitle="Partner businesses, cafes, workspaces, fitness studios, and local services linked to destination pages."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white hover:bg-[#0F392E]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add partner
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Business</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Destination</th>
              <th className="px-4 py-2.5">Member Perk</th>
              <th className="px-4 py-2.5">Linked Places</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {partners.map((p) => (
              <tr key={p.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-[#17221E]">{p.businessName}</div>
                  <div className="text-[11px] text-[#53635D]">
                    {p.contactName} · {p.contractRef || 'No contract ref'}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs capitalize text-[#53635D]">
                  {p.category.replace('_', ' ')}
                </td>
                <td className="px-4 py-2.5 text-xs text-[#17221E]">{p.destinationName}</td>
                <td className="max-w-xs px-4 py-2.5 text-xs text-[#53635D]">
                  {p.perkOffer || '—'}
                </td>
                <td className="px-4 py-2.5 tabular-nums text-xs">{p.placesCount}</td>
                <td className="px-4 py-2.5">
                  <select
                    value={p.partnershipStatus}
                    onChange={(e) => updateStatus(p.id, e.target.value)}
                    className="rounded border border-[#E5DFD3] bg-white px-2 py-1 text-xs"
                  >
                    <option value="prospect">Prospect</option>
                    <option value="in_discussion">In Discussion</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="ended">Ended</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDialog open={createOpen} onClose={() => setCreateOpen(false)} title="Add Local Partner">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-medium">Business Name</label>
            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-8 w-full rounded border border-[#E5DFD3] px-2"
              >
                <option value="coworking">Coworking</option>
                <option value="cafe">Cafe</option>
                <option value="restaurant">Restaurant</option>
                <option value="gym_yoga">Gym / Yoga</option>
                <option value="transport">Transport</option>
                <option value="experience">Experience</option>
                <option value="essential">Essential</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-medium">Destination</label>
              <select
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                className="h-8 w-full rounded border border-[#E5DFD3] px-2"
              >
                {initialData.destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nameEn}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Contact Name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
            <input
              placeholder="Contact Email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium">Member Perk / Offer</label>
            <input
              value={perkOffer}
              onChange={(e) => setPerkOffer(e.target.value)}
              className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Save Partner
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
