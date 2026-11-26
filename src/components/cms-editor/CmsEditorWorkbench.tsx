'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import DragHandle from '@tiptap/extension-drag-handle-react';
import type { AnyExtension } from '@tiptap/core';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  CalendarClock,
  Check,
  CheckSquare,
  Code2,
  ExternalLink,
  Eye,
  GripVertical,
  Highlighter,
  History,
  Image as ImageIcon,
  Italic,
  Keyboard,
  Languages,
  Link2,
  List,
  ListOrdered,
  ListTree,
  Maximize2,
  Minimize2,
  PanelLeft,
  PanelRight,
  Plus,
  Quote,
  Redo2,
  RemoveFormatting,
  Replace,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
  Strikethrough,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
  Youtube as YoutubeIcon,
} from 'lucide-react';
import { createStandardCmsExtensions } from '@/lib/cms-core/extensions';
import { createVietNomadBlockExtensions } from '@/lib/cms-core/vn-blocks-extensions';
import {
  cleanPastedHtml,
  computeReadingMetrics,
  EMPTY_TIPTAP_DOC,
  extractHeadingsFromDoc,
  extractPlainTextFromDoc,
  legacyTextToTiptapDoc,
  normalizeTiptapDoc,
  type TiptapDoc,
} from '@/lib/cms-core/schema';
import { analyzeSeoContent } from '@/lib/cms-core/seo-analyzer';
import type {
  CmsCategoryItem,
  CmsContentDetail,
  CmsContentType,
  CmsSchemaType,
  CmsTagItem,
  CmsWorkflowStatus,
} from '@/modules/cms-vietnomad/types';
import { MediaLibraryModal } from './MediaLibraryModal';
import { InternalLinkPickerModal } from './InternalLinkPickerModal';
import { SeoPanel } from './SeoPanel';
import { buildSlashCommandItems, createSlashCommandExtension } from './SlashCommandMenu';
import { AiAssistantPanel } from './AiAssistantPanel';

interface DestOption {
  id: string;
  slug: string;
  nameEn: string;
}

interface NbOption {
  id: string;
  destinationId: string;
  nameEn: string;
}

