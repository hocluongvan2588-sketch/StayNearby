'use client';

import { useState } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import {
  KpiMetric,
  ModalDialog,
  PageHeader,
  SavedViewToolbar,
  StatusBadge,
  fmtVnd,
  statusToTone,
} from './BosPrimitives';
import type {
  listAdminDestinations,
  listAdminPlaces,
  listCampaignsAndFunnel,
  listCmsContents,
  listPromotions,
} from '@/modules/admin-bos';

type DestinationsData = Awaited<ReturnType<typeof listAdminDestinations>>;
type PlacesData = Awaited<ReturnType<typeof listAdminPlaces>>;
type CmsList = Awaited<ReturnType<typeof listCmsContents>>;
type CampaignsData = Awaited<ReturnType<typeof listCampaignsAndFunnel>>;
type PromotionsList = Awaited<ReturnType<typeof listPromotions>>;

export function DestinationsView({ initialData }: { initialData: DestinationsData }) {
  const [dests, setDests] = useState(initialData.destinations);
  const [nbs, setNbs] = useState(initialData.neighborhoods);
  const [nbOpen, setNbOpen] = useState(false);

  const [destId, setDestId] = useState(initialData.destinations[0]?.id ?? '');
  const [slug, setSlug] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameVi, setNameVi] = useState('');
  const [summaryEn, setSummaryEn] = useState('');

  async function refresh() {
    const res = await fetch('/api/admin/growth?scope=destinations');
    if (res.ok) {
      const d = (await res.json()) as DestinationsData;
      setDests(d.destinations);
      setNbs(d.neighborhoods);
    }
  }

  async function handleCreateNb(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'neighborhood',
        destinationId: destId,
        slug,
        nameEn,
        nameVi,
        summaryEn,
      }),
    });
    if (res.ok) {
      setNbOpen(false);
      setSlug('');
      setNameEn('');
      setNameVi('');
      await refresh();
    }
  }

  return (
    <div>
      <PageHeader
        title="Destinations & Neighborhoods"
        subtitle="Manage Vietnam destination hubs, benchmarks, and neighborhoods."
        actions={
          <button
            type="button"
            onClick={() => setNbOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add neighborhood
          </button>
        }
      />

      <div className="mb-5 overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Destination</th>
              <th className="px-4 py-2.5">Tagline</th>
              <th className="px-4 py-2.5 text-right">Avg Wi-Fi</th>
              <th className="px-4 py-2.5 text-right">Est. Monthly Cost</th>
              <th className="px-4 py-2.5 text-right">Live Stays</th>
              <th className="px-4 py-2.5 text-right">Places</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {dests.map((d) => (
              <tr key={d.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-[#17221E]">{d.nameEn}</div>
                  <div className="text-[11px] text-[#53635D]">/{d.slug}</div>
                </td>
                <td className="max-w-sm truncate px-4 py-2.5 text-xs text-[#53635D]">
                  {d.taglineEn}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{d.avgWifiMbps} Mbps</td>
                <td className="px-4 py-2.5 text-right tabular-nums">${d.monthlyCostUsd}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{d.staysCount}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#164E3F]">
                  {d.placesCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#53635D]">
        Neighborhoods ({nbs.length})
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nbs.map((n) => (
          <div key={n.id} className="rounded-lg border border-[#E5DFD3] bg-white p-3.5 text-xs">
            <div className="font-semibold text-[#17221E]">{n.nameEn}</div>
            <div className="text-[11px] text-[#53635D]">{n.nameVi}</div>
            <p className="mt-1.5 text-[#53635D]">{n.summaryEn}</p>
          </div>
        ))}
      </div>

      <ModalDialog open={nbOpen} onClose={() => setNbOpen(false)} title="Create Neighborhood">
        <form onSubmit={handleCreateNb} className="space-y-3 text-xs">
          <select
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2"
          >
            {dests.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nameEn}
              </option>
            ))}
          </select>
          <input
            required
            placeholder="Slug (e.g. tay-ho)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="Name (EN)"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
            <input
              required
              placeholder="Name (VI)"
              value={nameVi}
              onChange={(e) => setNameVi(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Neighborhood summary..."
            value={summaryEn}
            onChange={(e) => setSummaryEn(e.target.value)}
            className="w-full rounded border border-[#E5DFD3] p-2"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNbOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Create
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function LocalDiscoveryView({ initialData }: { initialData: PlacesData }) {
  const [places, setPlaces] = useState(initialData.places);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const [destinationId, setDestinationId] = useState(initialData.destinations[0]?.id ?? '');
  const [category, setCategory] = useState('cafe');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [openingHours, setOpeningHours] = useState('07:30 - 22:00');
  const [priceRange, setPriceRange] = useState('$$');

  async function refresh() {
    const res = await fetch('/api/admin/growth?scope=places');
    if (res.ok) {
      const d = (await res.json()) as PlacesData;
      setPlaces(d.places);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'place',
        destinationId,
        category,
        name,
        address,
        descriptionEn,
        openingHours,
        priceRange,
        isFeatured: true,
      }),
    });
    if (res.ok) {
      setCreateOpen(false);
      setName('');
      setAddress('');
      setDescriptionEn('');
      await refresh();
    }
  }

  async function toggleVerify(placeId: string, current: string) {
    const next = current === 'verified' ? 'outdated' : 'verified';
    const res = await fetch('/api/admin/growth', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'place', placeId, verificationStatus: next }),
    });
    if (res.ok) {
      setPlaces((prev) =>
        prev.map((p) => (p.id === placeId ? { ...p, verificationStatus: next } : p))
      );
    }
  }

  async function handleDelete(placeId: string) {
    if (!window.confirm('Remove this place? It will no longer appear on destination or stay pages.')) return;
    const res = await fetch('/api/admin/growth', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId }),
    });
    if (res.ok) setPlaces((prev) => prev.filter((p) => p.id !== placeId));
  }

  const filtered = places.filter((p) => {
    if (catFilter !== 'all' && p.category !== catFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.destinationName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Local Places"
        subtitle="Places shown across destination pages, stay listings, and city guides."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            Add place
          </button>
        }
      />

      <SavedViewToolbar
        moduleKey="discovery"
        currentFilters={{ catFilter }}
        onApplyFilters={(f) => {
          if (typeof f.catFilter === 'string') setCatFilter(f.catFilter);
        }}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search place or city..."
        extraControls={
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="h-8 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2 text-xs"
          >
            <option value="all">All categories</option>
            <option value="coworking">Coworking</option>
            <option value="cafe">Cafe</option>
            <option value="restaurant">Restaurant</option>
            <option value="gym_yoga">Gym / Yoga</option>
            <option value="essential">Essential</option>
          </select>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Place Name & Address</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5">Destination / Neighborhood</th>
              <th className="px-4 py-2.5">Hours / Price</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-[#17221E]">{p.name}</div>
                  <div className="text-[11px] text-[#53635D]">{p.address}</div>
                </td>
                <td className="px-4 py-2.5 text-xs capitalize text-[#53635D]">
                  {p.category.replace('_', ' ')}
                </td>
                <td className="px-4 py-2.5 text-xs text-[#17221E]">
                  {p.destinationName}
                  {p.neighborhoodName ? ` · ${p.neighborhoodName}` : ''}
                </td>
                <td className="px-4 py-2.5 text-xs tabular-nums text-[#53635D]">
                  {p.openingHours} ({p.priceRange})
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge
                    label={p.verificationStatus}
                    tone={statusToTone(p.verificationStatus)}
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="inline-flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleVerify(p.id, p.verificationStatus)}
                      className="rounded border border-[#E5DFD3] px-2 py-1 text-xs"
                    >
                      Toggle verify
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="rounded border border-[#F4C7C3] p-1 text-[#B42318]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDialog open={createOpen} onClose={() => setCreateOpen(false)} title="Add Local Place">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={destinationId}
              onChange={(e) => setDestinationId(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              {initialData.destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nameEn}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="coworking">Coworking</option>
              <option value="cafe">Cafe</option>
              <option value="restaurant">Restaurant</option>
              <option value="gym_yoga">Gym / Yoga</option>
              <option value="essential">Essential</option>
            </select>
          </div>
          <input
            required
            placeholder="Place name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <input
            required
            placeholder="Street address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <textarea
            required
            rows={2}
            placeholder="Short description of this place..."
            value={descriptionEn}
            onChange={(e) => setDescriptionEn(e.target.value)}
            className="w-full rounded border border-[#E5DFD3] p-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Hours (e.g. 07:30 - 22:00)"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
            <select
              value={priceRange}
              onChange={(e) => setPriceRange(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="$">$</option>
              <option value="$$">$$</option>
              <option value="$$$">$$$</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Save Place
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function ContentSeoView({ initialContents }: { initialContents: CmsList }) {
  const [contents, setContents] = useState(initialContents);
  const [open, setOpen] = useState(false);

  const [contentType, setContentType] = useState<
    | 'article'
    | 'landing_page'
    | 'destination_guide'
    | 'faq'
    | 'announcement'
    | 'hero_banner'
    | 'community_story'
  >('destination_guide');
  const [slug, setSlug] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [titleVi, setTitleVi] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [bodyVi, setBodyVi] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('published');

  async function refresh() {
    const res = await fetch('/api/admin/growth?scope=content');
    if (res.ok) {
      const d = (await res.json()) as { contents: CmsList };
      setContents(d.contents);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'content',
        contentType,
        category: 'living_guide',
        slug,
        titleEn,
        titleVi: titleVi || titleEn,
        bodyEn,
        bodyVi: bodyVi || bodyEn,
        seoTitle,
        seoDescription,
        robotsIndex: true,
        status,
      }),
    });
    if (res.ok) {
      setOpen(false);
      setSlug('');
      setTitleEn('');
      setTitleVi('');
      setBodyEn('');
      setBodyVi('');
      await refresh();
    }
  }

  return (
    <div>
      <PageHeader
        title="Content & SEO Management"
        subtitle="Editorial city guides, landing pages, SEO meta titles, canonical tags, and indexing status."
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New CMS page
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Title & Slug</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">SEO Title / Indexing</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {contents.map((c) => (
              <tr key={c.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-[#17221E]">{c.titleEn}</div>
                  <div className="text-[11px] text-[#53635D]">/{c.slug}</div>
                </td>
                <td className="px-4 py-2.5 text-xs capitalize text-[#53635D]">
                  {c.contentType.replace('_', ' ')}
                </td>
                <td className="px-4 py-2.5 text-xs text-[#53635D]">
                  <div className="truncate max-w-sm">{c.seoTitle || '—'}</div>
                  <div className="text-[10px]">
                    {c.robotsIndex ? 'index, follow' : 'noindex'}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge label={c.status} tone={statusToTone(c.status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDialog open={open} onClose={() => setOpen(false)} title="Create CMS / SEO Content">
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={contentType}
              onChange={(e) =>
                setContentType(
                  e.target.value as
                    | 'article'
                    | 'landing_page'
                    | 'destination_guide'
                    | 'faq'
                    | 'announcement'
                    | 'hero_banner'
                    | 'community_story'
                )
              }
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="destination_guide">Destination Guide</option>
              <option value="article">Blog Article</option>
              <option value="landing_page">Landing Page</option>
              <option value="faq">FAQ Item</option>
              <option value="announcement">Announcement Banner</option>
              <option value="hero_banner">Hero Banner</option>
              <option value="community_story">Community Story</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <input
            required
            placeholder="URL Slug (e.g. tay-ho-hanoi-long-stay-guide)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <input
            required
            placeholder="Title (EN)"
            value={titleEn}
            onChange={(e) => setTitleEn(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <input
            placeholder="Title (VI)"
            value={titleVi}
            onChange={(e) => setTitleVi(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <textarea
            required
            rows={3}
            placeholder="Article body (Markdown/Text)..."
            value={bodyEn}
            onChange={(e) => setBodyEn(e.target.value)}
            className="w-full rounded border border-[#E5DFD3] p-2"
          />
          <input
            placeholder="SEO Meta Title"
            value={seoTitle}
            onChange={(e) => setSeoTitle(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <input
            placeholder="SEO Meta Description"
            value={seoDescription}
            onChange={(e) => setSeoDescription(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Save Content
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function CampaignsFunnelView({ initialData }: { initialData: CampaignsData }) {
  const [data, setData] = useState(initialData);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState('');
  const [channel, setChannel] = useState('organic_seo');
  const [utmSource, setUtmSource] = useState('google');
  const [utmMedium, setUtmMedium] = useState('cpc');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [budgetVnd, setBudgetVnd] = useState(10000000);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  async function refresh() {
    const res = await fetch('/api/admin/growth?scope=campaigns');
    if (res.ok) setData((await res.json()) as CampaignsData);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'campaign',
        name,
        channel,
        utmSource,
        utmMedium,
        utmCampaign,
        budgetVnd,
        startDate,
      }),
    });
    if (res.ok) {
      setOpen(false);
      setName('');
      setUtmCampaign('');
      await refresh();
    }
  }

  const f = data.funnel;

  return (
    <div>
      <PageHeader
        title="Marketing Campaigns & Attribution Funnel"
        subtitle="Real-time UTM attribution linked directly to checkout completion and Platform Revenue."
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New campaign
          </button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-5">
        <KpiMetric label="Page Views" value={String(f.pageViews)} />
        <KpiMetric label="Searches" value={String(f.searches)} />
        <KpiMetric label="Stay Views" value={String(f.stayViews)} />
        <KpiMetric label="Checkout Starts" value={String(f.checkoutStarts)} />
        <KpiMetric label="Booked" value={String(f.bookingCompleted)} accent="emerald" />
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Campaign</th>
              <th className="px-4 py-2.5">Channel / UTM</th>
              <th className="px-4 py-2.5 text-right">Budget</th>
              <th className="px-4 py-2.5 text-right">Events</th>
              <th className="px-4 py-2.5 text-right">Bookings</th>
              <th className="px-4 py-2.5 text-right">Revenue</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {data.campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5 font-medium text-[#17221E]">{c.name}</td>
                <td className="px-4 py-2.5 text-xs text-[#53635D]">
                  {c.channel} · <code>{c.utmCampaign}</code>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtVnd(c.budgetVnd)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.eventsCount}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.bookingsCount}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[#164E3F]">
                  {fmtVnd(c.revenueVnd)}
                </td>
                <td className="px-4 py-2.5">
                  <StatusBadge label={c.status} tone={statusToTone(c.status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDialog open={open} onClose={() => setOpen(false)} title="Create Marketing Campaign">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <input
            required
            placeholder="Campaign Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-full rounded border border-[#E5DFD3] px-2.5"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              required
              placeholder="utm_source"
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
            <input
              required
              placeholder="utm_medium"
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
            <input
              required
              placeholder="utm_campaign"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="Channel"
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
            <input
              type="number"
              value={budgetVnd}
              onChange={(e) => setBudgetVnd(Number(e.target.value))}
              placeholder="Budget VND"
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Launch Campaign
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}

export function PromotionsView({ initialPromos }: { initialPromos: PromotionsList }) {
  const [promos, setPromos] = useState(initialPromos);
  const [open, setOpen] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed_vnd'>('fixed_vnd');
  const [discountValue, setDiscountValue] = useState(250000);
  const [minNights, setMinNights] = useState(14);
  const [maxUses, setMaxUses] = useState<string>('');
  const [isPublic, setIsPublic] = useState(true);
  const [fundingSource, setFundingSource] = useState<'vietnomad' | 'host' | 'shared'>('vietnomad');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState('2027-06-30');

  async function refresh() {
    const res = await fetch('/api/admin/growth?scope=promotions');
    if (res.ok) {
      const d = (await res.json()) as { promotions: PromotionsList };
      setPromos(d.promotions);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/growth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'promotion',
        code,
        name,
        discountType,
        discountValue,
        minNights,
        maxUses: maxUses.trim() ? Number(maxUses) : null,
        isPublic,
        fundingSource,
        validFrom,
        validTo,
      }),
    });
    if (res.ok) {
      setOpen(false);
      setCode('');
      setName('');
      setMaxUses('');
      await refresh();
    }
  }

  async function handleToggle(promoId: string, current: boolean) {
    const res = await fetch('/api/admin/growth', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'promotion', promoId, isActive: !current }),
    });
    if (res.ok) {
      setPromos((prev) =>
        prev.map((p) => (p.id === promoId ? { ...p, isActive: !current } : p))
      );
    }
  }

  return (
    <div>
      <PageHeader
        title="Promotions & Voucher Codes"
        subtitle="Manage public deals vs private codes, funding source (VietNomad vs Host), and usage limits."
        actions={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#164E3F] px-3 text-xs font-semibold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New promo code
          </button>
        }
      />

      <div className="overflow-hidden rounded-lg border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-medium text-[#53635D]">
            <tr>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Campaign Name</th>
              <th className="px-4 py-2.5">Value</th>
              <th className="px-4 py-2.5">Funding</th>
              <th className="px-4 py-2.5">Visibility</th>
              <th className="px-4 py-2.5">Usage</th>
              <th className="px-4 py-2.5">Window</th>
              <th className="px-4 py-2.5 text-right">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {promos.map((p) => (
              <tr key={p.id} className="hover:bg-[#FAF8F3]/60">
                <td className="px-4 py-2.5 font-mono font-semibold text-[#164E3F]">{p.code}</td>
                <td className="px-4 py-2.5 text-[#17221E]">{p.name}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {p.discountType === 'percent' ? `${p.discountValue}%` : fmtVnd(p.discountValue)} ({p.minNights}n+)
                </td>
                <td className="px-4 py-2.5 text-xs capitalize text-[#53635D]">{p.fundingSource}</td>
                <td className="px-4 py-2.5 text-xs">
                  <StatusBadge label={p.isPublic ? 'Public /deals' : 'Private'} tone={p.isPublic ? 'emerald' : 'neutral'} />
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {p.usedCount} / {p.maxUses ?? '∞'}
                </td>
                <td className="px-4 py-2.5 text-xs tabular-nums text-[#53635D]">
                  {p.validFrom} &rarr; {p.validTo}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggle(p.id, p.isActive)}
                    className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold ${
                      p.isActive
                        ? 'bg-[#E7F1EC] text-[#164E3F]'
                        : 'border border-[#E5DFD3] text-[#53635D]'
                    }`}
                  >
                    {p.isActive && <Check className="h-3 w-3" />}
                    {p.isActive ? 'Active' : 'Paused'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalDialog open={open} onClose={() => setOpen(false)} title="Create Promotion Code">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="Code (e.g. NOMAD2026)"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5 uppercase"
            />
            <input
              required
              placeholder="Promo Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2.5"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as 'percent' | 'fixed_vnd')}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="fixed_vnd">Fixed VND</option>
              <option value="percent">Percent %</option>
            </select>
            <input
              type="number"
              min={1}
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value))}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
            <input
              type="number"
              min={1}
              placeholder="Min nights"
              value={minNights}
              onChange={(e) => setMinNights(Number(e.target.value))}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={fundingSource}
              onChange={(e) => setFundingSource(e.target.value as 'vietnomad' | 'host' | 'shared')}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            >
              <option value="vietnomad">Funded by VietNomad (Fee)</option>
              <option value="host">Funded by Host (Rent)</option>
              <option value="shared">Shared 50/50</option>
            </select>
            <input
              type="number"
              min={1}
              placeholder="Max uses (blank=∞)"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
            <label className="flex items-center gap-1.5 px-1">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Show on /deals
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
            <input
              type="date"
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              className="h-8 rounded border border-[#E5DFD3] px-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-8 rounded border border-[#E5DFD3] px-3"
            >
              Cancel
            </button>
            <button type="submit" className="h-8 rounded bg-[#164E3F] px-4 font-semibold text-white">
              Create Promo
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
