'use client';

import React, { useEffect, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  BadgePercent,
  Building2,
  Compass,
  Handshake,
  Map,
  MapPin,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface EntityOption {
  id: string;
  label: string;
  subtitle?: string;
  slug?: string;
  status?: string;
}

function EntityPicker({
  entityType,
  valueId,
  valueLabel,
  onSelect,
  placeholder,
}: {
  entityType:
    | 'stay'
    | 'destination'
    | 'neighborhood'
    | 'place'
    | 'partner'
    | 'promotion'
    | 'guide';
  valueId: string;
  valueLabel: string;
  onSelect: (opt: EntityOption) => void;
  placeholder: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(!valueId);
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/cms/entities?type=${entityType}&q=${encodeURIComponent(query.trim())}`
        );
        if (res.ok) {
          const data = (await res.json()) as { items?: EntityOption[] };
          setOptions(data.items ?? []);
        }
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [entityType, query, open]);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-[#17221E]">
          {valueLabel || (valueId ? `Selected ID: ${valueId.slice(0, 8)}...` : 'No entity selected')}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded border border-[#E5DFD3] bg-white px-2 py-0.5 text-[11px] font-medium text-[#164E3F] hover:bg-[#E7F1EC]"
        >
          {open ? 'Close picker' : valueId ? 'Change selection' : 'Pick from DB'}
        </button>
      </div>
      {open && (
        <div className="rounded-lg border border-[#E5DFD3] bg-white p-2 space-y-1.5">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="h-7 w-full rounded border border-[#E5DFD3] px-2 text-xs focus:border-[#164E3F] focus:outline-none"
          />
          <div className="max-h-36 overflow-y-auto divide-y divide-[#F2EDE3]">
            {loading && <div className="py-2 text-[11px] text-[#53635D]">Searching live DB...</div>}
            {!loading && options.length === 0 && (
              <div className="py-2 text-[11px] text-[#53635D]">No matching records found.</div>
            )}
            {options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onSelect(opt);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-xs hover:bg-[#FAF8F3] ${
                  opt.id === valueId ? 'bg-[#E7F1EC] font-semibold' : ''
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-[#17221E]">{opt.label}</div>
                  {opt.subtitle && (
                    <div className="truncate text-[10px] text-[#53635D]">{opt.subtitle}</div>
                  )}
                </div>
                {opt.status && (
                  <span className="ml-2 shrink-0 rounded bg-[#FAF8F3] px-1.5 py-0.5 text-[10px] text-[#53635D]">
                    {opt.status}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BlockHeader({
  icon,
  title,
  badge = 'Live DB Block',
  onDelete,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  onDelete: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-[#164E3F]">
        {icon}
        <span>{title}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#53635D] border border-[#E5DFD3]">
          {badge}
        </span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-1 text-[#53635D] hover:bg-white hover:text-red-600"
        title="Remove block"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function VnStayListingNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC]/40 p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <BlockHeader
        icon={<Building2 className="h-3.5 w-3.5" />}
        title="VietNomad Stay Listing Card"
        onDelete={deleteNode}
      />
      <EntityPicker
        entityType="stay"
        valueId={String(node.attrs.stayId ?? '')}
        valueLabel={String(node.attrs.label ?? '')}
        placeholder="Search stays by title, city, or slug..."
        onSelect={(opt) =>
          updateAttributes({ stayId: opt.id, label: opt.label })
        }
      />
      <div className="mt-2 flex items-center gap-2 text-[11px]">
        <span className="text-[#53635D]">Card Layout:</span>
        <select
          value={String(node.attrs.layout ?? 'highlight')}
          onChange={(e) => updateAttributes({ layout: e.target.value })}
          className="rounded border border-[#E5DFD3] bg-white px-2 py-0.5 text-[11px]"
        >
          <option value="highlight">Horizontal Highlight</option>
          <option value="card">Vertical Card</option>
        </select>
      </div>
    </NodeViewWrapper>
  );
}

export function VnDestinationCardNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC]/40 p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <BlockHeader
        icon={<Compass className="h-3.5 w-3.5" />}
        title="VietNomad Destination Hub Card"
        onDelete={deleteNode}
      />
      <EntityPicker
        entityType="destination"
        valueId={String(node.attrs.destinationId ?? '')}
        valueLabel={String(node.attrs.label ?? '')}
        placeholder="Search destinations (Da Nang, Hanoi, HCMC...)"
        onSelect={(opt) =>
          updateAttributes({ destinationId: opt.id, label: opt.label })
        }
      />
    </NodeViewWrapper>
  );
}

export function VnNeighborhoodCardNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#164E3F]/25 bg-[#FAF8F3] p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <BlockHeader
        icon={<MapPin className="h-3.5 w-3.5" />}
        title="Neighborhood Spotlight Card"
        onDelete={deleteNode}
      />
      <EntityPicker
        entityType="neighborhood"
        valueId={String(node.attrs.neighborhoodId ?? '')}
        valueLabel={String(node.attrs.label ?? '')}
        placeholder="Search neighborhoods (An Thuong, Tay Ho, Thao Dien...)"
        onSelect={(opt) =>
          updateAttributes({ neighborhoodId: opt.id, label: opt.label })
        }
      />
    </NodeViewWrapper>
  );
}

export function VnLocalPlaceCardNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#164E3F]/25 bg-[#FAF8F3] p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <BlockHeader
        icon={<MapPin className="h-3.5 w-3.5" />}
        title="Verified Local Place Card"
        onDelete={deleteNode}
      />
      <EntityPicker
        entityType="place"
        valueId={String(node.attrs.placeId ?? '')}
        valueLabel={String(node.attrs.label ?? '')}
        placeholder="Search cafes, coworking, gyms, restaurants..."
        onSelect={(opt) => updateAttributes({ placeId: opt.id, label: opt.label })}
      />
    </NodeViewWrapper>
  );
}

export function VnDestinationMapNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC]/35 p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <BlockHeader
        icon={<Map className="h-3.5 w-3.5" />}
        title="Interactive Destination Neighborhood Map"
        onDelete={deleteNode}
      />
      <EntityPicker
        entityType="destination"
        valueId={String(node.attrs.destinationId ?? '')}
        valueLabel={String(node.attrs.label ?? '')}
        placeholder="Select destination for map..."
        onSelect={(opt) =>
          updateAttributes({ destinationId: opt.id, label: opt.label })
        }
      />
    </NodeViewWrapper>
  );
}

export function VnLocalPartnerOfferNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#C25E28]/30 bg-[#FAEDE5]/60 p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <BlockHeader
        icon={<Handshake className="h-3.5 w-3.5 text-[#C25E28]" />}
        title="Local Partner Offer Block"
        onDelete={deleteNode}
      />
      <EntityPicker
        entityType="partner"
        valueId={String(node.attrs.partnerId ?? '')}
        valueLabel={String(node.attrs.label ?? '')}
        placeholder="Search active local partners..."
        onSelect={(opt) => updateAttributes({ partnerId: opt.id, label: opt.label })}
      />
    </NodeViewWrapper>
  );
}

export function VnStaySearchWidgetNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#164E3F] bg-[#0F392E] p-4 text-white ${
        selected ? 'ring-2 ring-[#E6B87A]' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#E6B87A]">
        <span className="inline-flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5" />
          Embedded Stay Search Widget (Live Funnel Attribution)
        </span>
        <button
          type="button"
          onClick={deleteNode}
          className="rounded p-1 text-white/75 hover:bg-white/10 hover:text-white"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 text-xs text-[#17221E]">
        <input
          type="text"
          value={String(node.attrs.heading ?? '')}
          onChange={(e) => updateAttributes({ heading: e.target.value })}
          placeholder="Widget heading..."
          className="rounded bg-white px-2.5 py-1.5"
        />
        <input
          type="text"
          value={String(node.attrs.defaultDestinationSlug ?? '')}
          onChange={(e) => updateAttributes({ defaultDestinationSlug: e.target.value })}
          placeholder="Default city slug (e.g. da-nang)"
          className="rounded bg-white px-2.5 py-1.5"
        />
        <select
          value={Number(node.attrs.defaultMinNights ?? 30)}
          onChange={(e) => updateAttributes({ defaultMinNights: Number(e.target.value) })}
          className="rounded bg-white px-2.5 py-1.5"
        >
          <option value={7}>Default 7+ nights</option>
          <option value={14}>Default 14+ nights</option>
          <option value={21}>Default 21+ nights</option>
          <option value={30}>Default 30+ nights</option>
        </select>
      </div>
    </NodeViewWrapper>
  );
}

export function VnRecommendedStaysNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC]/35 p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <BlockHeader
        icon={<Building2 className="h-3.5 w-3.5" />}
        title="Dynamic Recommended Stays Grid"
        badge="Auto-synced Live Stays"
        onDelete={deleteNode}
      />
      <div className="grid gap-2 sm:grid-cols-4 text-xs">
        <input
          type="text"
          value={String(node.attrs.title ?? 'Recommended Long-Stay Homes')}
          onChange={(e) => updateAttributes({ title: e.target.value })}
          placeholder="Section title"
          className="rounded border border-[#E5DFD3] bg-white px-2.5 py-1"
        />
        <input
          type="text"
          value={String(node.attrs.destinationSlug ?? '')}
          onChange={(e) => updateAttributes({ destinationSlug: e.target.value })}
          placeholder="City slug (optional: da-nang)"
          className="rounded border border-[#E5DFD3] bg-white px-2.5 py-1"
        />
        <select
          value={Number(node.attrs.limit ?? 2)}
          onChange={(e) => updateAttributes({ limit: Number(e.target.value) })}
          className="rounded border border-[#E5DFD3] bg-white px-2 py-1"
        >
          <option value={2}>Show 2 stays</option>
          <option value={4}>Show 4 stays</option>
        </select>
        <label className="flex items-center gap-1.5 rounded border border-[#E5DFD3] bg-white px-2.5 py-1">
          <input
            type="checkbox"
            checked={Boolean(node.attrs.workReadyOnly)}
            onChange={(e) => updateAttributes({ workReadyOnly: e.target.checked })}
          />
          <span>Work-Ready only</span>
        </label>
      </div>
    </NodeViewWrapper>
  );
}

export function VnRelatedGuidesNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#164E3F]/25 bg-[#FAF8F3] p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <BlockHeader
        icon={<Sparkles className="h-3.5 w-3.5" />}
        title="Dynamic Related Guides Block"
        badge="Auto-synced Published Guides"
        onDelete={deleteNode}
      />
      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        <input
          type="text"
          value={String(node.attrs.title ?? 'Related Guides')}
          onChange={(e) => updateAttributes({ title: e.target.value })}
          placeholder="Block title"
          className="rounded border border-[#E5DFD3] bg-white px-2.5 py-1"
        />
        <input
          type="text"
          value={String(node.attrs.destinationSlug ?? '')}
          onChange={(e) => updateAttributes({ destinationSlug: e.target.value })}
          placeholder="Filter by city slug (optional)"
          className="rounded border border-[#E5DFD3] bg-white px-2.5 py-1"
        />
        <select
          value={Number(node.attrs.limit ?? 2)}
          onChange={(e) => updateAttributes({ limit: Number(e.target.value) })}
          className="rounded border border-[#E5DFD3] bg-white px-2 py-1"
        >
          <option value={2}>Show 2 guides</option>
          <option value={4}>Show 4 guides</option>
        </select>
      </div>
    </NodeViewWrapper>
  );
}

export function VnPromotionBlockNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <BlockHeader
        icon={<BadgePercent className="h-3.5 w-3.5" />}
        title="Active Promotion Banner Block"
        badge="Auto-hides if expired"
        onDelete={deleteNode}
      />
      <EntityPicker
        entityType="promotion"
        valueId={String(node.attrs.promotionId ?? '')}
        valueLabel={String(node.attrs.label ?? '')}
        placeholder="Search active promotions by code or name..."
        onSelect={(opt) => updateAttributes({ promotionId: opt.id, label: opt.label })}
      />
    </NodeViewWrapper>
  );
}
