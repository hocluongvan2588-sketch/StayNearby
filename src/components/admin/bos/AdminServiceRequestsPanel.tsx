'use client';

/**
 * Admin BOS — Stay Extras operations tab (§14 of the spec).
 * Overview of all service requests across the platform with filters
 * (type / host / destination / status), a not-yet-responded queue,
 * 4 summary stats, the stay-extras audit log, and the ability to switch
 * off a violating service. Quotes settled outside the platform are never
 * recorded as platform revenue — this panel shows no revenue numbers.
 */

import { useCallback, useEffect, useState } from 'react';
import { Ban, Loader2, RefreshCw } from 'lucide-react';

interface RequestRow {
  id: string;
  bookingCode: string;
  stayTitle: string;
  staySlug: string;
  guestName: string;
  hostName: string;
  catalogKey: string;
  status: string;
  stayServiceId: string;
  snapshot: Record<string, unknown>;
  quotePriceVnd: number | null;
  desiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  byStatus: Array<{ status: string; count: number }>;
  byCatalog: Array<{
    key: string;
    total: number;
    confirmedOrPreparing: number;
    completed: number;
    declinedOrCancelled: number;
  }>;
}

interface AuditLog {
  id: string;
  actor_email: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'awaiting_guest', label: 'Awaiting guest' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'completed', label: 'Completed' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CATALOG_LABELS: Record<string, string> = {
  motorbike_rental: 'Motorbike rental',
  bike_rental: 'Bicycle rental',
  airport_pickup: 'Airport pickup',
  airport_dropoff: 'Airport drop-off',
  monitor_rental: 'Monitor rental',
  work_gear_rental: 'Work gear',
  room_cleaning: 'Room cleaning',
  laundry: 'Laundry',
  coworking_pass: 'Coworking pass',
};

export function AdminServiceRequestsPanel() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [catalogKey, setCatalogKey] = useState('');
  const [hostQuery, setHostQuery] = useState('');
  const [destinationQuery, setDestinationQuery] = useState('');
  const [notRespondedOnly, setNotRespondedOnly] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [reqRes, statsRes, auditRes] = await Promise.all([
        fetch(`/api/admin/service-requests${status ? `?status=${status}` : ''}`),
        fetch('/api/admin/service-requests?view=stats'),
        fetch('/api/admin/system?scope=audit&module=stay_extras'),
      ]);
      const reqJson = await reqRes.json();
      const statsJson = await statsRes.json();
      const auditJson = auditRes.json ? await auditRes.json() : { data: {} };
      if (reqRes.ok) setRequests(reqJson?.requests ?? []);
      if (statsRes.ok) setStats(statsJson?.byStatus ? statsJson : statsJson?.data ?? null);
      const logs = auditJson?.logs ?? auditJson?.data?.logs ?? [];
      setAudit(Array.isArray(logs) ? logs.slice(0, 20) : []);
    } catch {
      setError('Failed to load service requests.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function disableService(serviceId: string) {
    if (
      !window.confirm(
        'Disable this service? Existing requests stay visible; no new requests can reference it.'
      )
    ) {
      return;
    }
    setBusyId(serviceId);
    setError('');
    try {
      const res = await fetch('/api/admin/service-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stayServiceId: serviceId, enabled: false }),
      });
      if (!res.ok) throw new Error('Failed to disable service.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  const q = (s: string) => s.toLowerCase().trim();
  const filtered = requests.filter((r) => {
    if (catalogKey && r.catalogKey !== catalogKey) return false;
    if (hostQuery && !q(r.hostName).includes(q(hostQuery))) return false;
    if (destinationQuery && !q(r.stayTitle).includes(q(destinationQuery))) return false;
    if (notRespondedOnly && r.status !== 'pending') return false;
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const confirmedCount = requests.filter(
    (r) => r.status === 'confirmed' || r.status === 'preparing'
  ).length;
  const completedCount = requests.filter((r) => r.status === 'completed').length;
  const closedCount = requests.filter(
    (r) => r.status === 'declined' || r.status === 'cancelled'
  ).length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-8 text-sm text-[#53635D]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading service requests…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* 4 summary stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-[#E5DFD3] bg-white p-3">
          <div className="text-[11px] text-[#53635D]">Awaiting response</div>
          <div className="text-xl font-bold text-amber-600">{pendingCount}</div>
        </div>
        <div className="rounded-lg border border-[#E5DFD3] bg-white p-3">
          <div className="text-[11px] text-[#53635D]">Confirmed / preparing</div>
          <div className="text-xl font-bold text-[#164E3F]">{confirmedCount}</div>
        </div>
        <div className="rounded-lg border border-[#E5DFD3] bg-white p-3">
          <div className="text-[11px] text-[#53635D]">Completed</div>
          <div className="text-xl font-bold text-[#53635D]">{completedCount}</div>
        </div>
        <div className="rounded-lg border border-[#E5DFD3] bg-white p-3">
          <div className="text-[11px] text-[#53635D]">Declined + cancelled</div>
          <div className="text-xl font-bold text-[#C25E28]">{closedCount}</div>
        </div>
      </div>

      {stats && stats.byCatalog.length > 0 && (
        <div className="rounded-lg border border-[#E5DFD3] bg-white p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
            Requests by type
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.byCatalog.map((c) => (
              <span
                key={c.key}
                className="rounded-full border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-1 text-[11px] text-[#17221E]"
              >
                {CATALOG_LABELS[c.key] ?? c.key}: <strong>{c.total}</strong>
                <span className="text-[#53635D]">
                  {' '}
                  (✓{c.confirmedOrPreparing} · ✓✓{c.completed} · ✗{c.declinedOrCancelled})
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={catalogKey}
          onChange={(e) => setCatalogKey(e.target.value)}
          className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs"
        >
          <option value="">All service types</option>
          {Object.entries(CATALOG_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={hostQuery}
          onChange={(e) => setHostQuery(e.target.value)}
          placeholder="Filter host…"
          className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs"
        />
        <input
          value={destinationQuery}
          onChange={(e) => setDestinationQuery(e.target.value)}
          placeholder="Filter stay / destination…"
          className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs"
        />
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#17221E]">
          <input
            type="checkbox"
            checked={notRespondedOnly}
            onChange={(e) => setNotRespondedOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#FF5A1F]"
          />
          Not responded yet
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-[#E5DFD3] px-2.5 py-1.5 text-xs text-[#53635D] hover:bg-[#FAF8F3]"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {/* Requests table */}
      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
              <tr>
                <th className="px-3 py-2.5">Service / Booking</th>
                <th className="px-3 py-2.5">Guest / Host</th>
                <th className="px-3 py-2.5">Stay</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Requested price</th>
                <th className="px-3 py-2.5">Desired</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-[#53635D]">
                    No service requests match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 200).map((r) => {
                  const snapPrice = r.snapshot?.priceVnd;
                  const price =
                    r.quotePriceVnd !== null
                      ? `${r.quotePriceVnd.toLocaleString('en-US')}₫`
                      : typeof snapPrice === 'number' && snapPrice > 0
                        ? `${snapPrice.toLocaleString('en-US')}₫`
                        : 'By quote';
                  return (
                    <tr key={r.id} className="align-top">
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-[#17221E]">
                          {CATALOG_LABELS[r.catalogKey] ?? r.catalogKey}
                        </div>
                        <div className="font-mono text-[11px] text-[#53635D]">{r.bookingCode}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-[#17221E]">{r.guestName}</div>
                        <div className="text-[11px] text-[#53635D]">{r.hostName}</div>
                      </td>
                      <td className="px-3 py-2.5 text-[#17221E]">{r.stayTitle}</td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full bg-[#FAF8F3] px-2 py-0.5 text-[11px] font-medium text-[#17221E]">
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[#53635D]">{price}</td>
                      <td className="px-3 py-2.5 text-[#53635D]">
                        {r.desiredAt ? r.desiredAt.slice(0, 10) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={busyId === r.stayServiceId}
                          onClick={() => void disableService(r.stayServiceId)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Disable this service (no new requests can use it)"
                        >
                          {busyId === r.stayServiceId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Ban className="h-3 w-3" />
                          )}
                          Disable service
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit log (module: stay_extras) */}
      <div className="rounded-lg border border-[#E5DFD3] bg-white p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#53635D]">
          Audit log — stay extras
        </div>
        {audit.length === 0 ? (
          <p className="text-xs text-[#53635D]">No audit entries yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {audit.map((log) => (
              <li key={log.id} className="flex flex-wrap gap-2 text-[11px] text-[#53635D]">
                <span className="font-mono">{String(log.created_at).slice(0, 16).replace('T', ' ')}</span>
                <span className="font-medium text-[#17221E]">{log.actor_email}</span>
                <span>{log.action}</span>
                <span className="font-mono">{log.entity_type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-[#53635D]">
        Quotes settled directly between guest and host are not platform revenue and are not shown
        here as revenue.
      </p>
    </div>
  );
}
