import {
  extractHeadingsFromDoc,
  extractImagesFromDoc,
  extractLinksFromDoc,
  extractPlainTextFromDoc,
  type TiptapDoc,
} from './schema';

export type SeoCheckStatus = 'pass' | 'warn' | 'fail';

export interface SeoCheckItem {
  id: string;
  group: 'keyword' | 'content' | 'links' | 'media' | 'readability';
  label: string;
  status: SeoCheckStatus;
  detail: string;
  pointsEarned: number;
  pointsMax: number;
}

export interface SeoAnalysisReport {
  score: number;
  grade: 'good' | 'ok' | 'needs_work';
  wordCount: number;
  readingTimeMinutes: number;
  internalLinksCount: number;
  externalLinksCount: number;
  imagesCount: number;
  headingsCount: number;
  checks: SeoCheckItem[];
}

function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function analyzeSeoContent(input: {
  title: string;
  excerpt?: string;
  slug: string;
  seoTitle?: string;
  seoDescription?: string;
  focusKeyword?: string;
  secondaryKeywords?: string[];
  featuredImageUrl?: string;
  doc: TiptapDoc | null | undefined;
}): SeoAnalysisReport {
  const plainText = extractPlainTextFromDoc(input.doc);
  const words = plainText ? plainText.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 220));
  const headings = extractHeadingsFromDoc(input.doc);
  const images = extractImagesFromDoc(input.doc);
  const links = extractLinksFromDoc(input.doc);

  const internalLinks = links.filter((l) => l.targetType !== 'external');
  const externalLinks = links.filter((l) => l.targetType === 'external');

  const focusRaw = (input.focusKeyword ?? '').trim();
  const focus = normalizeSearch(focusRaw);
  const effectiveSeoTitle = (input.seoTitle || input.title || '').trim();
  const effectiveMetaDesc = (input.seoDescription || input.excerpt || '').trim();

  const normTitle = normalizeSearch(input.title);
  const normSeoTitle = normalizeSearch(effectiveSeoTitle);
  const normSlug = normalizeSearch(input.slug).replace(/-/g, ' ');
  const normMetaDesc = normalizeSearch(effectiveMetaDesc);
  const normBody = normalizeSearch(plainText);
  const firstParagraph = normalizeSearch(plainText.split('\n')[0] ?? '');

  const checks: SeoCheckItem[] = [];

  // 1. Focus keyword configured
  if (!focus) {
    checks.push({
      id: 'focus_keyword_set',
      group: 'keyword',
      label: 'Focus keyword',
      status: 'warn',
      detail: 'Add a focus keyword to unlock targeted SEO checks.',
      pointsEarned: 0,
      pointsMax: 10,
    });
  } else {
    checks.push({
      id: 'focus_keyword_set',
      group: 'keyword',
      label: 'Focus keyword',
      status: 'pass',
      detail: `Tracking focus keyword "${focusRaw}".`,
      pointsEarned: 5,
      pointsMax: 5,
    });

    // Keyword in SEO Title & H1
    const inSeoTitle = normSeoTitle.includes(focus);
    const inH1 = normTitle.includes(focus);
    checks.push({
      id: 'kw_in_title',
      group: 'keyword',
      label: 'Keyword in Title & SEO Title',
      status: inSeoTitle && inH1 ? 'pass' : inSeoTitle || inH1 ? 'warn' : 'fail',
      detail:
        inSeoTitle && inH1
          ? 'Focus keyword appears in both Article Title and SEO Title.'
          : 'Include your focus keyword naturally in both the Article Title and SEO Title.',
      pointsEarned: inSeoTitle && inH1 ? 12 : inSeoTitle || inH1 ? 6 : 0,
      pointsMax: 12,
    });

    // Keyword in Slug
    const focusSlugMatch = normSlug.includes(focus) || input.slug.toLowerCase().includes(focus.replace(/\s+/g, '-'));
    checks.push({
      id: 'kw_in_slug',
      group: 'keyword',
      label: 'Keyword in URL Slug',
      status: focusSlugMatch ? 'pass' : 'warn',
      detail: focusSlugMatch
        ? 'URL slug reflects the focus keyword.'
        : 'Consider adding the main keyword phrase to the URL slug.',
      pointsEarned: focusSlugMatch ? 8 : 2,
      pointsMax: 8,
    });

    // Keyword in Meta Description
    const inMeta = normMetaDesc.includes(focus);
    checks.push({
      id: 'kw_in_meta',
      group: 'keyword',
      label: 'Keyword in Meta Description',
      status: inMeta ? 'pass' : 'warn',
      detail: inMeta
        ? 'Focus keyword appears in the search description snippet.'
        : 'Include the focus keyword in the meta description to improve CTR.',
      pointsEarned: inMeta ? 8 : 0,
      pointsMax: 8,
    });

    // Keyword in Intro & Subheadings
    const inIntro = firstParagraph.includes(focus);
    const inSubheading = headings.some((h) => normalizeSearch(h.text).includes(focus));
    checks.push({
      id: 'kw_in_body',
      group: 'keyword',
      label: 'Keyword in Intro & Subheadings',
      status: inIntro && inSubheading ? 'pass' : inIntro || inSubheading ? 'warn' : 'fail',
      detail:
        inIntro && inSubheading
          ? 'Found in the opening paragraph and at least one H2/H3 heading.'
          : 'Place your focus keyword near the opening paragraph and inside a relevant subheading.',
      pointsEarned: inIntro && inSubheading ? 10 : inIntro || inSubheading ? 5 : 0,
      pointsMax: 10,
    });
  }

  // Secondary keywords check
  const secondary = (input.secondaryKeywords ?? []).map((k) => k.trim()).filter(Boolean);
  if (secondary.length > 0) {
    const matchedSec = secondary.filter((k) => normBody.includes(normalizeSearch(k))).length;
    checks.push({
      id: 'secondary_keywords',
      group: 'keyword',
      label: 'Secondary keyword coverage',
      status: matchedSec === secondary.length ? 'pass' : matchedSec > 0 ? 'warn' : 'fail',
      detail: `${matchedSec}/${secondary.length} secondary keywords appear in the article.`,
      pointsEarned: Math.round((matchedSec / secondary.length) * 6),
      pointsMax: 6,
    });
  }

  // SEO Title Length
  const titleLen = effectiveSeoTitle.length;
  checks.push({
    id: 'seo_title_length',
    group: 'content',
    label: 'SEO Title length',
    status: titleLen >= 40 && titleLen <= 62 ? 'pass' : titleLen >= 25 && titleLen <= 75 ? 'warn' : 'fail',
    detail:
      titleLen >= 40 && titleLen <= 62
        ? `${titleLen} characters — ideal for Google search display.`
        : `${titleLen} characters — aim for 45–60 characters to avoid truncation.`,
    pointsEarned: titleLen >= 40 && titleLen <= 62 ? 10 : titleLen >= 25 ? 5 : 0,
    pointsMax: 10,
  });

  // Meta Description Length
  const descLen = effectiveMetaDesc.length;
  checks.push({
    id: 'meta_desc_length',
    group: 'content',
    label: 'Meta Description length',
    status: descLen >= 110 && descLen <= 165 ? 'pass' : descLen >= 60 ? 'warn' : 'fail',
    detail:
      descLen >= 110 && descLen <= 165
        ? `${descLen} characters — clean search snippet width.`
        : `${descLen} characters — aim for 120–158 characters.`,
    pointsEarned: descLen >= 110 && descLen <= 165 ? 10 : descLen >= 60 ? 5 : 0,
    pointsMax: 10,
  });

  // Word Count
  checks.push({
    id: 'word_count',
    group: 'content',
    label: 'Content depth (word count)',
    status: wordCount >= 600 ? 'pass' : wordCount >= 250 ? 'warn' : 'fail',
    detail:
      wordCount >= 600
        ? `${wordCount} words (~${readingTimeMinutes} min read) — strong editorial depth.`
        : `${wordCount} words — guides perform best at 600+ words.`,
    pointsEarned: wordCount >= 600 ? 12 : wordCount >= 250 ? 7 : wordCount >= 80 ? 3 : 0,
    pointsMax: 12,
  });

  // Headings structure
  const h2Count = headings.filter((h) => h.level === 2).length;
  checks.push({
    id: 'heading_hierarchy',
    group: 'readability',
    label: 'H2–H3 structure',
    status: h2Count >= 2 ? 'pass' : headings.length >= 1 ? 'warn' : 'fail',
    detail:
      h2Count >= 2
        ? `${headings.length} subheadings (${h2Count} H2) organize the guide clearly.`
        : 'Add at least 2 H2 sections to structure scannable sections.',
    pointsEarned: h2Count >= 2 ? 7 : headings.length >= 1 ? 3 : 0,
    pointsMax: 7,
  });

  // Internal Links
  checks.push({
    id: 'internal_links',
    group: 'links',
    label: 'Internal linking',
    status: internalLinks.length >= 2 ? 'pass' : internalLinks.length === 1 ? 'warn' : 'fail',
    detail:
      internalLinks.length >= 2
        ? `${internalLinks.length} internal links connect stays, destinations, or guides.`
        : 'Link to relevant stays, city hubs, or related guides (aim for 2+ internal links).',
    pointsEarned: internalLinks.length >= 2 ? 10 : internalLinks.length === 1 ? 5 : 0,
    pointsMax: 10,
  });

  // Media & Alt text
  const hasFeatured = Boolean((input.featuredImageUrl ?? '').trim());
  const missingAlt = images.filter((i) => !i.alt.trim()).length;
  checks.push({
    id: 'media_alt_text',
    group: 'media',
    label: 'Images & Alt attributes',
    status:
      hasFeatured && (images.length === 0 || missingAlt === 0)
        ? 'pass'
        : hasFeatured || images.length > 0
          ? 'warn'
          : 'fail',
    detail:
      !hasFeatured && images.length === 0
        ? 'Add a featured image and contextual photos with descriptive alt text.'
        : missingAlt > 0
          ? `${missingAlt} embedded image(s) missing alt text.`
          : 'Featured image is set and all embedded images carry alt attributes.',
    pointsEarned:
      hasFeatured && missingAlt === 0 ? 7 : hasFeatured || images.length > 0 ? 4 : 0,
    pointsMax: 7,
  });

  // Paragraph readability
  const paragraphs = plainText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 130).length;
  checks.push({
    id: 'readability_paragraphs',
    group: 'readability',
    label: 'Paragraph readability',
    status: longParagraphs === 0 && paragraphs.length >= 2 ? 'pass' : longParagraphs > 0 ? 'warn' : 'warn',
    detail:
      longParagraphs === 0
        ? 'Paragraphs are concise and scannable on mobile.'
        : `${longParagraphs} paragraph(s) exceed 130 words; split for easier reading.`,
    pointsEarned: longParagraphs === 0 && paragraphs.length >= 2 ? 5 : 2,
    pointsMax: 5,
  });

  const earned = checks.reduce((sum, c) => sum + c.pointsEarned, 0);
  const max = checks.reduce((sum, c) => sum + c.pointsMax, 0);
  const score = max > 0 ? Math.min(100, Math.round((earned / max) * 100)) : 0;
  const grade: SeoAnalysisReport['grade'] =
    score >= 75 ? 'good' : score >= 50 ? 'ok' : 'needs_work';

  return {
    score,
    grade,
    wordCount,
    readingTimeMinutes,
    internalLinksCount: internalLinks.length,
    externalLinksCount: externalLinks.length,
    imagesCount: images.length + (hasFeatured ? 1 : 0),
    headingsCount: headings.length,
    checks,
  };
}
