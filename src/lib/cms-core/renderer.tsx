import React from 'react';
import {
  extractHeadingsFromDoc,
  parseSafeVideoEmbedUrl,
  sanitizeHref,
  sanitizeMediaUrl,
  slugifyHeading,
  type TiptapDoc,
  type TiptapMark,
  type TiptapNode,
} from './schema';

export type DynamicBlockRendererFn = (
  node: TiptapNode,
  key: string
) => React.ReactNode | null;

function isSafeCssColor(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  if (/^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/.test(trimmed)) return trimmed;
  return undefined;
}

function renderTextWithMarks(text: string, marks?: TiptapMark[], keyPrefix = 'm'): React.ReactNode {
  if (!marks || marks.length === 0) return text;
  let content: React.ReactNode = text;

  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    const k = `${keyPrefix}-${i}`;
    if (mark.type === 'bold') {
      content = <strong key={k} className="font-semibold text-[#17221E]">{content}</strong>;
    } else if (mark.type === 'italic') {
      content = <em key={k}>{content}</em>;
    } else if (mark.type === 'underline') {
      content = <u key={k}>{content}</u>;
    } else if (mark.type === 'strike') {
      content = <s key={k}>{content}</s>;
    } else if (mark.type === 'code') {
      content = (
        <code
          key={k}
          className="rounded bg-[#F2EDE3] px-1.5 py-0.5 font-mono text-[0.88em] text-[#0F392E]"
        >
          {content}
        </code>
      );
    } else if (mark.type === 'highlight') {
      const bg = isSafeCssColor(mark.attrs?.color) ?? '#FEF3C7';
      content = (
        <mark key={k} style={{ backgroundColor: bg }} className="rounded px-1 text-[#17221E]">
          {content}
        </mark>
      );
    } else if (mark.type === 'textStyle') {
      const color = isSafeCssColor(mark.attrs?.color);
      const bgColor = isSafeCssColor(mark.attrs?.backgroundColor);
      if (color || bgColor) {
        content = (
          <span key={k} style={{ color, backgroundColor: bgColor }}>
            {content}
          </span>
        );
      }
    } else if (mark.type === 'link') {
      const href = sanitizeHref(mark.attrs?.href);
      if (href) {
        const isExternal = href.startsWith('http://') || href.startsWith('https://');
        content = (
          <a
            key={k}
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer nofollow' : undefined}
            className="font-medium text-[#164E3F] underline decoration-[#164E3F]/40 underline-offset-2 hover:text-[#0F392E] hover:decoration-[#164E3F]"
          >
            {content}
          </a>
        );
      }
    }
  }

  return content;
}

function getAlignClass(align: unknown): string {
  if (align === 'center') return 'text-center';
  if (align === 'right') return 'text-right';
  if (align === 'justify') return 'text-justify';
  return '';
}

function nodePlainText(node: TiptapNode): string {
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  return node.content.map(nodePlainText).join('');
}

