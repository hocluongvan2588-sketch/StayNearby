import { z } from 'zod';

export const CMS_SCHEMA_VERSION = 1;

export interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  text?: string;
}

export interface TiptapDoc {
  type: 'doc';
  version?: number;
  content: TiptapNode[];
}

export interface DocumentOutlineItem {
  id: string;
  level: number;
  text: string;
}

export interface ExtractedLinkInfo {
  href: string;
  anchorText: string;
  targetType:
    | 'cms_content'
    | 'stay'
    | 'destination'
    | 'neighborhood'
    | 'place'
    | 'local_partner'
    | 'promotion'
    | 'category'
    | 'other_internal'
    | 'external';
  targetId?: string;
}

export interface DynamicBlockRef {
  blockType: string;
  targetType: ExtractedLinkInfo['targetType'];
  targetId: string;
  label?: string;
}

export const EMPTY_TIPTAP_DOC: TiptapDoc = {
  type: 'doc',
  version: CMS_SCHEMA_VERSION,
  content: [{ type: 'paragraph', content: [] }],
};

export function sanitizeHref(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (trimmed.startsWith('#')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

export function sanitizeMediaUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (['http:', 'https:'].includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

export function parseSafeVideoEmbedUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (
      host === 'youtube.com' ||
      host === 'www.youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com' ||
      host === 'www.youtube-nocookie.com'
    ) {
      let videoId = url.searchParams.get('v') ?? '';
      if (!videoId && url.pathname.startsWith('/embed/')) {
        videoId = url.pathname.split('/')[2] ?? '';
      }
      if (!videoId && url.pathname.startsWith('/shorts/')) {
        videoId = url.pathname.split('/')[2] ?? '';
      }
      if (/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
        return `https://www.youtube-nocookie.com/embed/${videoId}`;
      }
      return null;
    }
    if (host === 'youtu.be') {
      const videoId = url.pathname.replace(/^\//, '').split('/')[0] ?? '';
      if (/^[a-zA-Z0-9_-]{6,20}$/.test(videoId)) {
        return `https://www.youtube-nocookie.com/embed/${videoId}`;
      }
      return null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const parts = url.pathname.split('/').filter(Boolean);
      const id = parts[parts.length - 1] ?? '';
      if (/^\d{4,15}$/.test(id)) {
        return `https://player.vimeo.com/video/${id}`;
      }
      return null;
    }
  } catch {
    return null;
  }
  return null;
}

export function slugifyHeading(text: string): string {
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  return normalized || 'section';
}

const tiptapMarkSchema: z.ZodType<TiptapMark> = z.object({
  type: z.string().min(1).max(60),
  attrs: z.record(z.string(), z.unknown()).optional(),
});

const tiptapNodeSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.object({
    type: z.string().min(1).max(80),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(tiptapNodeSchema).optional(),
    marks: z.array(tiptapMarkSchema).optional(),
    text: z.string().optional(),
  })
);

export const tiptapDocSchema = z.object({
  type: z.literal('doc'),
  version: z.number().int().positive().optional(),
  content: z.array(tiptapNodeSchema).default([]),
});

function sanitizeNodeRecursive(node: TiptapNode): TiptapNode {
  const next: TiptapNode = { type: node.type };

  if (node.attrs && typeof node.attrs === 'object') {
    const cleanAttrs: Record<string, unknown> = { ...node.attrs };

    // Prevent H1 inside rich-text body (H1 is strictly reserved for the article title)
    if (node.type === 'heading') {
      const lvl = Number(cleanAttrs.level ?? 2);
      cleanAttrs.level = Number.isFinite(lvl) ? Math.min(6, Math.max(2, Math.round(lvl))) : 2;
    }

    if (node.type === 'image') {
      cleanAttrs.src = sanitizeMediaUrl(cleanAttrs.src);
    }

    if (node.type === 'youtube') {
      cleanAttrs.src = parseSafeVideoEmbedUrl(cleanAttrs.src) ?? '';
    }

    if (node.type === 'ctaButton') {
      cleanAttrs.url = sanitizeHref(cleanAttrs.url) || '#';
    }

    if (node.type === 'gallery' && Array.isArray(cleanAttrs.items)) {
      cleanAttrs.items = cleanAttrs.items
        .map((it) => {
          if (!it || typeof it !== 'object') return null;
          const item = it as Record<string, unknown>;
          const safeUrl = sanitizeMediaUrl(item.url);
          if (!safeUrl) return null;
          return {
            mediaId: typeof item.mediaId === 'string' ? item.mediaId : undefined,
            url: safeUrl,
            alt: typeof item.alt === 'string' ? item.alt : '',
            caption: typeof item.caption === 'string' ? item.caption : '',
          };
        })
        .filter(Boolean);
    }

    next.attrs = cleanAttrs;
  }

  if (typeof node.text === 'string') {
    next.text = node.text;
  }

  if (Array.isArray(node.marks)) {
    next.marks = node.marks
      .map((mark) => {
        if (mark.type === 'link') {
          const href = sanitizeHref(mark.attrs?.href);
          if (!href) return null;
          return {
            type: 'link',
            attrs: {
              ...mark.attrs,
              href,
            },
          };
        }
        return mark;
      })
      .filter((m): m is TiptapMark => Boolean(m));
  }

  if (Array.isArray(node.content)) {
    next.content = node.content.map(sanitizeNodeRecursive);
  }

  return next;
}

export function normalizeTiptapDoc(input: unknown): TiptapDoc {
  if (!input || typeof input !== 'object') {
    return EMPTY_TIPTAP_DOC;
  }
  const parsed = tiptapDocSchema.safeParse(input);
  if (!parsed.success) {
    return EMPTY_TIPTAP_DOC;
  }
  const normalizedContent =
    parsed.data.content.length > 0
      ? parsed.data.content.map(sanitizeNodeRecursive)
      : [{ type: 'paragraph', content: [] }];

  return {
    type: 'doc',
    version: CMS_SCHEMA_VERSION,
    content: normalizedContent,
  };
}

export function legacyTextToTiptapDoc(rawText: string | null | undefined): TiptapDoc {
  const clean = (rawText ?? '').trim();
  if (!clean) return EMPTY_TIPTAP_DOC;

  const nodes = markdownToTiptapNodes(clean);
  return {
    type: 'doc',
    version: CMS_SCHEMA_VERSION,
    content: nodes.length > 0 ? nodes : [{ type: 'paragraph', content: [] }],
  };
}

function parseInlineMarkdown(line: string): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIdx) {
      nodes.push({ type: 'text', text: line.slice(lastIdx, match.index) });
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push({
        type: 'text',
        text: token.slice(2, -2),
        marks: [{ type: 'bold' }],
      });
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const href = sanitizeHref(linkMatch[2]);
        if (href) {
          nodes.push({
            type: 'text',
            text: linkMatch[1],
            marks: [{ type: 'link', attrs: { href } }],
          });
        } else {
          nodes.push({ type: 'text', text: linkMatch[1] });
        }
      }
    }
    lastIdx = match.index + token.length;
  }

  if (lastIdx < line.length) {
    nodes.push({ type: 'text', text: line.slice(lastIdx) });
  }

  return nodes.length > 0 ? nodes : [{ type: 'text', text: line }];
}