function slugifyInput(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const STATUS_BADGE_MAP: Record<CmsWorkflowStatus, string> = {
  draft: 'bg-[#F2EDE3] text-[#53635D]',
  in_review: 'bg-[#FEF7EC] text-[#9A5B13]',
  approved: 'bg-[#E7F1EC] text-[#164E3F]',
  scheduled: 'bg-[#E8EEF8] text-[#1D4ED8]',
  published: 'bg-[#164E3F] text-white',
  archived: 'bg-[#EAE6DF] text-[#7A7A7A]',
};

export function CmsEditorWorkbench({
  initialDetail,
  categories,
  tags,
  destinations,
  neighborhoods,
  canApprove,
}: {
  initialDetail: CmsContentDetail | null;
  categories: CmsCategoryItem[];
  tags: CmsTagItem[];
  destinations: DestOption[];
  neighborhoods: NbOption[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const isNewInitial = !initialDetail;

  const [contentId, setContentId] = useState<string | undefined>(initialDetail?.id);
  const [contentType, setContentType] = useState<CmsContentType>(
    initialDetail?.contentType ?? 'article'
  );
  const [locale, setLocale] = useState<'en' | 'vi'>(initialDetail?.locale ?? 'en');
  const translationGroupId = initialDetail?.translationGroupId ?? null;
  const [categoryId, setCategoryId] = useState<string>(initialDetail?.categoryId ?? '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialDetail?.tagIds ?? []);
  const [destinationId, setDestinationId] = useState<string>(initialDetail?.destinationId ?? '');
  const [neighborhoodId, setNeighborhoodId] = useState<string>(
    initialDetail?.neighborhoodId ?? ''
  );

  const [titleEn, setTitleEn] = useState(initialDetail?.titleEn ?? '');
  const [titleVi, setTitleVi] = useState(initialDetail?.titleVi ?? '');
  const [excerptEn, setExcerptEn] = useState(initialDetail?.excerptEn ?? '');
  const [excerptVi, setExcerptVi] = useState(initialDetail?.excerptVi ?? '');
  const [slug, setSlug] = useState(initialDetail?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!isNewInitial);
  const [initialPublishedSlug] = useState(
    initialDetail?.publishedAt ? initialDetail.slug : ''
  );
  const [createRedirectOnSlugChange, setCreateRedirectOnSlugChange] = useState(true);

  const [docEn, setDocEn] = useState<TiptapDoc>(
    initialDetail?.bodyDocEn ?? EMPTY_TIPTAP_DOC
  );
  const [docVi, setDocVi] = useState<TiptapDoc>(
    initialDetail?.bodyDocVi ?? EMPTY_TIPTAP_DOC
  );

  const [featuredMediaId, setFeaturedMediaId] = useState<string | null>(
    initialDetail?.featuredMediaId ?? null
  );
  const [featuredImageUrl, setFeaturedImageUrl] = useState(
    initialDetail?.featuredImageUrl ?? ''
  );

  // SEO fields
  const [seoTitle, setSeoTitle] = useState(initialDetail?.seoTitle ?? '');
  const [seoDescription, setSeoDescription] = useState(initialDetail?.seoDescription ?? '');
  const [focusKeyword, setFocusKeyword] = useState(initialDetail?.focusKeyword ?? '');
  const [secondaryKeywords, setSecondaryKeywords] = useState<string[]>(
    initialDetail?.secondaryKeywords ?? []
  );
  const [canonicalUrl, setCanonicalUrl] = useState(initialDetail?.canonicalUrl ?? '');
  const [redirectTo, setRedirectTo] = useState(initialDetail?.redirectTo ?? '');
  const [ogTitle, setOgTitle] = useState(initialDetail?.ogTitle ?? '');
  const [ogDescription, setOgDescription] = useState(initialDetail?.ogDescription ?? '');
  const [ogImageUrl, setOgImageUrl] = useState(initialDetail?.ogImageUrl ?? '');
  const [robotsIndex, setRobotsIndex] = useState(initialDetail?.robotsIndex ?? true);
  const [robotsFollow, setRobotsFollow] = useState(initialDetail?.robotsFollow ?? true);
  const [schemaType, setSchemaType] = useState<CmsSchemaType>(
    initialDetail?.schemaType ?? 'Article'
  );
  const [breadcrumbTitle, setBreadcrumbTitle] = useState(
    initialDetail?.breadcrumbTitle ?? ''
  );

  // Publishing & workflow state
  const [status, setStatus] = useState<CmsWorkflowStatus>(initialDetail?.status ?? 'draft');
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(
    initialDetail?.hasUnpublishedChanges ?? false
  );
  const [scheduledAt, setScheduledAt] = useState(
    initialDetail?.scheduledAt ? initialDetail.scheduledAt.slice(0, 16) : ''
  );
  const publishStartAt = initialDetail?.publishStartAt
    ? initialDetail.publishStartAt.slice(0, 16)
    : '';
  const [publishEndAt, setPublishEndAt] = useState(
    initialDetail?.publishEndAt ? initialDetail.publishEndAt.slice(0, 16) : ''
  );

  // UI Workspace state
  const [fullscreen, setFullscreen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<'blocks' | 'outline'>('blocks');
  const [rightOpen, setRightOpen] = useState(true);
  const [rightTab, setRightTab] = useState<
    'general' | 'seo' | 'links' | 'languages' | 'revisions' | 'ai'
  >('general');
  const [mediaModalMode, setMediaModalMode] = useState<
    null | 'editor' | 'featured' | 'og'
  >(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [selectedEditorText, setSelectedEditorText] = useState('');

  // Autosave & feedback
  const [autosaveState, setAutosaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>(
    'idle'
  );
  const [lastSavedLabel, setLastSavedLabel] = useState(
    initialDetail?.lastAutosavedAt ? initialDetail.lastAutosavedAt.slice(11, 16) : ''
  );
  const [toast, setToast] = useState<string | null>(null);
  const [detailMeta, setDetailMeta] = useState<{
    revisions: CmsContentDetail['revisions'];
    internalLinks: CmsContentDetail['internalLinks'];
    translations: CmsContentDetail['translations'];
    duplicateFocusKeywords: CmsContentDetail['duplicateFocusKeywords'];
  }>({
    revisions: initialDetail?.revisions ?? [],
    internalLinks: initialDetail?.internalLinks ?? [],
    translations: initialDetail?.translations ?? [],
    duplicateFocusKeywords: initialDetail?.duplicateFocusKeywords ?? [],
  });

  const activeTitle = locale === 'vi' ? titleVi : titleEn;
  const activeExcerpt = locale === 'vi' ? excerptVi : excerptEn;
  const activeDoc = locale === 'vi' ? docVi : docEn;

  const openEditorMedia = useCallback(() => {
    setMediaModalMode('editor');
  }, []);

  const extensions = useMemo<AnyExtension[]>(() => {
    return createStandardCmsExtensions({
      placeholder:
        locale === 'vi'
          ? 'Bắt đầu viết nội dung, hoặc gõ "/" để chèn block VietNomad...'
          : 'Start writing your guide, or type "/" to insert a block...',
      extraExtensions: [
        ...createVietNomadBlockExtensions(),
        createSlashCommandExtension({
          openMediaPicker: openEditorMedia,
        }),
      ],
    });
  }, [locale, openEditorMedia]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: activeDoc,
    editorProps: {
      attributes: {
        class:
          'cms-editor-surface prose max-w-none min-h-[460px] focus:outline-none text-[15px] leading-relaxed text-[#17221E]',
      },
      transformPastedHTML(html) {
        return cleanPastedHtml(html);
      },
    },
    onUpdate({ editor: ed }) {
      const json = normalizeTiptapDoc(ed.getJSON());
      if (locale === 'vi') setDocVi(json);
      else setDocEn(json);
      setAutosaveState('dirty');
    },
    onSelectionUpdate({ editor: ed }) {
      const { from, to } = ed.state.selection;
      if (to > from) {
        setSelectedEditorText(ed.state.doc.textBetween(from, to, ' '));
      } else {
        setSelectedEditorText('');
      }
    },
  });

  // Sync editor content cleanly when switching locale tabs
  const prevLocaleRef = useRef(locale);
  useEffect(() => {
    if (!editor) return;
    if (prevLocaleRef.current !== locale) {
      prevLocaleRef.current = locale;
      const target = locale === 'vi' ? docVi : docEn;
      editor.commands.setContent(target, { emitUpdate: false });
    }
  }, [locale, editor, docEn, docVi]);

  // Live SEO report & outline & reading metrics
  const seoReport = useMemo(() => {
    return analyzeSeoContent({
      title: activeTitle,
      excerpt: activeExcerpt,
      slug,
      seoTitle,
      seoDescription,
      focusKeyword,
      secondaryKeywords,
      featuredImageUrl,
      doc: activeDoc,
    });
  }, [
    activeTitle,
    activeExcerpt,
    slug,
    seoTitle,
    seoDescription,
    focusKeyword,
    secondaryKeywords,
    featuredImageUrl,
    activeDoc,
  ]);

  const outlineHeadings = useMemo(() => extractHeadingsFromDoc(activeDoc), [activeDoc]);
  const readingStats = useMemo(() => computeReadingMetrics(activeDoc), [activeDoc]);
  const slashItems = useMemo(
    () => buildSlashCommandItems({ openMediaPicker: () => setMediaModalMode('editor') }),
    []
  );

  const persistContent = useCallback(
    async (mode: 'autosave' | 'save_draft' | 'publish_now', changeSummary?: string) => {
      if (!titleEn.trim() && !titleVi.trim()) {
        if (mode !== 'autosave') setToast('Please enter a title before saving.');
        return;
      }
      setAutosaveState('saving');
      try {
        const res = await fetch('/api/admin/cms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: contentId,
            contentType,
            categoryId: categoryId || null,
            locale,
            translationGroupId,
            slug: slug || slugifyInput(titleEn || titleVi) || 'untitled-guide',
            titleEn: titleEn || titleVi || 'Untitled Draft',
            titleVi: titleVi || titleEn || 'Untitled Draft',
            excerptEn,
            excerptVi,
            bodyDocEn: docEn,
            bodyDocVi: docVi,
            destinationId: destinationId || null,
            neighborhoodId: neighborhoodId || null,
            featuredMediaId,
            featuredImageUrl,
            seoTitle,
            seoDescription,
            focusKeyword,
            secondaryKeywords,
            canonicalUrl,
            redirectTo,
            ogTitle,
            ogDescription,
            ogImageUrl,
            robotsIndex,
            robotsFollow,
            schemaType,
            breadcrumbTitle,
            publishStartAt: publishStartAt || null,
            publishEndAt: publishEndAt || null,
            scheduledAt: scheduledAt || null,
            tagIds: selectedTagIds,
            mode,
            createRedirectOnSlugChange,
            changeSummary,
          }),
        });
        const data = (await res.json()) as {
          id?: string;
          slug?: string;
          status?: CmsWorkflowStatus;
          error?: string;
        };
        if (!res.ok) {
          setAutosaveState('error');
          if (mode !== 'autosave') setToast(data.error ?? 'Save failed');
          return;
        }

        const savedId = data.id ?? contentId;
        if (savedId && !contentId) {
          setContentId(savedId);
          window.history.replaceState(null, '', `/admin/growth/content/${savedId}`);
        }
        if (data.slug) setSlug(data.slug);
        if (data.status) setStatus(data.status);
        setHasUnpublishedChanges(mode !== 'publish_now' && data.status === 'published');
        setAutosaveState('saved');
        setLastSavedLabel(new Date().toTimeString().slice(0, 5));

        if (savedId) {
          const detailRes = await fetch(`/api/admin/cms/${savedId}`);
          if (detailRes.ok) {
            const det = (await detailRes.json()) as CmsContentDetail;
            setDetailMeta({
              revisions: det.revisions,
              internalLinks: det.internalLinks,
              translations: det.translations,
              duplicateFocusKeywords: det.duplicateFocusKeywords,
            });
          }
        }
        if (mode === 'publish_now') {
          setToast('Published live and updated storefront cache.');
        } else if (mode === 'save_draft') {
          setToast('Draft saved.');
        }
      } catch {
        setAutosaveState('error');
      }
    },
    [
      contentId,
      contentType,
      categoryId,
      locale,
      translationGroupId,
      slug,
      titleEn,
      titleVi,
      excerptEn,
      excerptVi,
      docEn,
      docVi,
      destinationId,
      neighborhoodId,
      featuredMediaId,
      featuredImageUrl,
      seoTitle,
      seoDescription,
      focusKeyword,
      secondaryKeywords,
      canonicalUrl,
      redirectTo,
      ogTitle,
      ogDescription,
      ogImageUrl,
      robotsIndex,
      robotsFollow,
      schemaType,
      breadcrumbTitle,
      publishStartAt,
      publishEndAt,
      scheduledAt,
      selectedTagIds,
      createRedirectOnSlugChange,
    ]
  );

  // Debounced autosave (2.5s after changes when title exists)
  useEffect(() => {
    if (autosaveState !== 'dirty') return;
    if (!titleEn.trim() && !titleVi.trim()) return;
    const timer = setTimeout(() => {
      void persistContent('autosave');
    }, 2500);
    return () => clearTimeout(timer);
  }, [autosaveState, titleEn, titleVi, persistContent]);

  // Global keyboard shortcuts (Cmd/Ctrl+S, Cmd/Ctrl+F, Cmd/Ctrl+Shift+F)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void persistContent('save_draft');
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFullscreen((f) => !f);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [persistContent]);

  async function runWorkflow(
    action:
      | 'submit_review'
      | 'approve'
      | 'schedule'
      | 'publish'
      | 'unpublish_to_draft'
      | 'archive'
      | 'restore_revision',
    opts?: { revisionId?: string }
  ) {
    if (!contentId) {
      await persistContent('save_draft');
      return;
    }
    const res = await fetch(`/api/admin/cms/${contentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'workflow',
        action,
        scheduledAt: action === 'schedule' ? scheduledAt : undefined,
        revisionId: opts?.revisionId,
      }),
    });
    const data = (await res.json()) as { status?: CmsWorkflowStatus; error?: string };
    if (!res.ok) {
      setToast(data.error ?? 'Workflow update failed');
      return;
    }
    if (data.status) setStatus(data.status);
    if (action === 'publish') setHasUnpublishedChanges(false);

    const detRes = await fetch(`/api/admin/cms/${contentId}`);
    if (detRes.ok) {
      const det = (await detRes.json()) as CmsContentDetail;
      setDocEn(det.bodyDocEn);
      setDocVi(det.bodyDocVi);
      if (editor) {
        editor.commands.setContent(locale === 'vi' ? det.bodyDocVi : det.bodyDocEn, {
          emitUpdate: false,
        });
      }
      setDetailMeta({
        revisions: det.revisions,
        internalLinks: det.internalLinks,
        translations: det.translations,
        duplicateFocusKeywords: det.duplicateFocusKeywords,
      });
    }
    setToast(`Updated status to ${data.status ?? action}.`);
  }

  async function handleCreateTranslation(targetLocale: 'en' | 'vi') {
    if (!contentId) {
      setToast('Save the draft once before creating a translation sibling.');
      return;
    }
    const res = await fetch(`/api/admin/cms/${contentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'create_translation', targetLocale }),
    });
    const data = (await res.json()) as { id?: string; error?: string };
    if (res.ok && data.id) {
      router.push(`/admin/growth/content/${data.id}`);
    } else {
      setToast(data.error ?? 'Could not create translation.');
    }
  }

  function handleFindReplaceAll() {
    if (!editor || !findText) return;
    const html = editor.getHTML();
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const replaced = html.replace(new RegExp(escaped, 'g'), replaceText);
    editor.commands.setContent(replaced, { emitUpdate: true });
    setToast(`Replaced occurrences of "${findText}".`);
  }

  const filteredNeighborhoods = destinationId
    ? neighborhoods.filter((n) => n.destinationId === destinationId)
    : neighborhoods;

  return (
    <div
      className={`flex flex-col bg-[#FAF8F3] ${
        fullscreen ? 'fixed inset-0 z-50 h-screen' : '-m-6 min-h-[calc(100vh-3.5rem)]'
      }`}
    >
      {/* Top Gutenberg-style Sticky Bar */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b border-[#E5DFD3] bg-white px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/growth/content"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5DFD3] px-2.5 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Content</span>
          </Link>

          <button
            type="button"
            onClick={() => setLeftOpen((v) => !v)}
            title="Toggle Blocks & Outline"
            className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium ${
              leftOpen
                ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                : 'border-[#E5DFD3] text-[#53635D]'
            }`}
          >
            <PanelLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Blocks</span>
          </button>

          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_BADGE_MAP[status]}`}
          >
            {status.replace('_', ' ')}
          </span>

          {hasUnpublishedChanges && (
            <span className="rounded-full bg-[#FEF7EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#9A5B13]">
              Unpublished draft edits
            </span>
          )}

          <span className="hidden text-[11px] text-[#53635D] md:inline">
            {autosaveState === 'saving'
              ? 'Saving...'
              : autosaveState === 'dirty'
                ? 'Unsaved edits'
                : autosaveState === 'error'
                  ? 'Save error'
                  : lastSavedLabel
                    ? `Saved ${lastSavedLabel}`
                    : 'Ready'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => editor?.chain().focus().undo().run()}
            disabled={!editor?.can().undo()}
            title="Undo (Ctrl+Z)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5DFD3] text-[#53635D] hover:bg-[#FAF8F3] disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().redo().run()}
            disabled={!editor?.can().redo()}
            title="Redo (Ctrl+Shift+Z)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5DFD3] text-[#53635D] hover:bg-[#FAF8F3] disabled:opacity-40"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          {contentId && (
            <Link
              href={`/guides/${slug || contentId}?preview=1`}
              target="_blank"
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5DFD3] px-2.5 text-xs font-medium text-[#17221E] hover:bg-[#FAF8F3]"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Preview</span>
              <ExternalLink className="h-3 w-3 opacity-60" />
            </Link>
          )}

          <button
            type="button"
            onClick={() => void persistContent('save_draft')}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5DFD3] bg-white px-3 text-xs font-semibold text-[#17221E] hover:bg-[#FAF8F3]"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Draft</span>
          </button>

          {status === 'draft' && contentId && (
            <button
              type="button"
              onClick={() => void runWorkflow('submit_review')}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E6B87A] bg-[#FEF7EC] px-3 text-xs font-semibold text-[#7D4B12]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Submit Review</span>
            </button>
          )}

          {canApprove && status === 'in_review' && contentId && (
            <button
              type="button"
              onClick={() => void runWorkflow('approve')}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#164E3F] bg-[#E7F1EC] px-3 text-xs font-semibold text-[#164E3F]"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Approve</span>
            </button>
          )}

          {canApprove && (
            <button
              type="button"
              onClick={() => void persistContent('publish_now', 'Published live')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 text-xs font-semibold text-white hover:bg-[#0F392E]"
            >
              <span>{status === 'published' ? 'Update Live' : 'Publish'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            title="Fullscreen / Distraction-free (Ctrl+Shift+F)"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5DFD3] text-[#53635D] hover:bg-[#FAF8F3]"
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setRightOpen((v) => !v)}
            title="Toggle Settings & SEO Sidebar"
            className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium ${
              rightOpen
                ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                : 'border-[#E5DFD3] text-[#53635D]'
            }`}
          >
            <PanelRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {toast && (
        <div className="flex items-center justify-between border-b border-[#164E3F]/20 bg-[#E7F1EC] px-4 py-1.5 text-xs font-medium text-[#0F392E]">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="font-bold">
            ×
          </button>
        </div>
      )}

      {/* 3-Column Studio Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left Drawer: Block Inserter & Document Outline */}
        {leftOpen && (
          <aside className="hidden w-64 shrink-0 flex-col border-r border-[#E5DFD3] bg-white md:flex">
            <div className="grid grid-cols-2 border-b border-[#E5DFD3] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLeftTab('blocks')}
                className={`py-2.5 ${
                  leftTab === 'blocks'
                    ? 'border-b-2 border-[#164E3F] text-[#164E3F]'
                    : 'text-[#53635D]'
                }`}
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" /> Blocks
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('outline')}
                className={`py-2.5 ${
                  leftTab === 'outline'
                    ? 'border-b-2 border-[#164E3F] text-[#164E3F]'
                    : 'text-[#53635D]'
                }`}
              >
                <ListTree className="mr-1 inline h-3.5 w-3.5" /> Outline ({outlineHeadings.length})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 text-xs">
              {leftTab === 'blocks' ? (
                <div className="space-y-4">
                  {(['VietNomad Live Data', 'Layout & Media', 'Basic'] as const).map((cat) => {
                    const group = slashItems.filter((i) => i.category === cat);
                    return (
                      <div key={cat}>
                        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#53635D]">
                          {cat}
                        </div>
                        <div className="space-y-1">
                          {group.map((item) => {
                            const Icon = item.icon;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  if (!editor) return;
                                  item.run({
                                    editor,
                                    openMediaPicker: () => setMediaModalMode('editor'),
                                  });
                                }}
                                className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left hover:border-[#E5DFD3] hover:bg-[#FAF8F3]"
                              >
                                <Icon className="h-3.5 w-3.5 shrink-0 text-[#164E3F]" />
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-[#17221E]">
                                    {item.title}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : outlineHeadings.length === 0 ? (
                <p className="text-[#53635D]">
                  Add H2 or H3 headings to build a navigable Document Outline.
                </p>
              ) : (
                <div className="space-y-1">
                  {outlineHeadings.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => editor?.chain().focus().run()}
                      style={{ paddingLeft: `${Math.max(0, h.level - 2) * 12 + 8}px` }}
                      className="block w-full truncate rounded-lg py-1.5 pr-2 text-left text-xs text-[#17221E] hover:bg-[#FAF8F3] hover:text-[#164E3F]"
                    >
                      <span className="mr-1.5 text-[10px] font-bold text-[#53635D]">
                        H{h.level}
                      </span>
                      {h.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Main Writing Canvas */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-3xl space-y-5">
            {/* Language Tabs & Slug Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5DFD3] bg-white px-3.5 py-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#53635D]">Draft Language:</span>
                {(['en', 'vi'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLocale(lang)}
                    className={`rounded-md px-2.5 py-1 font-semibold ${
                      locale === lang
                        ? 'bg-[#164E3F] text-white'
                        : 'bg-[#FAF8F3] text-[#53635D] hover:text-[#17221E]'
                    }`}
                  >
                    {lang === 'en' ? 'English (EN)' : 'Tiếng Việt (VI)'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 text-[#53635D]">
                <span>/guides/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(slugifyInput(e.target.value));
                    setAutosaveState('dirty');
                  }}
                  placeholder="url-slug"
                  className="h-7 w-52 rounded border border-[#E5DFD3] bg-[#FAF8F3] px-2 font-mono text-[11px] text-[#17221E]"
                />
              </div>
            </div>

            {initialPublishedSlug && slug && initialPublishedSlug !== slug && (
              <label className="flex items-center gap-2 rounded-xl border border-[#E6B87A] bg-[#FEF7EC] px-3.5 py-2 text-xs text-[#6B4211]">
                <input
                  type="checkbox"
                  checked={createRedirectOnSlugChange}
                  onChange={(e) => setCreateRedirectOnSlugChange(e.target.checked)}
                />
                <span>
                  Slug changed from <code>/guides/{initialPublishedSlug}</code> — automatically create a{' '}
                  <strong>301 Permanent Redirect</strong> to preserve search rankings.
                </span>
              </label>
            )}

            {/* H1 Title + Featured Image + Excerpt Card */}
            <div className="space-y-4 rounded-2xl border border-[#E5DFD3] bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between gap-2 text-[11px] text-[#53635D]">
                <span className="font-semibold uppercase tracking-wider text-[#164E3F]">
                  H1 Article Title ({locale.toUpperCase()})
                </span>
                <span>Body headings are restricted to H2–H6</span>
              </div>
              <input
                type="text"
                value={activeTitle}
                onChange={(e) => {
                  const val = e.target.value;
                  if (locale === 'vi') setTitleVi(val);
                  else {
                    setTitleEn(val);
                    if (!slugTouched) setSlug(slugifyInput(val));
                  }
                  setAutosaveState('dirty');
                }}
                placeholder={
                  locale === 'vi'
                    ? 'Nhập tiêu đề bài viết (H1)...'
                    : 'Enter article or guide title (H1)...'
                }
                className="font-serif-display w-full border-0 bg-transparent text-3xl font-semibold text-[#17221E] placeholder:text-[#B5AEA0] focus:outline-none sm:text-4xl"
              />

              {/* Featured Image Bar */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[#E5DFD3] bg-[#FAF8F3] p-3">
                {featuredImageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={featuredImageUrl}
                      alt="Featured cover"
                      className="h-16 w-28 rounded-lg object-cover border border-[#E5DFD3]"
                    />
                    <div className="flex-1 text-xs">
                      <div className="font-semibold text-[#17221E]">Featured Cover Image</div>
                      <div className="truncate max-w-xs text-[11px] text-[#53635D]">
                        {featuredImageUrl}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMediaModalMode('featured')}
                      className="rounded-lg border border-[#E5DFD3] bg-white px-2.5 py-1 text-xs font-medium text-[#17221E]"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFeaturedImageUrl('');
                        setFeaturedMediaId(null);
                        setAutosaveState('dirty');
                      }}
                      className="rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-white"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMediaModalMode('featured')}
                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#164E3F] hover:underline"
                  >
                    <ImageIcon className="h-4 w-4" />
                    Add Featured Image from Shared Media Library
                  </button>
                )}
              </div>

              {/* Excerpt */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#53635D]">
                  Excerpt / Summary
                </label>
                <textarea
                  rows={2}
                  value={activeExcerpt}
                  onChange={(e) => {
                    if (locale === 'vi') setExcerptVi(e.target.value);
                    else setExcerptEn(e.target.value);
                    setAutosaveState('dirty');
                  }}
                  placeholder="Concise 1–2 sentence lead shown on guide archive cards..."
                  className="w-full rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-sm text-[#17221E] focus:border-[#164E3F] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Formatting Toolbar + Editor Canvas */}
            <div className="overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white shadow-xs">
              {/* Fixed Formatting Toolbar */}
              {editor && (
                <div className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs">
                  {/* Heading / Paragraph Selector (H2-H6 only) */}
                  <div className="relative">
                    <select
                      aria-label="Block heading level"
                      value={
                        editor.isActive('heading', { level: 2 })
                          ? 'h2'
                          : editor.isActive('heading', { level: 3 })
                            ? 'h3'
                            : editor.isActive('heading', { level: 4 })
                              ? 'h4'
                              : editor.isActive('heading', { level: 5 })
                                ? 'h5'
                                : editor.isActive('heading', { level: 6 })
                                  ? 'h6'
                                  : 'p'
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'p') editor.chain().focus().setParagraph().run();
                        else {
                          const lvl = Number(v.slice(1)) as 2 | 3 | 4 | 5 | 6;
                          editor.chain().focus().setHeading({ level: lvl }).run();
                        }
                      }}
                      className="h-7 rounded border border-[#E5DFD3] bg-white px-2 text-xs font-medium text-[#17221E]"
                    >
                      <option value="p">Paragraph</option>
                      <option value="h2">Heading 2</option>
                      <option value="h3">Heading 3</option>
                      <option value="h4">Heading 4</option>
                      <option value="h5">Heading 5</option>
                      <option value="h6">Heading 6</option>
                    </select>
                  </div>

                  <span className="mx-1 h-4 w-px bg-[#E5DFD3]" />

                  <ToolbarBtn
                    active={editor.isActive('bold')}
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    title="Bold"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive('italic')}
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    title="Italic"
                  >
                    <Italic className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive('underline')}
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    title="Underline"
                  >
                    <UnderlineIcon className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive('strike')}
                    onClick={() => editor.chain().focus().toggleStrike().run()}
                    title="Strikethrough"
                  >
                    <Strikethrough className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive('highlight')}
                    onClick={() => editor.chain().focus().toggleHighlight({ color: '#FEF3C7' }).run()}
                    title="Highlight"
                  >
                    <Highlighter className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive('code')}
                    onClick={() => editor.chain().focus().toggleCode().run()}
                    title="Inline code"
                  >
                    <Code2 className="h-3.5 w-3.5" />
                  </ToolbarBtn>

                  <span className="mx-1 h-4 w-px bg-[#E5DFD3]" />

                  <ToolbarBtn
                    active={editor.isActive({ textAlign: 'left' })}
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    title="Align left"
                  >
                    <AlignLeft className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive({ textAlign: 'center' })}
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    title="Align center"
                  >
                    <AlignCenter className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive({ textAlign: 'right' })}
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    title="Align right"
                  >
                    <AlignRight className="h-3.5 w-3.5" />
                  </ToolbarBtn>

                  <span className="mx-1 h-4 w-px bg-[#E5DFD3]" />

                  <ToolbarBtn
                    active={editor.isActive('bulletList')}
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    title="Bullet list"
                  >
                    <List className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive('orderedList')}
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    title="Numbered list"
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive('taskList')}
                    onClick={() => editor.chain().focus().toggleTaskList().run()}
                    title="Checklist"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive('blockquote')}
                    onClick={() => editor.chain().focus().toggleBlockquote().run()}
                    title="Quote"
                  >
                    <Quote className="h-3.5 w-3.5" />
                  </ToolbarBtn>

                  <span className="mx-1 h-4 w-px bg-[#E5DFD3]" />

                  <ToolbarBtn
                    active={editor.isActive('link')}
                    onClick={() => setLinkModalOpen(true)}
                    title="Insert / Internal Link"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={false}
                    onClick={() => setMediaModalMode('editor')}
                    title="Insert Image from Media Library"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={false}
                    onClick={() => {
                      const url = window.prompt('YouTube URL:');
                      if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run();
                    }}
                    title="Embed YouTube video"
                  >
                    <YoutubeIcon className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={editor.isActive('table')}
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                        .run()
                    }
                    title="Insert Table"
                  >
                    <Table2 className="h-3.5 w-3.5" />
                  </ToolbarBtn>
                  <ToolbarBtn
                    active={false}
                    onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                    title="Clear formatting"
                  >
                    <RemoveFormatting className="h-3.5 w-3.5" />
                  </ToolbarBtn>

                  <div className="ml-auto flex items-center gap-1">
                    <ToolbarBtn
                      active={findOpen}
                      onClick={() => setFindOpen((v) => !v)}
                      title="Find & Replace (Ctrl+F)"
                    >
                      <Replace className="h-3.5 w-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                      active={shortcutsOpen}
                      onClick={() => setShortcutsOpen((v) => !v)}
                      title="Keyboard Shortcuts"
                    >
                      <Keyboard className="h-3.5 w-3.5" />
                    </ToolbarBtn>
                  </div>
                </div>
              )}

              {/* Table contextual controls when cursor is inside a table */}
              {editor && editor.isActive('table') && (
                <div className="flex flex-wrap items-center gap-1.5 border-b border-[#E5DFD3] bg-[#E7F1EC]/50 px-3 py-1.5 text-[11px]">
                  <span className="font-semibold text-[#164E3F]">Table:</span>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                    className="rounded border border-[#E5DFD3] bg-white px-2 py-0.5 hover:bg-[#FAF8F3]"
                  >
                    + Row
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                    className="rounded border border-[#E5DFD3] bg-white px-2 py-0.5 hover:bg-[#FAF8F3]"
                  >
                    + Col
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().deleteRow().run()}
                    className="rounded border border-[#E5DFD3] bg-white px-2 py-0.5 hover:bg-[#FAF8F3]"
                  >
                    - Row
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                    className="rounded border border-[#E5DFD3] bg-white px-2 py-0.5 hover:bg-[#FAF8F3]"
                  >
                    - Col
                  </button>
                  <button
                    type="button"
                    onClick={() => editor.chain().focus().deleteTable().run()}
                    className="rounded border border-red-200 bg-white px-2 py-0.5 text-red-600"
                  >
                    Delete Table
                  </button>
                </div>
              )}

              {/* Find & Replace Bar */}
              {findOpen && (
                <div className="flex flex-wrap items-center gap-2 border-b border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs">
                  <Search className="h-3.5 w-3.5 text-[#53635D]" />
                  <input
                    type="text"
                    value={findText}
                    onChange={(e) => setFindText(e.target.value)}
                    placeholder="Find text..."
                    className="h-7 rounded border border-[#E5DFD3] bg-white px-2 text-xs"
                  />
                  <input
                    type="text"
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    placeholder="Replace with..."
                    className="h-7 rounded border border-[#E5DFD3] bg-white px-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleFindReplaceAll}
                    className="h-7 rounded bg-[#164E3F] px-2.5 text-xs font-semibold text-white"
                  >
                    Replace All
                  </button>
                  <button
                    type="button"
                    onClick={() => setFindOpen(false)}
                    className="ml-auto text-[#53635D]"
                  >
                    Close
                  </button>
                </div>
              )}

              {shortcutsOpen && (
                <div className="grid gap-2 border-b border-[#E5DFD3] bg-[#FAF8F3] px-4 py-2.5 text-[11px] text-[#53635D] sm:grid-cols-3">
                  <div>
                    <strong className="text-[#17221E]">/</strong> Open block slash menu
                  </div>
                  <div>
                    <strong className="text-[#17221E]">Ctrl/Cmd + S</strong> Save draft
                  </div>
                  <div>
                    <strong className="text-[#17221E]">Ctrl/Cmd + Shift + F</strong> Fullscreen mode
                  </div>
                  <div>
                    <strong className="text-[#17221E]">## / ###</strong> Heading 2 / Heading 3
                  </div>
                  <div>
                    <strong className="text-[#17221E]">- / 1. / []</strong> Bullet / Ordered / Checklist
                  </div>
                  <div>
                    <strong className="text-[#17221E]">Ctrl/Cmd + F</strong> Find &amp; Replace
                  </div>
                </div>
              )}

              {/* Editor Canvas with Floating Bubble Toolbar + Block Drag Handle */}
              <div className="relative px-8 py-6 sm:px-12">
                {editor && (
                  <>
                    <DragHandle editor={editor}>
                      <div className="flex h-6 w-5 cursor-grab items-center justify-center rounded border border-[#E5DFD3] bg-white text-[#53635D] shadow-xs hover:text-[#164E3F]">
                        <GripVertical className="h-3.5 w-3.5" />
                      </div>
                    </DragHandle>

                    <BubbleMenu
                      editor={editor}
                      options={{ placement: 'top' }}
                      className="flex items-center gap-0.5 rounded-xl border border-[#E5DFD3] bg-[#17221E] px-1.5 py-1 text-white shadow-xl"
                    >
                      <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={`rounded px-2 py-1 text-xs font-bold ${
                          editor.isActive('bold') ? 'bg-[#164E3F]' : 'hover:bg-white/10'
                        }`}
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={`rounded px-2 py-1 text-xs italic ${
                          editor.isActive('italic') ? 'bg-[#164E3F]' : 'hover:bg-white/10'
                        }`}
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        className={`rounded px-2 py-1 text-xs underline ${
                          editor.isActive('underline') ? 'bg-[#164E3F]' : 'hover:bg-white/10'
                        }`}
                      >
                        U
                      </button>
                      <button
                        type="button"
                        onClick={() => setLinkModalOpen(true)}
                        className="rounded px-2 py-1 text-xs hover:bg-white/10"
                      >
                        Link
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRightOpen(true);
                          setRightTab('ai');
                        }}
                        className="inline-flex items-center gap-1 rounded bg-[#E6B87A] px-2 py-1 text-[11px] font-bold text-[#0F392E]"
                      >
                        <Sparkles className="h-3 w-3" /> AI
                      </button>
                    </BubbleMenu>
                  </>
                )}

                <EditorContent editor={editor} />
              </div>

              {/* Word Count & Reading Time Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5DFD3] bg-[#FAF8F3] px-4 py-2 text-[11px] text-[#53635D]">
                <div>
                  <strong>{readingStats.wordCount}</strong> words ·{' '}
                  <strong>{readingStats.characterCount}</strong> characters · ~
                  <strong>{readingStats.readingTimeMinutes} min</strong> read
                </div>
                <div>
                  SEO Score: <strong className="text-[#164E3F]">{seoReport.score}/100</strong>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right Collapsible Settings Sidebar */}
        {rightOpen && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-[#E5DFD3] bg-white lg:w-96">
            <div className="flex overflow-x-auto border-b border-[#E5DFD3] text-[11px] font-semibold">
              {(
                [
                  ['general', 'General'],
                  ['seo', 'SEO'],
                  ['links', 'Links'],
                  ['languages', 'Lang'],
                  ['revisions', 'History'],
                  ['ai', 'AI'],
                ] as const
              ).map(([tabKey, label]) => (
                <button
                  key={tabKey}
                  type="button"
                  onClick={() => setRightTab(tabKey)}
                  className={`shrink-0 px-3 py-2.5 ${
                    rightTab === tabKey
                      ? 'border-b-2 border-[#164E3F] text-[#164E3F]'
                      : 'text-[#53635D] hover:text-[#17221E]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {rightTab === 'general' && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="mb-1 block font-semibold text-[#17221E]">Content Type</label>
                    <select
                      value={contentType}
                      onChange={(e) => {
                        setContentType(e.target.value as CmsContentType);
                        setAutosaveState('dirty');
                      }}
                      className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5"
                    >
                      <option value="article">Blog Post / Editorial Article</option>
                      <option value="destination_guide">City Guide</option>
                      <option value="neighborhood_guide">Neighborhood Guide</option>
                      <option value="local_guide">Local Places &amp; Experience Guide</option>
                      <option value="landing_page">Landing / Feature Page</option>
                      <option value="faq">FAQ Entry</option>
                      <option value="community_story">Community Story</option>
                      <option value="announcement">Announcement Banner</option>
                      <option value="hero_banner">Homepage Hero Banner</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-[#17221E]">Category</label>
                    <select
                      value={categoryId}
                      onChange={(e) => {
                        setCategoryId(e.target.value);
                        setAutosaveState('dirty');
                      }}
                      className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5"
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-[#17221E]">Tags</label>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t) => {
                        const active = selectedTagIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setSelectedTagIds((prev) =>
                                active ? prev.filter((x) => x !== t.id) : [...prev, t.id]
                              );
                              setAutosaveState('dirty');
                            }}
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                              active
                                ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                                : 'border-[#E5DFD3] bg-[#FAF8F3] text-[#53635D]'
                            }`}
                          >
                            {t.nameEn}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-[#17221E]">
                      Related Destination Hub
                    </label>
                    <select
                      value={destinationId}
                      onChange={(e) => {
                        setDestinationId(e.target.value);
                        setNeighborhoodId('');
                        setAutosaveState('dirty');
                      }}
                      className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5"
                    >
                      <option value="">All Vietnam / General</option>
                      {destinations.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block font-semibold text-[#17221E]">
                      Neighborhood (Optional)
                    </label>
                    <select
                      value={neighborhoodId}
                      onChange={(e) => {
                        setNeighborhoodId(e.target.value);
                        setAutosaveState('dirty');
                      }}
                      className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5"
                    >
                      <option value="">None</option>
                      {filteredNeighborhoods.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Scheduling & Publish Window */}
                  <div className="space-y-2 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3">
                    <div className="flex items-center gap-1.5 font-semibold text-[#17221E]">
                      <CalendarClock className="h-3.5 w-3.5 text-[#164E3F]" />
                      Publishing &amp; Schedule
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-[#53635D]">
                        Scheduled Publish Time
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2 text-xs"
                      />
                      {canApprove && contentId && scheduledAt && (
                        <button
                          type="button"
                          onClick={() => void runWorkflow('schedule')}
                          className="mt-1.5 h-7 w-full rounded-lg bg-[#1D4ED8] text-[11px] font-semibold text-white"
                        >
                          Schedule Publication
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-[#53635D]">
                        Campaign End / Expire At (optional)
                      </label>
                      <input
                        type="datetime-local"
                        value={publishEndAt}
                        onChange={(e) => {
                          setPublishEndAt(e.target.value);
                          setAutosaveState('dirty');
                        }}
                        className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] text-[#53635D]">
                        External/Manual Redirect Override
                      </label>
                      <input
                        type="text"
                        value={redirectTo}
                        onChange={(e) => {
                          setRedirectTo(e.target.value);
                          setAutosaveState('dirty');
                        }}
                        placeholder="/destinations/da-nang"
                        className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2 text-xs"
                      />
                    </div>
                    {canApprove && contentId && status === 'published' && (
                      <button
                        type="button"
                        onClick={() => void runWorkflow('unpublish_to_draft')}
                        className="h-7 w-full rounded-lg border border-[#E5DFD3] bg-white text-[11px] font-semibold text-[#C25E28]"
                      >
                        Unpublish back to Draft
                      </button>
                    )}
                  </div>
                </div>
              )}

              {rightTab === 'seo' && (
                <SeoPanel
                  title={activeTitle}
                  slug={slug}
                  excerpt={activeExcerpt}
                  seoTitle={seoTitle}
                  seoDescription={seoDescription}
                  focusKeyword={focusKeyword}
                  secondaryKeywords={secondaryKeywords}
                  canonicalUrl={canonicalUrl}
                  ogTitle={ogTitle}
                  ogDescription={ogDescription}
                  ogImageUrl={ogImageUrl}
                  robotsIndex={robotsIndex}
                  robotsFollow={robotsFollow}
                  schemaType={schemaType}
                  breadcrumbTitle={breadcrumbTitle}
                  gscStatus={initialDetail?.gscStatus ?? 'not_connected'}
                  gscLastCheckedAt={initialDetail?.gscLastCheckedAt ?? null}
                  gscNote={initialDetail?.gscNote ?? ''}
                  seoReport={seoReport}
                  duplicateKeywords={detailMeta.duplicateFocusKeywords}
                  onPickOgImage={() => setMediaModalMode('og')}
                  onRequestAiSeo={() => setRightTab('ai')}
                  onChange={(patch) => {
                    if ('focusKeyword' in patch) setFocusKeyword(String(patch.focusKeyword ?? ''));
                    if ('secondaryKeywords' in patch)
                      setSecondaryKeywords(patch.secondaryKeywords as string[]);
                    if ('seoTitle' in patch) setSeoTitle(String(patch.seoTitle ?? ''));
                    if ('seoDescription' in patch)
                      setSeoDescription(String(patch.seoDescription ?? ''));
                    if ('canonicalUrl' in patch) setCanonicalUrl(String(patch.canonicalUrl ?? ''));
                    if ('ogTitle' in patch) setOgTitle(String(patch.ogTitle ?? ''));
                    if ('ogDescription' in patch)
                      setOgDescription(String(patch.ogDescription ?? ''));
                    if ('robotsIndex' in patch) setRobotsIndex(Boolean(patch.robotsIndex));
                    if ('robotsFollow' in patch) setRobotsFollow(Boolean(patch.robotsFollow));
                    if ('schemaType' in patch) setSchemaType(patch.schemaType as CmsSchemaType);
                    if ('breadcrumbTitle' in patch)
                      setBreadcrumbTitle(String(patch.breadcrumbTitle ?? ''));
                    setAutosaveState('dirty');
                  }}
                />
              )}

              {rightTab === 'links' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#17221E]">
                      Internal Links &amp; Entity Refs ({detailMeta.internalLinks.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setLinkModalOpen(true)}
                      className="rounded-lg bg-[#164E3F] px-2.5 py-1 text-[11px] font-semibold text-white"
                    >
                      + Insert Link
                    </button>
                  </div>
                  <p className="text-[11px] text-[#53635D]">
                    Links and embedded dynamic blocks are verified automatically on save.
                  </p>
                  {detailMeta.internalLinks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#E5DFD3] p-4 text-center text-[#53635D]">
                      No internal links recorded yet. Save draft after adding links.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailMeta.internalLinks.map((lk) => (
                        <div
                          key={lk.id}
                          className={`rounded-xl border p-2.5 ${
                            lk.isBroken
                              ? 'border-red-300 bg-red-50'
                              : 'border-[#E5DFD3] bg-[#FAF8F3]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#17221E] truncate">
                              {lk.anchorText || lk.targetType}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                lk.isBroken
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-[#E7F1EC] text-[#164E3F]'
                              }`}
                            >
                              {lk.isBroken ? 'BROKEN' : 'OK'}
                            </span>
                          </div>
                          <div className="mt-1 truncate font-mono text-[10px] text-[#53635D]">
                            {lk.targetPath}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {rightTab === 'languages' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-[#17221E]">
                    <Languages className="h-4 w-4 text-[#164E3F]" />
                    Translation Group (EN / VI)
                  </div>
                  <p className="text-[11px] text-[#53635D]">
                    Each language version can maintain its own slug, SEO meta, workflow status, and publish schedule. Draft translations never auto-publish.
                  </p>
                  <div className="space-y-2">
                    {detailMeta.translations.map((tr) => (
                      <Link
                        key={tr.id}
                        href={`/admin/growth/content/${tr.id}`}
                        className={`block rounded-xl border p-3 ${
                          tr.id === contentId
                            ? 'border-[#164E3F] bg-[#E7F1EC]/60'
                            : 'border-[#E5DFD3] bg-white hover:border-[#164E3F]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold uppercase text-[#164E3F]">{tr.locale}</span>
                          <span className="rounded bg-[#FAF8F3] px-2 py-0.5 text-[10px] font-semibold">
                            {tr.status}
                          </span>
                        </div>
                        <div className="mt-1 truncate font-semibold text-[#17221E]">
                          {tr.title}
                        </div>
                        <div className="truncate font-mono text-[10px] text-[#53635D]">
                          /guides/{tr.slug}
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    {!detailMeta.translations.some((t) => t.locale === 'vi') && (
                      <button
                        type="button"
                        onClick={() => void handleCreateTranslation('vi')}
                        className="h-8 flex-1 rounded-lg border border-[#164E3F] bg-white font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
                      >
                        + Create VI Draft
                      </button>
                    )}
                    {!detailMeta.translations.some((t) => t.locale === 'en') && (
                      <button
                        type="button"
                        onClick={() => void handleCreateTranslation('en')}
                        className="h-8 flex-1 rounded-lg border border-[#164E3F] bg-white font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
                      >
                        + Create EN Draft
                      </button>
                    )}
                  </div>
                </div>
              )}

              {rightTab === 'revisions' && (
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-[#17221E]">
                    <History className="h-4 w-4 text-[#164E3F]" />
                    Revision History ({detailMeta.revisions.length})
                  </div>
                  {detailMeta.revisions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#E5DFD3] p-4 text-center text-[#53635D]">
                      Save or publish to create version snapshots.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {detailMeta.revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#17221E]">
                              v{rev.versionNumber} · {rev.changeType}
                            </span>
                            <span className="text-[10px] text-[#53635D]">
                              {rev.createdAt.slice(0, 16).replace('T', ' ')}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-[#53635D]">
                            {rev.summary} · by {rev.createdByName}
                          </div>
                          <button
                            type="button"
                            onClick={() => void runWorkflow('restore_revision', { revisionId: rev.id })}
                            className="mt-2 inline-flex items-center gap-1 rounded border border-[#E5DFD3] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
                          >
                            <RotateCcw className="h-3 w-3" /> Restore v{rev.versionNumber}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {rightTab === 'ai' && (
                <AiAssistantPanel
                  contentId={contentId}
                  destinationId={destinationId || null}
                  locale={locale}
                  title={activeTitle}
                  focusKeyword={focusKeyword}
                  bodyExcerpt={extractPlainTextFromDoc(activeDoc)}
                  selectedText={selectedEditorText}
                  onInsertText={(text) => {
                    if (!editor) return;
                    const nodes = legacyTextToTiptapDoc(text).content;
                    editor.chain().focus().insertContent(nodes).run();
                  }}
                  onReplaceSelection={(text) => {
                    if (!editor) return;
                    editor.chain().focus().insertContent(text).run();
                  }}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modals */}
      <MediaLibraryModal
        open={mediaModalMode !== null}
        onClose={() => setMediaModalMode(null)}
        onSelect={(item) => {
          if (mediaModalMode === 'featured') {
            setFeaturedMediaId(item.id);
            setFeaturedImageUrl(item.url);
            setAutosaveState('dirty');
          } else if (mediaModalMode === 'og') {
            setOgImageUrl(item.url);
            setAutosaveState('dirty');
          } else if (mediaModalMode === 'editor' && editor) {
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'image',
                attrs: {
                  src: item.url,
                  alt: item.altEn || item.filename,
                  mediaId: item.id,
                  caption: item.captionEn,
                  credit: item.credit,
                },
              })
              .run();
          }
        }}
      />

      <InternalLinkPickerModal
        open={linkModalOpen}
        initialHref={editor?.getAttributes('link')?.href ?? ''}
        onClose={() => setLinkModalOpen(false)}
        onInsert={(href, label) => {
          if (!editor) return;
          const { from, to } = editor.state.selection;
          if (from === to && label) {
            editor
              .chain()
              .focus()
              .insertContent({
                type: 'text',
                text: label,
                marks: [{ type: 'link', attrs: { href } }],
              })
              .run();
          } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
          }
        }}
      />
    </div>
  );
}

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded transition ${
        active
          ? 'bg-[#164E3F] text-white'
          : 'text-[#17221E] hover:bg-[#E7F1EC] hover:text-[#164E3F]'
      }`}
    >
      {children}
    </button>
  );
}
