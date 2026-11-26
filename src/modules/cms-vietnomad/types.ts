import type { TiptapDoc } from '@/lib/cms-core/schema';
import type { SeoAnalysisReport } from '@/lib/cms-core/seo-analyzer';

export type CmsContentType =
  | 'article'
  | 'landing_page'
  | 'destination_guide'
  | 'neighborhood_guide'
  | 'local_guide'
  | 'faq'
  | 'announcement'
  | 'hero_banner'
  | 'community_story';

export type CmsWorkflowStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'archived';

export type CmsGscStatus =
  | 'not_connected'
  | 'pending_inspection'
  | 'submitted'
  | 'indexed'
  | 'excluded'
  | 'error';

export type CmsSchemaType = 'Article' | 'Guide' | 'FAQPage' | 'WebPage' | 'CollectionPage';

export interface CmsCategoryItem {
  id: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  descriptionEn: string;
  descriptionVi: string;
  parentId: string | null;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  robotsIndex: boolean;
  articleCount: number;
}

export interface CmsTagItem {
  id: string;
  slug: string;
  nameEn: string;
  nameVi: string;
  articleCount: number;
}

export interface CmsMediaItem {
  id: string;
  storageMode: 'supabase' | 'local' | 'external';
  objectPath: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altEn: string;
  altVi: string;
  captionEn: string;
  captionVi: string;
  credit: string;
  license: string;
  focalX: number;
  focalY: number;
  folder: string;
  usageCount: number;
  createdAt: string;
}

export interface CmsRevisionItem {
  id: string;
  contentId: string;
  versionNumber: number;
  changeType: string;
  summary: string;
  docEn: TiptapDoc | null;
  docVi: TiptapDoc | null;
  metaSnapshot: Record<string, unknown>;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface CmsRedirectItem {
  id: string;
  sourcePath: string;
  targetPath: string;
  statusCode: 301 | 302;
  isActive: boolean;
  hitCount: number;
  note: string;
  autoCreatedFromContentId: string | null;
  createdAt: string;
}

export interface CmsInternalLinkItem {
  id: string;
  sourceContentId: string;
  sourceTitle?: string;
  sourceSlug?: string;
  targetType: string;
  targetId: string;
  targetPath: string;
  anchorText: string;
  isBroken: boolean;
  lastCheckedAt: string;
}

export interface CmsContentListItem {
  id: string;
  contentType: CmsContentType;
  category: string;
  categoryId: string | null;
  categoryNameEn: string | null;
  categoryNameVi: string | null;
  locale: 'en' | 'vi';
  translationGroupId: string;
  slug: string;
  titleEn: string;
  titleVi: string;
  excerptEn: string;
  excerptVi: string;
  destinationId: string | null;
  destinationSlug: string | null;
  destinationName: string | null;
  neighborhoodId: string | null;
  neighborhoodName: string | null;
  featuredImageUrl: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  seoScore: number;
  wordCount: number;
  readingTimeMinutes: number;
  robotsIndex: boolean;
  robotsFollow: boolean;
  gscStatus: CmsGscStatus;
  gscLastCheckedAt: string | null;
  status: CmsWorkflowStatus;
  hasUnpublishedChanges: boolean;
  authorId: string | null;
  authorName: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  viewsCount: number;
  bookingsAttributed: number;
}

export interface CmsTranslationSibling {
  id: string;
  locale: 'en' | 'vi';
  slug: string;
  title: string;
  status: CmsWorkflowStatus;
  updatedAt: string;
}

export interface CmsContentDetail extends CmsContentListItem {
  bodyEn: string;
  bodyVi: string;
  bodyDocEn: TiptapDoc;
  bodyDocVi: TiptapDoc;
  publishedDocEn: TiptapDoc | null;
  publishedDocVi: TiptapDoc | null;
  featuredMediaId: string | null;
  secondaryKeywords: string[];
  canonicalUrl: string;
  redirectTo: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  schemaType: CmsSchemaType;
  breadcrumbTitle: string;
  gscNote: string;
  publishStartAt: string | null;
  publishEndAt: string | null;
  approvedAt: string | null;
  lastAutosavedAt: string | null;
  tagIds: string[];
  revisions: CmsRevisionItem[];
  internalLinks: CmsInternalLinkItem[];
  translations: CmsTranslationSibling[];
  seoReport: SeoAnalysisReport;
  duplicateFocusKeywords: Array<{ id: string; slug: string; title: string }>;
}

export interface CmsSettingsBundle {
  seoDefaults: {
    siteName: string;
    titleSeparator: string;
    defaultRobotsIndex: boolean;
    defaultRobotsFollow: boolean;
    includeCategoriesInSitemap: boolean;
    gscPropertyUrl: string;
    gscConnected: boolean;
  };
  editorialWorkflow: {
    requireReviewBeforePublish: boolean;
    autosaveIntervalMs: number;
    autoCreateRedirectOnSlugChange: boolean;
  };
}