export function markdownToTiptapNodes(raw: string): TiptapNode[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const nodes: TiptapNode[] = [];
  let bulletBuffer: TiptapNode[] = [];
  let orderedBuffer: TiptapNode[] = [];

  const flushLists = () => {
    if (bulletBuffer.length > 0) {
      nodes.push({ type: 'bulletList', content: bulletBuffer });
      bulletBuffer = [];
    }
    if (orderedBuffer.length > 0) {
      nodes.push({ type: 'orderedList', content: orderedBuffer });
      orderedBuffer = [];
    }
  };

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line) {
      flushLists();
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      flushLists();
      const rawLevel = headingMatch[1].length;
      const level = Math.min(6, Math.max(2, rawLevel));
      nodes.push({
        type: 'heading',
        attrs: { level },
        content: parseInlineMarkdown(headingMatch[2].trim()),
      });
      continue;
    }

    if (line.startsWith('> ')) {
      flushLists();
      nodes.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: parseInlineMarkdown(line.slice(2).trim()) }],
      });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (orderedBuffer.length > 0) flushLists();
      bulletBuffer.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: parseInlineMarkdown(line.replace(/^[-*]\s+/, '')) }],
      });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      if (bulletBuffer.length > 0) flushLists();
      orderedBuffer.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: parseInlineMarkdown(line.replace(/^\d+\.\s+/, '')) }],
      });
      continue;
    }

    if (line === '---' || line === '***') {
      flushLists();
      nodes.push({ type: 'horizontalRule' });
      continue;
    }

    flushLists();
    nodes.push({
      type: 'paragraph',
      content: parseInlineMarkdown(line),
    });
  }

  flushLists();
  return nodes;
}

/**
 * Strips proprietary Word/Google Docs junk styles, empty spans, comments,
 * script/style tags, and dangerous attributes on paste inside the editor.
 */
