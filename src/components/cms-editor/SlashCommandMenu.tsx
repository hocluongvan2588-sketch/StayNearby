'use client';

import React, { useEffect, useImperativeHandle, useState } from 'react';
import { Extension, type Editor, type Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import {
  BadgePercent,
  Building2,
  CheckSquare,
  Code2,
  Columns3,
  Compass,
  Heading2,
  Heading3,
  Heading4,
  Handshake,
  HelpCircle,
  Image as ImageIcon,
  Images,
  Info,
  List,
  ListOrdered,
  ListTree,
  Map as MapIcon,
  MapPin,
  Minus,
  MousePointerClick,
  Quote,
  Search,
  Sparkles,
  Table2,
  Youtube,
} from 'lucide-react';

export interface SlashCommandItem {
  id: string;
  title: string;
  description: string;
  category: 'Basic' | 'Layout & Media' | 'VietNomad Live Data';
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  run: (props: { editor: Editor; range?: Range; openMediaPicker?: () => void }) => void;
}

export function buildSlashCommandItems(callbacks?: {
  openMediaPicker?: () => void;
}): SlashCommandItem[] {
  const deleteRange = (editor: Editor, range?: Range) => {
    if (range) {
      return editor.chain().focus().deleteRange(range);
    }
    return editor.chain().focus();
  };

  return [
    {
      id: 'h2',
      title: 'Heading 2',
      description: 'Major section heading',
      category: 'Basic',
      keywords: ['h2', 'heading', 'section', 'title'],
      icon: Heading2,
      run: ({ editor, range }) => deleteRange(editor, range).setNode('heading', { level: 2 }).run(),
    },
    {
      id: 'h3',
      title: 'Heading 3',
      description: 'Subsection heading',
      category: 'Basic',
      keywords: ['h3', 'subheading'],
      icon: Heading3,
      run: ({ editor, range }) => deleteRange(editor, range).setNode('heading', { level: 3 }).run(),
    },
    {
      id: 'h4',
      title: 'Heading 4',
      description: 'Detailed topic heading',
      category: 'Basic',
      keywords: ['h4', 'subheading'],
      icon: Heading4,
      run: ({ editor, range }) => deleteRange(editor, range).setNode('heading', { level: 4 }).run(),
    },
    {
      id: 'bulletList',
      title: 'Bullet List',
      description: 'Create an unordered bullet list',
      category: 'Basic',
      keywords: ['ul', 'list', 'bullets'],
      icon: List,
      run: ({ editor, range }) => deleteRange(editor, range).toggleBulletList().run(),
    },
    {
      id: 'orderedList',
      title: 'Numbered List',
      description: 'Create a step-by-step ordered list',
      category: 'Basic',
      keywords: ['ol', 'numbered', 'steps'],
      icon: ListOrdered,
      run: ({ editor, range }) => deleteRange(editor, range).toggleOrderedList().run(),
    },
    {
      id: 'taskList',
      title: 'Checklist',
      description: 'Arrival or packing checklist items',
      category: 'Basic',
      keywords: ['todo', 'checklist', 'tasks'],
      icon: CheckSquare,
      run: ({ editor, range }) => deleteRange(editor, range).toggleTaskList().run(),
    },
    {
      id: 'quote',
      title: 'Blockquote',
      description: 'Editorial pull quote or host tip',
      category: 'Basic',
      keywords: ['quote', 'blockquote'],
      icon: Quote,
      run: ({ editor, range }) => deleteRange(editor, range).toggleBlockquote().run(),
    },
    {
      id: 'code',
      title: 'Code Block',
      description: 'Formatted snippet or configuration block',
      category: 'Basic',
      keywords: ['code', 'snippet'],
      icon: Code2,
      run: ({ editor, range }) => deleteRange(editor, range).toggleCodeBlock().run(),
    },
    {
      id: 'divider',
      title: 'Divider Line',
      description: 'Clean horizontal visual separator',
      category: 'Basic',
      keywords: ['hr', 'divider', 'line'],
      icon: Minus,
      run: ({ editor, range }) => deleteRange(editor, range).setHorizontalRule().run(),
    },
    {
      id: 'image',
      title: 'Image (Media Library)',
      description: 'Insert photo from Shared Media Library',
      category: 'Layout & Media',
      keywords: ['img', 'photo', 'media', 'image'],
      icon: ImageIcon,
      run: ({ editor, range }) => {
        deleteRange(editor, range).run();
        callbacks?.openMediaPicker?.();
      },
    },
    {
      id: 'gallery',
      title: 'Photo Gallery Grid',
      description: 'Multi-image gallery block',
      category: 'Layout & Media',
      keywords: ['gallery', 'photos', 'grid'],
      icon: Images,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({
            type: 'gallery',
            attrs: { layout: 'grid', items: [] },
          })
          .run(),
    },
    {
      id: 'video',
      title: 'YouTube Video',
      description: 'Embed verified YouTube / Vimeo video',
      category: 'Layout & Media',
      keywords: ['video', 'youtube', 'embed'],
      icon: Youtube,
      run: ({ editor, range }) => {
        deleteRange(editor, range).run();
        const url = window.prompt('Paste YouTube URL (e.g. https://www.youtube.com/watch?v=...):');
        if (url) {
          editor.chain().focus().setYoutubeVideo({ src: url }).run();
        }
      },
    },
    {
      id: 'table',
      title: 'Table (3×3)',
      description: 'Compare neighborhoods, costs, or packages',
      category: 'Layout & Media',
      keywords: ['table', 'comparison', 'grid'],
      icon: Table2,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      id: 'callout',
      title: 'Callout Box',
      description: 'Info, Pro Tip, or Warning highlight box',
      category: 'Layout & Media',
      keywords: ['callout', 'tip', 'note', 'warning'],
      icon: Info,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({
            type: 'callout',
            attrs: { tone: 'tip', title: 'Local tip', body: '' },
          })
          .run(),
    },
    {
      id: 'faqGroup',
      title: 'FAQ Accordion',
      description: 'Collapsible Q&A section (supports FAQPage schema)',
      category: 'Layout & Media',
      keywords: ['faq', 'questions', 'accordion'],
      icon: HelpCircle,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'faqGroup' })
          .run(),
    },
    {
      id: 'ctaButton',
      title: 'CTA Button',
      description: 'Styled action button linking to stays or guides',
      category: 'Layout & Media',
      keywords: ['button', 'cta', 'link'],
      icon: MousePointerClick,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'ctaButton' })
          .run(),
    },
    {
      id: 'columns',
      title: 'Multi-Column Grid',
      description: '2 or 3 side-by-side highlight cards',
      category: 'Layout & Media',
      keywords: ['columns', '2col', '3col'],
      icon: Columns3,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'columns' })
          .run(),
    },
    {
      id: 'tocBlock',
      title: 'Table of Contents',
      description: 'Auto-synced jump links from H2–H3 headings',
      category: 'Layout & Media',
      keywords: ['toc', 'outline', 'contents'],
      icon: ListTree,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'tocBlock' })
          .run(),
    },
    {
      id: 'vnStayListing',
      title: 'Stay Listing Card (Live)',
      description: 'Embed a live VietNomad stay with real-time pricing & Wi-Fi',
      category: 'VietNomad Live Data',
      keywords: ['stay', 'apartment', 'listing', 'vietnomad'],
      icon: Building2,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'vnStayListing' })
          .run(),
    },
    {
      id: 'vnDestinationCard',
      title: 'Destination Hub Card (Live)',
      description: 'Embed a city hub with Wi-Fi speed & cost stats',
      category: 'VietNomad Live Data',
      keywords: ['destination', 'city', 'hub'],
      icon: Compass,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'vnDestinationCard' })
          .run(),
    },
    {
      id: 'vnNeighborhoodCard',
      title: 'Neighborhood Spotlight (Live)',
      description: 'Highlight An Thuong, Tay Ho, Thao Dien, etc.',
      category: 'VietNomad Live Data',
      keywords: ['neighborhood', 'district', 'area'],
      icon: MapPin,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'vnNeighborhoodCard' })
          .run(),
    },
    {
      id: 'vnLocalPlaceCard',
      title: 'Verified Local Place (Live)',
      description: 'Embed verified cafe, coworking, gym, or dining spot',
      category: 'VietNomad Live Data',
      keywords: ['place', 'cafe', 'coworking', 'local'],
      icon: MapPin,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'vnLocalPlaceCard' })
          .run(),
    },
    {
      id: 'vnDestinationMap',
      title: 'Destination Neighborhood Map',
      description: 'Interactive map card of neighborhoods, stays & places',
      category: 'VietNomad Live Data',
      keywords: ['map', 'neighborhoods', 'locations'],
      icon: MapIcon,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'vnDestinationMap' })
          .run(),
    },
    {
      id: 'vnLocalPartnerOffer',
      title: 'Local Partner Offer (Live)',
      description: 'Embed active partner perk (auto-hides if paused)',
      category: 'VietNomad Live Data',
      keywords: ['partner', 'perk', 'offer'],
      icon: Handshake,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'vnLocalPartnerOffer' })
          .run(),
    },
    {
      id: 'vnStaySearchWidget',
      title: 'Stay Search Widget',
      description: 'Inline city & stay-length search box converting to /stays',
      category: 'VietNomad Live Data',
      keywords: ['search', 'widget', 'booking'],
      icon: Search,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'vnStaySearchWidget' })
          .run(),
    },
    {
      id: 'vnRecommendedStays',
      title: 'Recommended Stays Grid (Live)',
      description: 'Auto-populated live stays filtered by city/work-ready',
      category: 'VietNomad Live Data',
      keywords: ['recommended', 'stays', 'grid'],
      icon: Building2,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'vnRecommendedStays' })
          .run(),
    },
    {
      id: 'vnRelatedGuides',
      title: 'Related Guides Block (Live)',
      description: 'Auto-synced published guides for topic clusters',
      category: 'VietNomad Live Data',
      keywords: ['related', 'guides', 'articles'],
      icon: Sparkles,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'vnRelatedGuides' })
          .run(),
    },
    {
      id: 'vnPromotionBlock',
      title: 'Promotion Banner (Live)',
      description: 'Embed active promo code (auto-hides after expiry)',
      category: 'VietNomad Live Data',
      keywords: ['promo', 'discount', 'coupon'],
      icon: BadgePercent,
      run: ({ editor, range }) =>
        deleteRange(editor, range)
          .insertContent({ type: 'vnPromotionBlock' })
          .run(),
    },
  ];
}