export function CmsDocRenderer({
  doc,
  locale = 'en',
  renderCustomBlock,
}: {
  doc: TiptapDoc;
  locale?: 'en' | 'vi';
  renderCustomBlock?: DynamicBlockRendererFn;
}) {
  const headings = extractHeadingsFromDoc(doc);
  const usedIds = new Map<string, number>();

  const nextHeadingId = (text: string) => {
    const base = slugifyHeading(text);
    const cnt = usedIds.get(base) ?? 0;
    usedIds.set(base, cnt + 1);
    return cnt === 0 ? base : `${base}-${cnt + 1}`;
  };

  const renderNodes = (nodes: TiptapNode[] | undefined, pathKey: string): React.ReactNode[] => {
    if (!Array.isArray(nodes)) return [];
    return nodes.map((node, idx) => renderNode(node, `${pathKey}-${idx}`));
  };

  const renderNode = (node: TiptapNode, key: string): React.ReactNode => {
    // Allow host project / VietNomad domain blocks to intercept custom nodes cleanly
    if (renderCustomBlock) {
      const custom = renderCustomBlock(node, key);
      if (custom !== null && custom !== undefined) return custom;
    }

    const attrs = node.attrs ?? {};
    const alignClass = getAlignClass(attrs.textAlign);

    switch (node.type) {
      case 'text':
        return (
          <React.Fragment key={key}>
            {renderTextWithMarks(node.text ?? '', node.marks, key)}
          </React.Fragment>
        );

      case 'hardBreak':
        return <br key={key} />;

      case 'horizontalRule':
        return <hr key={key} className="my-8 border-t border-[#E5DFD3]" />;

      case 'paragraph': {
        const children = renderNodes(node.content, key);
        return (
          <p key={key} className={`leading-relaxed text-[#17221E] ${alignClass}`}>
            {children.length > 0 ? children : <span className="sr-only">&nbsp;</span>}
          </p>
        );
      }

      case 'heading': {
        const rawLevel = Number(attrs.level ?? 2);
        const level = Math.min(6, Math.max(2, Number.isFinite(rawLevel) ? rawLevel : 2));
        const text = nodePlainText(node).trim();
        const id = nextHeadingId(text || key);
        const children = renderNodes(node.content, key);
        const common = `scroll-mt-24 font-serif-display font-semibold text-[#17221E] ${alignClass}`;
        if (level === 2) {
          return (
            <h2 key={key} id={id} className={`mt-10 mb-3 text-2xl sm:text-3xl ${common}`}>
              {children}
            </h2>
          );
        }
        if (level === 3) {
          return (
            <h3 key={key} id={id} className={`mt-7 mb-2.5 text-xl sm:text-2xl ${common}`}>
              {children}
            </h3>
          );
        }
        if (level === 4) {
          return (
            <h4 key={key} id={id} className={`mt-5 mb-2 text-lg ${common}`}>
              {children}
            </h4>
          );
        }
        if (level === 5) {
          return (
            <h5 key={key} id={id} className={`mt-4 mb-1.5 text-base ${common}`}>
              {children}
            </h5>
          );
        }
        return (
          <h6 key={key} id={id} className={`mt-4 mb-1.5 text-sm uppercase tracking-wide ${common}`}>
            {children}
          </h6>
        );
      }

      case 'bulletList':
        return (
          <ul key={key} className="my-4 list-disc space-y-1.5 pl-6 text-[#17221E]">
            {renderNodes(node.content, key)}
          </ul>
        );

      case 'orderedList':
        return (
          <ol key={key} className="my-4 list-decimal space-y-1.5 pl-6 text-[#17221E]">
            {renderNodes(node.content, key)}
          </ol>
        );

      case 'listItem':
        return <li key={key}>{renderNodes(node.content, key)}</li>;

      case 'taskList':
        return (
          <ul key={key} className="my-4 space-y-2 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-4">
            {renderNodes(node.content, key)}
          </ul>
        );

      case 'taskItem': {
        const checked = Boolean(attrs.checked);
        return (
          <li key={key} className="flex items-start gap-2.5 text-sm text-[#17221E]">
            <span
              aria-hidden="true"
              className={`mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[11px] font-bold ${
                checked
                  ? 'border-[#164E3F] bg-[#164E3F] text-white'
                  : 'border-[#C7BFB1] bg-white text-transparent'
              }`}
            >
              ✓
            </span>
            <div className="min-w-0 flex-1 [&>p]:m-0">{renderNodes(node.content, key)}</div>
          </li>
        );
      }

      case 'blockquote':
        return (
          <blockquote
            key={key}
            className="my-6 rounded-r-2xl border-l-4 border-[#164E3F] bg-[#FAF8F3] px-5 py-4 text-[#17221E] italic"
          >
            {renderNodes(node.content, key)}
          </blockquote>
        );

      case 'codeBlock': {
        const text = nodePlainText(node);
        return (
          <pre
            key={key}
            className="my-5 overflow-x-auto rounded-2xl bg-[#17221E] p-4 font-mono text-xs leading-relaxed text-[#FAF8F3]"
          >
            <code>{text}</code>
          </pre>
        );
      }

      case 'table':
        return (
          <div key={key} className="my-6 overflow-x-auto rounded-2xl border border-[#E5DFD3] bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <tbody>{renderNodes(node.content, key)}</tbody>
            </table>
          </div>
        );

      case 'tableRow':
        return (
          <tr key={key} className="border-b border-[#E5DFD3] last:border-b-0">
            {renderNodes(node.content, key)}
          </tr>
        );

      case 'tableHeader':
        return (
          <th
            key={key}
            colSpan={Number(attrs.colspan ?? 1) > 1 ? Number(attrs.colspan) : undefined}
            rowSpan={Number(attrs.rowspan ?? 1) > 1 ? Number(attrs.rowspan) : undefined}
            className="bg-[#FAF8F3] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[#53635D]"
          >
            {renderNodes(node.content, key)}
          </th>
        );

      case 'tableCell':
        return (
          <td
            key={key}
            colSpan={Number(attrs.colspan ?? 1) > 1 ? Number(attrs.colspan) : undefined}
            rowSpan={Number(attrs.rowspan ?? 1) > 1 ? Number(attrs.rowspan) : undefined}
            className="px-4 py-2.5 align-top text-sm text-[#17221E] [&>p]:m-0"
          >
            {renderNodes(node.content, key)}
          </td>
        );

      case 'image': {
        const src = sanitizeMediaUrl(attrs.src);
        if (!src) return null;
        const alt = typeof attrs.alt === 'string' ? attrs.alt : '';
        const caption = typeof attrs.caption === 'string' ? attrs.caption : '';
        const credit = typeof attrs.credit === 'string' ? attrs.credit : '';
        return (
          <figure key={key} className="my-7 overflow-hidden rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="max-h-[540px] w-full object-cover"
            />
            {(caption || credit) && (
              <figcaption className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-[#53635D]">
                <span>{caption}</span>
                {credit && <span className="text-[11px] opacity-80">{credit}</span>}
              </figcaption>
            )}
          </figure>
        );
      }

      case 'youtube': {
        const embedUrl = parseSafeVideoEmbedUrl(attrs.src);
        if (!embedUrl) return null;
        return (
          <div
            key={key}
            className="my-7 overflow-hidden rounded-2xl border border-[#E5DFD3] bg-black aspect-video"
          >
            <iframe
              src={embedUrl}
              title={typeof attrs.title === 'string' ? attrs.title : 'Embedded video'}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        );
      }

      case 'callout': {
        const tone = String(attrs.tone ?? 'info');
        const title = typeof attrs.title === 'string' ? attrs.title : '';
        const body = typeof attrs.body === 'string' ? attrs.body : '';
        const toneClasses =
          tone === 'warning'
            ? 'border-[#E6B87A] bg-[#FEF7EC] text-[#5C3D12]'
            : tone === 'tip'
              ? 'border-[#164E3F]/30 bg-[#E7F1EC] text-[#0F392E]'
              : tone === 'highlight'
                ? 'border-[#C25E28]/35 bg-[#FAEDE5] text-[#6B2F10]'
                : 'border-[#E5DFD3] bg-[#FAF8F3] text-[#17221E]';

        return (
          <aside key={key} className={`my-6 rounded-2xl border p-5 ${toneClasses}`}>
            {title && <div className="mb-1.5 text-sm font-bold">{title}</div>}
            {body && <p className="text-sm leading-relaxed whitespace-pre-line">{body}</p>}
            {Array.isArray(node.content) && node.content.length > 0 && (
              <div className="space-y-2 text-sm">{renderNodes(node.content, key)}</div>
            )}
          </aside>
        );
      }

      case 'faqGroup': {
        const items = Array.isArray(attrs.items) ? attrs.items : [];
        if (items.length === 0) return null;
        const heading =
          typeof attrs.title === 'string' && attrs.title
            ? attrs.title
            : locale === 'vi'
              ? 'Câu hỏi thường gặp'
              : 'Frequently Asked Questions';
        return (
          <section key={key} className="my-8 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-6">
            <h3 className="font-serif-display mb-4 text-xl font-semibold text-[#17221E]">{heading}</h3>
            <div className="divide-y divide-[#E5DFD3]">
              {items.map((rawItem, idx) => {
                const qa = (rawItem ?? {}) as Record<string, unknown>;
                const q = typeof qa.question === 'string' ? qa.question : '';
                const a = typeof qa.answer === 'string' ? qa.answer : '';
                if (!q) return null;
                return (
                  <details key={`${key}-faq-${idx}`} className="group py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[#17221E]">
                      <span>{q}</span>
                      <span className="text-xs text-[#164E3F] group-open:rotate-45 transition-transform">
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-[#53635D] whitespace-pre-line">
                      {a}
                    </p>
                  </details>
                );
              })}
            </div>
          </section>
        );
      }

      case 'ctaButton': {
        const label = typeof attrs.label === 'string' ? attrs.label : '';
        const url = sanitizeHref(attrs.url);
        if (!label || !url) return null;
        const variant = String(attrs.variant ?? 'primary');
        const align =
          attrs.align === 'center'
            ? 'justify-center'
            : attrs.align === 'right'
              ? 'justify-end'
              : 'justify-start';
        const btnClass =
          variant === 'secondary'
            ? 'bg-[#C25E28] text-white hover:bg-[#a94f20]'
            : variant === 'outline'
              ? 'border border-[#164E3F] text-[#164E3F] hover:bg-[#E7F1EC]'
              : 'bg-[#164E3F] text-white hover:bg-[#0F392E]';
        const isExternal = url.startsWith('http://') || url.startsWith('https://');
        return (
          <div key={key} className={`my-6 flex ${align}`}>
            <a
              href={url}
              target={attrs.newTab || isExternal ? '_blank' : undefined}
              rel={attrs.newTab || isExternal ? 'noopener noreferrer' : undefined}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${btnClass}`}
            >
              {label}
            </a>
          </div>
        );
      }

      case 'columns': {
        const items = Array.isArray(attrs.items) ? attrs.items : [];
        if (items.length === 0) return null;
        const cols = Number(attrs.columns ?? items.length) === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
        return (
          <div key={key} className={`my-7 grid gap-4 ${cols}`}>
            {items.map((rawCol, idx) => {
              const col = (rawCol ?? {}) as Record<string, unknown>;
              const heading = typeof col.heading === 'string' ? col.heading : '';
              const body = typeof col.body === 'string' ? col.body : '';
              return (
                <div
                  key={`${key}-col-${idx}`}
                  className="rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-5"
                >
                  {heading && (
                    <h4 className="font-serif-display mb-2 text-lg font-semibold text-[#17221E]">
                      {heading}
                    </h4>
                  )}
                  <p className="text-sm leading-relaxed text-[#53635D] whitespace-pre-line">{body}</p>
                </div>
              );
            })}
          </div>
        );
      }

      case 'gallery': {
        const items = Array.isArray(attrs.items) ? attrs.items : [];
        if (items.length === 0) return null;
        const gridCols = items.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
        return (
          <div key={key} className={`my-7 grid gap-4 ${gridCols}`}>
            {items.map((rawItem, idx) => {
              const item = (rawItem ?? {}) as Record<string, unknown>;
              const url = sanitizeMediaUrl(item.url);
              if (!url) return null;
              const alt = typeof item.alt === 'string' ? item.alt : '';
              const caption = typeof item.caption === 'string' ? item.caption : '';
              return (
                <figure
                  key={`${key}-gal-${idx}`}
                  className="overflow-hidden rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={alt}
                    loading="lazy"
                    decoding="async"
                    className="h-48 w-full object-cover"
                  />
                  {caption && (
                    <figcaption className="px-3 py-2 text-xs text-[#53635D]">{caption}</figcaption>
                  )}
                </figure>
              );
            })}
          </div>
        );
      }

      case 'tocBlock': {
        const maxDepth = Number(attrs.maxDepth ?? 3);
        const filtered = headings.filter((h) => h.level <= maxDepth);
        if (filtered.length === 0) return null;
        const title =
          typeof attrs.title === 'string' && attrs.title
            ? attrs.title
            : locale === 'vi'
              ? 'Mục lục bài viết'
              : 'In this guide';
        return (
          <nav
            key={key}
            aria-label={title}
            className="my-7 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-5"
          >
            <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#164E3F]">
              {title}
            </div>
            <ul className="space-y-1.5 text-sm">
              {filtered.map((h) => (
                <li
                  key={h.id}
                  style={{ paddingLeft: `${Math.max(0, h.level - 2) * 14}px` }}
                >
                  <a href={`#${h.id}`} className="text-[#53635D] hover:text-[#164E3F] hover:underline">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        );
      }

      case 'relatedArticles': {
        const items = Array.isArray(attrs.items) ? attrs.items : [];
        if (items.length === 0) return null;
        const heading =
          typeof attrs.title === 'string' && attrs.title
            ? attrs.title
            : locale === 'vi'
              ? 'Bài viết liên quan'
              : 'Related Guides';
        return (
          <aside key={key} className="my-8 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-5">
            <h3 className="font-serif-display mb-3 text-lg font-semibold text-[#17221E]">{heading}</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((rawItem, idx) => {
                const it = (rawItem ?? {}) as Record<string, unknown>;
                const slug = typeof it.slug === 'string' ? it.slug : '';
                const title = typeof it.title === 'string' ? it.title : slug;
                const summary = typeof it.summary === 'string' ? it.summary : '';
                if (!slug) return null;
                return (
                  <a
                    key={`${key}-rel-${idx}`}
                    href={`/guides/${slug}`}
                    className="rounded-xl border border-[#E5DFD3] bg-white p-4 transition hover:border-[#164E3F]"
                  >
                    <div className="text-sm font-semibold text-[#17221E]">{title}</div>
                    {summary && <p className="mt-1 line-clamp-2 text-xs text-[#53635D]">{summary}</p>}
                  </a>
                );
              })}
            </div>
          </aside>
        );
      }

      default:
        return null;
    }
  };

  return <div className="cms-prose space-y-4">{renderNodes(doc.content, 'root')}</div>;
}