export function cleanPastedHtml(html: string): string {
  if (!html) return '';
  let out = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|meta|link|xml|o:p)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(o:p|w:[^>\s]+|v:[^>\s]+|font|span)[^>]*>/gi, (tag) => {
      if (/^<span/i.test(tag) || /^<\/span/i.test(tag)) return '';
      if (/^<font/i.test(tag) || /^<\/font/i.test(tag)) return '';
      return '';
    });

  // Remove inline style/class/id/on* handlers from Word/Google Docs HTML
  out = out
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(style|class|id|lang|dir|data-[a-z0-9-]+)\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/<h1>/gi, '<h2>')
    .replace(/<\/h1>/gi, '</h2>');

  return out;
}

function collectText(node: TiptapNode, chunks: string[]): void {
  if (typeof node.text === 'string') {
    chunks.push(node.text);
  }
  if (node.type === 'callout') {
    if (typeof node.attrs?.title === 'string') chunks.push(node.attrs.title);
    if (typeof node.attrs?.body === 'string') chunks.push(node.attrs.body);
  }
  if (node.type === 'faqGroup' && Array.isArray(node.attrs?.items)) {
    for (const item of node.attrs.items) {
      if (item && typeof item === 'object') {
        const qa = item as Record<string, unknown>;
        if (typeof qa.question === 'string') chunks.push(qa.question);
        if (typeof qa.answer === 'string') chunks.push(qa.answer);
      }
    }
  }
  if (node.type === 'columns' && Array.isArray(node.attrs?.items)) {
    for (const col of node.attrs.items) {
      if (col && typeof col === 'object') {
        const c = col as Record<string, unknown>;
        if (typeof c.heading === 'string') chunks.push(c.heading);
        if (typeof c.body === 'string') chunks.push(c.body);
      }
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectText(child, chunks);
    }
    if (['paragraph', 'heading', 'listItem', 'blockquote'].includes(node.type)) {
      chunks.push('\n');
    }
  }
}