interface SlashMenuListRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashMenuList = React.forwardRef<
  SlashMenuListRef,
  {
    items: SlashCommandItem[];
    command: (item: SlashCommandItem) => void;
  }
>(function SlashMenuList({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event: KeyboardEvent) {
      if (items.length === 0) return false;
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        const item = items[selectedIndex];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="w-72 rounded-xl border border-[#E5DFD3] bg-white p-3 text-xs text-[#53635D] shadow-xl">
        No matching blocks found.
      </div>
    );
  }

  return (
    <div className="max-h-80 w-80 overflow-y-auto rounded-xl border border-[#E5DFD3] bg-white p-1.5 shadow-2xl">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const isSel = idx === selectedIndex;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => command(item)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
              isSel ? 'bg-[#E7F1EC] text-[#0F392E]' : 'hover:bg-[#FAF8F3]'
            }`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#E5DFD3] bg-white text-[#164E3F]">
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-xs font-semibold text-[#17221E]">
                  {item.title}
                </span>
                <span className="shrink-0 text-[9px] uppercase tracking-wide text-[#53635D]">
                  {item.category === 'VietNomad Live Data' ? 'Live' : item.category}
                </span>
              </div>
              <div className="truncate text-[10px] text-[#53635D]">{item.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
});

export function createSlashCommandExtension(callbacks: {
  openMediaPicker: () => void;
}) {
  const allItems = buildSlashCommandItems(callbacks);

  return Extension.create({
    name: 'cmsSlashCommand',
    addProseMirrorPlugins() {
      return [
        Suggestion<SlashCommandItem>({
          editor: this.editor,
          char: '/',
          items: ({ query }) => {
            const q = query.trim().toLowerCase();
            if (!q) return allItems.slice(0, 14);
            return allItems
              .filter(
                (item) =>
                  item.title.toLowerCase().includes(q) ||
                  item.description.toLowerCase().includes(q) ||
                  item.keywords.some((k) => k.includes(q))
              )
              .slice(0, 16);
          },
          command: ({ editor, range, props }) => {
            props.run({ editor, range, openMediaPicker: callbacks.openMediaPicker });
          },
          render: () => {
            let component: ReactRenderer<SlashMenuListRef> | null = null;
            let container: HTMLDivElement | null = null;

            const updatePosition = (props: SuggestionProps<SlashCommandItem>) => {
              if (!container) return;
              const rect = props.clientRect?.();
              if (!rect) return;
              container.style.left = `${Math.min(window.innerWidth - 336, Math.max(12, rect.left))}px`;
              const spaceBelow = window.innerHeight - rect.bottom;
              if (spaceBelow < 320 && rect.top > 320) {
                container.style.top = `${Math.max(12, rect.top - 320)}px`;
              } else {
                container.style.top = `${rect.bottom + 6}px`;
              }
            };

            return {
              onStart: (props) => {
                container = document.createElement('div');
                container.style.position = 'fixed';
                container.style.zIndex = '60';
                document.body.appendChild(container);
                component = new ReactRenderer(SlashMenuList, {
                  props,
                  editor: props.editor,
                });
                container.appendChild(component.element);
                updatePosition(props);
              },
              onUpdate: (props) => {
                component?.updateProps(props);
                updatePosition(props);
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  container?.remove();
                  container = null;
                  component?.destroy();
                  component = null;
                  return true;
                }
                return component?.ref?.onKeyDown(props.event) ?? false;
              },
              onExit: () => {
                container?.remove();
                container = null;
                component?.destroy();
                component = null;
              },
            };
          },
        }),
      ];
    },
  });
}
