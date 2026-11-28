'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  ModalDialog,
  PageHeader,
  SideDrawer,
  StatusBadge,
  statusToTone,
} from './BosPrimitives';
import type { AdminCommunityEvent, AdminEventTab, AdminEventAttendee, ModerationLogEntry } from '@/modules/admin-bos/community';
import type { EventTaxonomy } from '@/modules/platform-settings';

interface DestinationOption {
  id: string;
  nameEn: string;
  nameVi: string;
}

const TABS: Array<{ id: AdminEventTab; label: string }> = [
  { id: 'pending', label: 'Pending review' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
  { id: 'ended', label: 'Ended & cancelled' },
  { id: 'rejected', label: 'Rejected' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending review',
  published: 'Published',
  draft: 'Draft',
  ended: 'Ended',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
  rejected: 'Rejected',
};

const inputCls =
  'w-full rounded-md border border-[#E5DFD3] px-2.5 py-1.5 text-sm text-[#17221E] focus:border-[#164E3F] focus:outline-none';
const labelCls = 'mb-1 block text-[11px] font-medium text-[#53635D]';
const btnPrimary =
  'rounded-md bg-[#164E3F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0F392E] disabled:opacity-50';
const btnGhost =
  'rounded-md border border-[#E5DFD3] px-3 py-1.5 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3] disabled:opacity-50';

function fmtWhen(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

export function CommunityAdminClient({
  initialEvents,
  taxonomy,
  destinations,
  canEdit,
  canApprove,
  canCreate,
}: {
  initialEvents: AdminCommunityEvent[];
  taxonomy: EventTaxonomy;
  destinations: DestinationOption[];
  canEdit: boolean;
  canApprove: boolean;
  canCreate: boolean;
}) {
  const [tab, setTab] = useState<AdminEventTab>('pending');
  const [events, setEvents] = useState<AdminCommunityEvent[]>(initialEvents);
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminCommunityEvent | null>(null);
  const [attendees, setAttendees] = useState<AdminEventAttendee[]>([]);
  const [log, setLog] = useState<ModerationLogEntry[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(
    async (nextTab: AdminEventTab, search: string, src: string) => {
      const params = new URLSearchParams({ scope: 'list', tab: nextTab });
      if (search) params.set('q', search);
      if (src) params.set('source', src);
      const res = await fetch(`/api/admin/community?${params.toString()}`);
      if (res.ok) {
        const json = (await res.json()) as { events: AdminCommunityEvent[] };
        setEvents(json.events);
      }
    },
    []
  );

  // Fetch in the effect via a promise chain so no state updates run
  // synchronously during the effect body.
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ scope: 'list', tab });
    if (q) params.set('q', q);
    if (source) params.set('source', source);
    fetch(`/api/admin/community?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { events?: AdminCommunityEvent[] } | null) => {
        if (active && json?.events) setEvents(json.events);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [tab, q, source]);

  const refreshSelected = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/community?scope=event&eventId=${id}`);
    if (res.ok) {
      const json = (await res.json()) as { event: AdminCommunityEvent };
      setSelected(json.event);
    }
    const logRes = await fetch(`/api/admin/community?scope=log&eventId=${id}`);
    if (logRes.ok) {
      const json = (await logRes.json()) as { log: ModerationLogEntry[] };
      setLog(json.log);
    }
    const attRes = await fetch(`/api/admin/community?scope=attendees&eventId=${id}`);
    if (attRes.ok) {
      const json = (await attRes.json()) as { attendees: AdminEventAttendee[] };
      setAttendees(json.attendees);
    }
  }, []);

  async function openEvent(id: string) {
    setSelectedId(id);
    setSelected(null);
    setNote('');
    setEditOpen(false);
    await refreshSelected(id);
  }

  async function act(action: string) {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/community', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId, action, note: note || undefined }),
      });
      if (res.ok) {
        setNote('');
        await refreshSelected(selectedId);
        await load(tab, q, source);
      } else {
        const json = await res.json().catch(() => null);
        window.alert(json?.error?.message || 'Action failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function removeAttendee(userId: string) {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/community', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedId, userId }),
      });
      if (res.ok) await refreshSelected(selectedId);
    } finally {
      setBusy(false);
    }
  }

  const s = selected?.status;

  return (
    <div>
      <PageHeader
        title="Community & Events"
        subtitle="Review submitted events, publish official listings, and manage registrations."
        actions={
          canCreate ? (
            <button type="button" className={btnPrimary} onClick={() => setCreateOpen(true)}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Create event
              </span>
            </button>
          ) : undefined
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[#E5DFD3] pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              tab === t.id
                ? 'bg-[#17221E] text-white'
                : 'text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]'
            }`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, organizer…"
            className="h-8 w-48 rounded-md border border-[#E5DFD3] px-2.5 text-xs focus:border-[#164E3F] focus:outline-none"
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="h-8 rounded-md border border-[#E5DFD3] px-2 text-xs focus:border-[#164E3F] focus:outline-none"
          >
            <option value="">All sources</option>
            <option value="internal">VietNomad</option>
            <option value="partner">Partner / member</option>
            <option value="external">External (introduced)</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#E5DFD3] text-[11px] uppercase text-[#53635D]">
              <th className="px-4 py-2.5 font-medium">Event</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Starts</th>
              <th className="px-3 py-2.5 font-medium">City</th>
              <th className="px-3 py-2.5 font-medium">Source</th>
              <th className="px-3 py-2.5 font-medium">Registration</th>
              <th className="px-3 py-2.5 font-medium" />
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#53635D]">
                  No events in this view.
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr
                  key={ev.id}
                  className="border-b border-[#E5DFD3] last:border-0 hover:bg-[#FAF8F3]"
                >
                  <td className="max-w-[22rem] px-4 py-2.5">
                    <div className="truncate font-semibold text-[#17221E]">{ev.titleVi || ev.titleEn}</div>
                    <div className="truncate text-[11px] text-[#53635D]">{ev.titleEn}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge label={STATUS_LABEL[ev.status] ?? ev.status} tone={statusToTone(ev.status)} />
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-[#53635D]">{fmtWhen(ev.startAt)}</td>
                  <td className="px-3 py-2.5 text-[#53635D]">{ev.cityVi}</td>
                  <td className="px-3 py-2.5 text-[#53635D]">{ev.source}</td>
                  <td className="px-3 py-2.5 text-[#53635D]">{ev.registrationMode}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      className={btnGhost}
                      onClick={() => void openEvent(ev.id)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SideDrawer
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setSelectedId(null);
        }}
        title={selected ? selected.titleVi || selected.titleEn : ''}
        subtitle={selected ? `${STATUS_LABEL[selected.status] ?? selected.status} · ${selected.slug}` : ''}
      >
        {selected ? (
          <div className="space-y-6 text-xs text-[#17221E]">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt className="text-[#53635D]">Starts</dt>
                <dd className="font-medium">{fmtWhen(selected.startAt)}</dd>
              </div>
              <div>
                <dt className="text-[#53635D]">Ends</dt>
                <dd className="font-medium">{fmtWhen(selected.endAt)}</dd>
              </div>
              <div>
                <dt className="text-[#53635D]">Venue</dt>
                <dd className="font-medium">{selected.venueVi || selected.venueEn}</dd>
              </div>
              <div>
                <dt className="text-[#53635D]">City</dt>
                <dd className="font-medium">{selected.cityVi}</dd>
              </div>
              <div>
                <dt className="text-[#53635D]">Organizer</dt>
                <dd className="font-medium">{selected.organizerName || '—'}</dd>
              </div>
              <div>
                <dt className="text-[#53635D]">Category / language</dt>
                <dd className="font-medium">
                  {selected.category || '—'} / {selected.language || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-[#53635D]">Fee</dt>
                <dd className="font-medium">
                  {selected.priceType === 'free'
                    ? 'Free'
                    : `${selected.priceAmount ?? '?'} ${selected.priceCurrency}`}
                </dd>
              </div>
              <div>
                <dt className="text-[#53635D]">Capacity</dt>
                <dd className="font-medium">
                  {selected.spotsTotal != null
                    ? `${selected.spotsTaken} / ${selected.spotsTotal}`
                    : selected.spotsTaken > 0
                      ? `${selected.spotsTaken} registered (no limit)`
                      : 'No limit set'}
                </dd>
              </div>
              <div>
                <dt className="text-[#53635D]">Source</dt>
                <dd className="font-medium">{selected.source}</dd>
              </div>
              <div>
                <dt className="text-[#53635D]">Registration</dt>
                <dd className="font-medium">{selected.registrationMode}</dd>
              </div>
              {selected.sourceUrl ? (
                <div className="col-span-2">
                  <dt className="text-[#53635D]">Official link</dt>
                  <dd>
                    <a
                      href={selected.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#164E3F] hover:underline"
                    >
                      {selected.sourceUrl}
                    </a>
                  </dd>
                </div>
              ) : null}
              {selected.submitterName ? (
                <div className="col-span-2">
                  <dt className="text-[#53635D]">Submitted by (private)</dt>
                  <dd className="font-medium">
                    {selected.submitterName} · {selected.submitterEmail}
                  </dd>
                </div>
              ) : null}
            </dl>

            {selected.descriptionVi || selected.descriptionEn ? (
              <div>
                <h3 className="mb-1 text-[11px] font-semibold uppercase text-[#53635D]">Description</h3>
                <p className="whitespace-pre-line leading-relaxed text-[#53635D]">
                  {selected.descriptionVi || selected.descriptionEn}
                </p>
              </div>
            ) : null}

            {canEdit ? (
              <div className="flex flex-wrap gap-2 border-t border-[#E5DFD3] pt-4">
                {s === 'pending' && canApprove ? (
                  <>
                    <button type="button" className={btnPrimary} disabled={busy} onClick={() => void act('approve')}>
                      Approve & publish
                    </button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => void act('need_more')}>
                      Request changes
                    </button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => void act('reject')}>
                      Reject
                    </button>
                  </>
                ) : null}
                {s === 'draft' ? (
                  <button type="button" className={btnPrimary} disabled={busy} onClick={() => void act('publish')}>
                    Publish
                  </button>
                ) : null}
                {s === 'published' ? (
                  <>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => void act('unpublish')}>
                      Unpublish
                    </button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => void act('postpone')}>
                      Postpone
                    </button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => void act('end')}>
                      Mark ended
                    </button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => void act('cancel')}>
                      Cancel event
                    </button>
                  </>
                ) : null}
                {s === 'rejected' || s === 'cancelled' || s === 'postponed' || s === 'ended' ? (
                  <>
                    <button type="button" className={btnPrimary} disabled={busy} onClick={() => void act('publish')}>
                      Publish
                    </button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => void act('restore_draft')}>
                      Move to drafts
                    </button>
                  </>
                ) : null}
                {(s === 'pending' && canApprove) || s === 'published' ? (
                  <div className="w-full">
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Note (saved to review history)"
                      className={inputCls}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {canEdit ? (
              <div className="border-t border-[#E5DFD3] pt-4">
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => setEditOpen((v) => !v)}
                >
                  {editOpen ? 'Close editor' : 'Edit details'}
                </button>
                {editOpen ? (
                  <EditEventForm
                    event={selected}
                    taxonomy={taxonomy}
                    destinations={destinations}
                    busy={busy}
                    onSubmit={async (fields) => {
                      setBusy(true);
                      try {
                        const res = await fetch('/api/admin/community', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: selected.id, fields }),
                        });
                        if (res.ok) {
                          setEditOpen(false);
                          await refreshSelected(selected.id);
                          await load(tab, q, source);
                        } else {
                          const json = await res.json().catch(() => null);
                          window.alert(json?.error?.message || 'Save failed.');
                        }
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                ) : null}
              </div>
            ) : null}

            {selected.registrationMode === 'internal' ? (
              <div className="border-t border-[#E5DFD3] pt-4">
                <h3 className="mb-2 text-[11px] font-semibold uppercase text-[#53635D]">
                  Registrations ({attendees.length})
                </h3>
                {attendees.length === 0 ? (
                  <p className="text-[#53635D]">No registrations yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {attendees.map((a) => (
                      <li key={a.userId} className="flex items-center justify-between gap-3">
                        <span>
                          {a.displayName}{' '}
                          <span className="text-[#53635D]">· {fmtWhen(a.registeredAt)}</span>
                        </span>
                        {canEdit ? (
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-[#B42318] hover:underline"
                            disabled={busy}
                            onClick={() => void removeAttendee(a.userId)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div className="border-t border-[#E5DFD3] pt-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase text-[#53635D]">
                Review history
              </h3>
              {log.length === 0 ? (
                <p className="text-[#53635D]">No history yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {log.map((entry) => (
                    <li key={entry.id} className="text-[#53635D]">
                      <span className="font-semibold text-[#17221E]">{entry.action}</span>{' '}
                      by {entry.actorLabel} · {fmtWhen(entry.createdAt)}
                      {entry.note ? <> — {entry.note}</> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-[#53635D]">Loading…</div>
        )}
      </SideDrawer>

      <CreateEventModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        taxonomy={taxonomy}
        destinations={destinations}
        busy={busy}
        onSubmit={async (payload) => {
          setBusy(true);
          try {
            const res = await fetch('/api/admin/community', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (res.ok) {
              setCreateOpen(false);
              await load(tab, q, source);
            } else {
              const json = await res.json().catch(() => null);
              window.alert(json?.error?.message || 'Create failed.');
            }
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

function EditEventForm({
  event,
  taxonomy,
  destinations,
  busy,
  onSubmit,
}: {
  event: AdminCommunityEvent;
  taxonomy: EventTaxonomy;
  destinations: DestinationOption[];
  busy: boolean;
  onSubmit: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [titleVi, setTitleVi] = useState(event.titleVi);
  const [titleEn, setTitleEn] = useState(event.titleEn);
  const [venueVi, setVenueVi] = useState(event.venueVi);
  const [venueEn, setVenueEn] = useState(event.venueEn);
  const [startAt, setStartAt] = useState(toLocalInput(event.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(event.endAt));
  const [category, setCategory] = useState(event.category ?? '');
  const [language, setLanguage] = useState(event.language ?? '');
  const [priceType, setPriceType] = useState(event.priceType);
  const [priceAmount, setPriceAmount] = useState(
    event.priceAmount != null ? String(event.priceAmount) : ''
  );
  const [organizerName, setOrganizerName] = useState(event.organizerName ?? '');
  const [source, setSource] = useState(event.source);
  const [sourceUrl, setSourceUrl] = useState(event.sourceUrl ?? '');
  const [sourceNote, setSourceNote] = useState(event.sourceNote ?? '');
  const [registrationMode, setRegistrationMode] = useState(event.registrationMode);
  const [spotsTotal, setSpotsTotal] = useState(
    event.spotsTotal != null ? String(event.spotsTotal) : ''
  );
  const [imageUrl, setImageUrl] = useState(event.imageUrl ?? '');
  const [destinationId, setDestinationId] = useState(event.destinationId ?? '');
  const [description, setDescription] = useState(event.descriptionVi || event.descriptionEn || '');

  return (
    <form
      className="mt-3 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({
          titleVi,
          titleEn,
          venueVi,
          venueEn,
          startAt: startAt ? new Date(startAt).toISOString() : null,
          endAt: endAt ? new Date(endAt).toISOString() : null,
          category: category || null,
          language: language || null,
          priceType: priceType as 'free' | 'paid',
          priceAmount:
            priceType === 'paid' && priceAmount ? Number(priceAmount) : null,
          organizerName: organizerName || null,
          source: source as 'internal' | 'partner' | 'external',
          sourceUrl: sourceUrl || null,
          sourceNote: sourceNote || null,
          registrationMode: registrationMode as 'internal' | 'external',
          spotsTotal: spotsTotal ? Number(spotsTotal) : null,
          imageUrl: imageUrl || null,
          destinationId: destinationId || null,
          descriptionVi: description,
          descriptionEn: description,
        });
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Title (VI)</span>
          <input className={inputCls} value={titleVi} onChange={(e) => setTitleVi(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Title (EN)</span>
          <input className={inputCls} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Venue (VI)</span>
          <input className={inputCls} value={venueVi} onChange={(e) => setVenueVi(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Venue (EN)</span>
          <input className={inputCls} value={venueEn} onChange={(e) => setVenueEn(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Starts</span>
          <input
            type="datetime-local"
            className={inputCls}
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Ends</span>
          <input
            type="datetime-local"
            className={inputCls}
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Category</span>
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">—</option>
            {taxonomy.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Language</span>
          <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="">—</option>
            {taxonomy.languages.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Fee</span>
          <select
            className={inputCls}
            value={priceType}
            onChange={(e) => setPriceType(e.target.value)}
          >
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        {priceType === 'paid' ? (
          <label className="block">
            <span className={labelCls}>Amount (USD/VND)</span>
            <input
              className={inputCls}
              value={priceAmount}
              onChange={(e) => setPriceAmount(e.target.value)}
            />
          </label>
        ) : null}
        <label className="block">
          <span className={labelCls}>Organizer</span>
          <input
            className={inputCls}
            value={organizerName}
            onChange={(e) => setOrganizerName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Capacity (blank = no limit)</span>
          <input
            className={inputCls}
            value={spotsTotal}
            onChange={(e) => setSpotsTotal(e.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelCls}>Source</span>
          <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="internal">VietNomad</option>
            <option value="partner">Partner / member</option>
            <option value="external">External</option>
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Registration</span>
          <select
            className={inputCls}
            value={registrationMode}
            onChange={(e) => setRegistrationMode(e.target.value)}
          >
            <option value="internal">Internal (RSVP)</option>
            <option value="external">External link</option>
          </select>
        </label>
        <label className="block col-span-2">
          <span className={labelCls}>Official registration URL</span>
          <input
            className={inputCls}
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://…"
          />
        </label>
        <label className="block col-span-2">
          <span className={labelCls}>Source note (where this event was found)</span>
          <input
            className={inputCls}
            value={sourceNote}
            onChange={(e) => setSourceNote(e.target.value)}
          />
        </label>
        <label className="block col-span-2">
          <span className={labelCls}>Image URL</span>
          <input
            className={inputCls}
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="/images/… or https://…"
          />
        </label>
        <label className="block col-span-2">
          <span className={labelCls}>Destination link (nearby stays)</span>
          <select
            className={inputCls}
            value={destinationId}
            onChange={(e) => setDestinationId(e.target.value)}
          >
            <option value="">—</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label className="block col-span-2">
          <span className={labelCls}>Description</span>
          <textarea
            className={inputCls}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>
      <button type="submit" className={btnPrimary} disabled={busy}>
        {busy ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

function toLocalInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CreateEventModal({
  open,
  onClose,
  taxonomy,
  destinations,
  busy,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  taxonomy: EventTaxonomy;
  destinations: DestinationOption[];
  busy: boolean;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [titleEn, setTitleEn] = useState('');
  const [titleVi, setTitleVi] = useState('');
  const [cityEn, setCityEn] = useState('');
  const [cityVi, setCityVi] = useState('');
  const [venueEn, setVenueEn] = useState('');
  const [venueVi, setVenueVi] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('en');
  const [organizerName, setOrganizerName] = useState('');
  const [source, setSource] = useState<'internal' | 'partner' | 'external'>('internal');
  const [registrationMode, setRegistrationMode] = useState<'internal' | 'external'>('internal');
  const [sourceUrl, setSourceUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');

  return (
    <ModalDialog open={open} onClose={onClose} title="Create event">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const dest = destinations.find((d) => d.id === destinationId);
          void onSubmit({
            status,
            titleEn,
            titleVi: titleVi || undefined,
            cityEn: cityEn || dest?.nameEn || '',
            cityVi: cityVi || dest?.nameVi || undefined,
            venueEn,
            venueVi: venueVi || undefined,
            destinationId: destinationId || null,
            startAt: startAt ? new Date(startAt).toISOString() : null,
            endAt: endAt ? new Date(endAt).toISOString() : null,
            category: category || null,
            language: language || null,
            organizerName: organizerName || null,
            source,
            registrationMode,
            sourceUrl: sourceUrl || null,
            imageUrl: imageUrl || null,
            descriptionEn: descriptionEn || null,
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className={labelCls}>Title (EN) *</span>
            <input className={inputCls} required value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </label>
          <label className="block col-span-2">
            <span className={labelCls}>Title (VI)</span>
            <input className={inputCls} value={titleVi} onChange={(e) => setTitleVi(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>Destination</span>
            <select
              className={inputCls}
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
            >
              <option value="">—</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Category</span>
            <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">—</option>
              {taxonomy.categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>City (EN) *</span>
            <input className={inputCls} required value={cityEn} onChange={(e) => setCityEn(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>City (VI)</span>
            <input className={inputCls} value={cityVi} onChange={(e) => setCityVi(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>Venue (EN) *</span>
            <input className={inputCls} required value={venueEn} onChange={(e) => setVenueEn(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>Venue (VI)</span>
            <input className={inputCls} value={venueVi} onChange={(e) => setVenueVi(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelCls}>Starts</span>
            <input
              type="datetime-local"
              className={inputCls}
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Ends</span>
            <input
              type="datetime-local"
              className={inputCls}
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Language</span>
            <select className={inputCls} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {taxonomy.languages.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.nameEn}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Organizer</span>
            <input
              className={inputCls}
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Source</span>
            <select
              className={inputCls}
              value={source}
              onChange={(e) => setSource(e.target.value as 'internal' | 'partner' | 'external')}
            >
              <option value="internal">VietNomad</option>
              <option value="partner">Partner / member</option>
              <option value="external">External</option>
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Registration</span>
            <select
              className={inputCls}
              value={registrationMode}
              onChange={(e) => setRegistrationMode(e.target.value as 'internal' | 'external')}
            >
              <option value="internal">Internal (RSVP)</option>
              <option value="external">External link</option>
            </select>
          </label>
          <label className="block col-span-2">
            <span className={labelCls}>Official registration URL (external)</span>
            <input
              className={inputCls}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://…"
            />
          </label>
          <label className="block col-span-2">
            <span className={labelCls}>Image URL</span>
            <input
              className={inputCls}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/images/… or https://…"
            />
          </label>
          <label className="block col-span-2">
            <span className={labelCls}>Description</span>
            <textarea
              className={inputCls}
              rows={3}
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
            />
          </label>
          <label className="block col-span-2">
            <span className={labelCls}>Initial status</span>
            <select
              className={inputCls}
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