export function extractPlainTextFromDoc(doc: TiptapDoc | null | undefined): string {
  if (!doc || !Array.isArray(doc.content)) return '';
  const chunks: string[] = [];
  for (const node of doc.content) {
    collectText(node, chunks);
  }
  return chunks
    .join(' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function extractHeadingsFromDoc(doc: TiptapDoc | null | undefined): DocumentOutlineItem[] {
  if (!doc || !Array.isArray(doc.content)) return [];
  const items: DocumentOutlineItem[] = [];
  const usedIds = new Map<string, number>();

  const walk = (node: TiptapNode) => {
    if (node.type === 'heading') {
      const textChunks: string[] = [];
      collectText(node, textChunks);
      const text = textChunks.join(' ').trim();
      if (text) {
        const base = slugifyHeading(text);
        const count = usedIds.get(base) ?? 0;
        usedIds.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count + 1}`;
        const lvl = Number(node.attrs?.level ?? 2);
        items.push({
          id,
          level: Math.min(6, Math.max(2, Number.isFinite(lvl) ? lvl : 2)),
          text,
        });
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  };

  for (const n of doc.content) walk(n);
  return items;
}

export function extractImagesFromDoc(
  doc: TiptapDoc | null | undefined
): Array<{ src: string; alt: string; mediaId?: string }> {
  if (!doc || !Array.isArray(doc.content)) return [];
  const imgs: Array<{ src: string; alt: string; mediaId?: string }> = [];

  const walk = (node: TiptapNode) => {
    if (node.type === 'image') {
      const src = sanitizeMediaUrl(node.attrs?.src);
      if (src) {
        imgs.push({
          src,
          alt: typeof node.attrs?.alt === 'string' ? node.attrs.alt : '',
          mediaId: typeof node.attrs?.mediaId === 'string' ? node.attrs.mediaId : undefined,
        });
      }
    }
    if (node.type === 'gallery' && Array.isArray(node.attrs?.items)) {
      for (const it of node.attrs.items) {
        if (it && typeof it === 'object') {
          const item = it as Record<string, unknown>;
          const src = sanitizeMediaUrl(item.url);
          if (src) {
            imgs.push({
              src,
              alt: typeof item.alt === 'string' ? item.alt : '',
              mediaId: typeof item.mediaId === 'string' ? item.mediaId : undefined,
            });
          }
        }
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  };

  for (const n of doc.content) walk(n);
  return imgs;
}

export function classifyInternalHref(href: string): {
  isInternal: boolean;
  targetType: ExtractedLinkInfo['targetType'];
  targetSlug?: string;
} {
  if (!href) return { isInternal: false, targetType: 'external' };
  let pathname = href;
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return { isInternal: false, targetType: 'external' };
  }
  if (!href.startsWith('/')) {
    return { isInternal: false, targetType: 'external' };
  }
  pathname = href.split(/[?#]/)[0] ?? '/';
  if (pathname.startsWith('/guides/')) {
    const slug = pathname.slice('/guides/'.length).split('/')[0];
    return { isInternal: true, targetType: 'cms_content', targetSlug: slug };
  }
  if (pathname.startsWith('/stays/')) {
    const slug = pathname.slice('/stays/'.length).split('/')[0];
    return { isInternal: true, targetType: 'stay', targetSlug: slug };
  }
  if (pathname.startsWith('/destinations/')) {
    const slug = pathname.slice('/destinations/'.length).split('/')[0];
    return { isInternal: true, targetType: 'destination', targetSlug: slug };
  }
  return { isInternal: true, targetType: 'other_internal' };
}

export function extractLinksFromDoc(doc: TiptapDoc | null | undefined): ExtractedLinkInfo[] {
  if (!doc || !Array.isArray(doc.content)) return [];
  const links: ExtractedLinkInfo[] = [];

  const walk = (node: TiptapNode) => {
    if (typeof node.text === 'string' && Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (mark.type === 'link') {
          const href = sanitizeHref(mark.attrs?.href);
          if (href) {
            const cls = classifyInternalHref(href);
            links.push({
              href,
              anchorText: node.text.trim(),
              targetType: cls.targetType,
              targetId: cls.targetSlug,
            });
          }
        }
      }
    }
    if (node.type === 'ctaButton') {
      const href = sanitizeHref(node.attrs?.url);
      if (href) {
        const cls = classifyInternalHref(href);
        links.push({
          href,
          anchorText: typeof node.attrs?.label === 'string' ? node.attrs.label : 'CTA',
          targetType: cls.targetType,
          targetId: cls.targetSlug,
        });
      }
    }
    if (node.type === 'relatedArticles' && Array.isArray(node.attrs?.items)) {
      for (const item of node.attrs.items) {
        if (item && typeof item === 'object') {
          const r = item as Record<string, unknown>;
          const slug = typeof r.slug === 'string' ? r.slug : '';
          if (slug) {
            links.push({
              href: `/guides/${slug}`,
              anchorText: typeof r.title === 'string' ? r.title : slug,
              targetType: 'cms_content',
              targetId: slug,
            });
          }
        }
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  };

  for (const n of doc.content) walk(n);
  return links;
}

export function extractDynamicRefsFromDoc(doc: TiptapDoc | null | undefined): DynamicBlockRef[] {
  if (!doc || !Array.isArray(doc.content)) return [];
  const refs: DynamicBlockRef[] = [];

  const walk = (node: TiptapNode) => {
    const attrs = node.attrs ?? {};
    if (node.type === 'vnStayListing' && typeof attrs.stayId === 'string' && attrs.stayId) {
      refs.push({ blockType: node.type, targetType: 'stay', targetId: attrs.stayId });
    } else if (
      node.type === 'vnDestinationCard' &&
      typeof attrs.destinationId === 'string' &&
      attrs.destinationId
    ) {
      refs.push({ blockType: node.type, targetType: 'destination', targetId: attrs.destinationId });
    } else if (
      node.type === 'vnNeighborhoodCard' &&
      typeof attrs.neighborhoodId === 'string' &&
      attrs.neighborhoodId
    ) {
      refs.push({
        blockType: node.type,
        targetType: 'neighborhood',
        targetId: attrs.neighborhoodId,
      });
    } else if (
      node.type === 'vnLocalPlaceCard' &&
      typeof attrs.placeId === 'string' &&
      attrs.placeId
    ) {
      refs.push({ blockType: node.type, targetType: 'place', targetId: attrs.placeId });
    } else if (
      node.type === 'vnDestinationMap' &&
      typeof attrs.destinationId === 'string' &&
      attrs.destinationId
    ) {
      refs.push({ blockType: node.type, targetType: 'destination', targetId: attrs.destinationId });
    } else if (
      node.type === 'vnLocalPartnerOffer' &&
      typeof attrs.partnerId === 'string' &&
      attrs.partnerId
    ) {
      refs.push({ blockType: node.type, targetType: 'local_partner', targetId: attrs.partnerId });
    } else if (
      node.type === 'vnPromotionBlock' &&
      typeof attrs.promotionId === 'string' &&
      attrs.promotionId
    ) {
      refs.push({ blockType: node.type, targetType: 'promotion', targetId: attrs.promotionId });
    } else if (node.type === 'vnRelatedGuides' && Array.isArray(attrs.contentIds)) {
      for (const cid of attrs.contentIds) {
        if (typeof cid === 'string' && cid) {
          refs.push({ blockType: node.type, targetType: 'cms_content', targetId: cid });
        }
      }
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  };

  for (const n of doc.content) walk(n);
  return refs;
}

export function computeReadingMetrics(doc: TiptapDoc | null | undefined): {
  wordCount: number;
  characterCount: number;
  readingTimeMinutes: number;
} {
  const text = extractPlainTextFromDoc(doc);
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const characterCount = text.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 220));
  return { wordCount, characterCount, readingTimeMinutes };
}
