import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SessionUser } from '@/lib/auth/session';
import { closeDb, dbQuery, ensureDbReady } from '@/lib/db';
import { SEED_IDS } from '@/lib/db/seed-data';
import {
  cleanPastedHtml,
  computeReadingMetrics,
  normalizeTiptapDoc,
  parseSafeVideoEmbedUrl,
  sanitizeHref,
  type TiptapDoc,
} from '@/lib/cms-core/schema';
import { analyzeSeoContent } from '@/lib/cms-core/seo-analyzer';
import { uploadCmsMediaBuffer } from '@/lib/storage';
import {
  assertAdminActorHasPermission,
  getAdminActorContext,
} from '@/modules/admin-rbac';
import {
  createCmsMediaRecord,
  createTranslationSibling,
  deleteCmsMediaRecord,
  getAdminCmsContentDetail,
  hydrateDynamicBlocksForDoc,
  listCmsMedia,
  resolveCmsRedirect,
  saveCmsContentPro,
  transitionCmsWorkflow,
  upsertCmsCategory,
} from '@/modules/cms-vietnomad';
import {
  getAdminCmsPreviewByIdOrSlug,
  getIndexableCmsSlugs,
  getPublishedCmsBySlug,
} from '@/modules/cms';
import {
  runCmsAiAssistant,
  updateAiGatewayConfig,
} from '@/modules/ai-gateway';
import { renderVietNomadDynamicBlock } from '@/components/cms-public/VietNomadBlockRenderer';
import { POST as trackRoutePost } from '@/app/api/track/route';

let tempDir: string;
let uploadsDir: string;

async function fetchSessionUser(userId: string): Promise<SessionUser> {
  const res = await dbQuery(
    `SELECT id, email, full_name, role, nationality, membership_tier, membership_expires_at,
            reward_credit_vnd, vat_tax_id, preferred_locale, preferred_currency, phone
     FROM users WHERE id = $1`,
    [userId]
  );
  const u = res.rows[0]!;
  return {
    id: String(u.id),
    email: String(u.email),
    fullName: String(u.full_name),
    role: u.role as SessionUser['role'],
    nationality: String(u.nationality),
    membershipTier: u.membership_tier as SessionUser['membershipTier'],
    membershipExpiresAt: u.membership_expires_at ? String(u.membership_expires_at) : null,
    rewardCreditVnd: Number(u.reward_credit_vnd),
    vatTaxId: u.vat_tax_id ? String(u.vat_tax_id) : null,
    preferredLocale: u.preferred_locale === 'vi' ? 'vi' : 'en',
    preferredCurrency: (u.preferred_currency as SessionUser['preferredCurrency']) ?? 'USD',
    phone: u.phone ? String(u.phone) : null,
  };
}

// Valid minimal 1x1 PNG buffer
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'vietnomad-cms-pro-'));
  uploadsDir = mkdtempSync(join(tmpdir(), 'vietnomad-cms-uploads-'));
  process.env.PGLITE_DATA_DIR = tempDir;
  process.env.LOCAL_UPLOADS_DIR = uploadsDir;
  delete process.env.DATABASE_URL;
  await ensureDbReady();
});

afterAll(async () => {
  await closeDb();
  rmSync(tempDir, { recursive: true, force: true });
  rmSync(uploadsDir, { recursive: true, force: true });
});

describe('Enterprise CMS Pro & VietNomad Dynamic Blocks', () => {
  it('sanitizes XSS, demotes H1 in body to H2, cleans pasted HTML, and validates video URLs', () => {
    const rawDoc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Accidental H1 inside body' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Click here',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
            {
              type: 'text',
              text: ' Safe link',
              marks: [{ type: 'link', attrs: { href: '/stays/da-nang-studio' } }],
            },
          ],
        },
      ],
    };

    const normalized = normalizeTiptapDoc(rawDoc);
    expect(normalized.content[0].attrs?.level).toBe(2);
    expect(sanitizeHref('javascript:alert(1)')).toBe('');
    expect(sanitizeHref('/stays/da-nang-studio')).toBe('/stays/da-nang-studio');

    const cleanedPaste = cleanPastedHtml(
      '<p class="MsoNormal" style="color:red"><script>evil()</script>Hello <b onclick="xss()">World</b></p>'
    );
    expect(cleanedPaste).not.toContain('script');
    expect(cleanedPaste).not.toContain('onclick');
    expect(cleanedPaste).not.toContain('MsoNormal');
    expect(cleanedPaste).toContain('Hello');

    expect(parseSafeVideoEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toContain(
      'youtube-nocookie.com/embed/dQw4w9WgXcQ'
    );
    expect(parseSafeVideoEmbedUrl('https://evil.example.com/payload.js')).toBeNull();

    const stats = computeReadingMetrics(normalized);
    expect(stats.wordCount).toBeGreaterThanOrEqual(7);
    expect(stats.readingTimeMinutes).toBe(1);
  });

  it('computes Yoast-grade SEO checks and scores accurately', () => {
    const doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Why Da Nang coworking works well' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Finding Da Nang coworking apartments with fiber Wi-Fi and ergonomic desks makes a 30-night stay productive. Explore '.concat(
                Array.from({ length: 60 }, () => 'remote work living in Da Nang coworking hubs').join(' ')
              ),
              marks: [{ type: 'link', attrs: { href: '/destinations/da-nang' } }],
            },
            {
              type: 'text',
              text: ' and An Thuong guide',
              marks: [{ type: 'link', attrs: { href: '/guides/an-thuong-da-nang' } }],
            },
            {
              type: 'text',
              text: ' plus external transit guide',
              marks: [{ type: 'link', attrs: { href: 'https://vietnam.travel/' } }],
            },
          ],
        },
        {
          type: 'image',
          attrs: { src: '/api/uploads/cms-media/editorial/sample.png', alt: 'Da Nang coworking desk' },
        },
      ],
    };

    const report = analyzeSeoContent({
      title: 'Da Nang Coworking & 30-Day Living Guide',
      excerpt: 'How to pick Da Nang coworking neighborhoods and long-stay apartments.',
      slug: 'da-nang-coworking-guide',
      seoTitle: 'Da Nang Coworking & Long-Stay Guide | VietNomad Stays',
      seoDescription:
        'Discover verified apartments near Da Nang coworking hubs, real Wi-Fi speeds, and 30-night rental pricing across My Khe.',
      focusKeyword: 'Da Nang coworking',
      secondaryKeywords: ['My Khe', 'long-stay'],
      featuredImageUrl: '/api/uploads/cms-media/editorial/sample.png',
      doc,
    });

    expect(report.score).toBeGreaterThanOrEqual(75);
    expect(report.checks.find((c) => c.id === 'kw_in_title')?.status).toBe('pass');
    expect(report.checks.find((c) => c.id === 'internal_links')?.status).toBe('pass');
  });

  it('enforces draft vs published isolation, revisions & restore, 301 auto-redirect on slug change, and translation siblings', async () => {
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);

    const cat = await upsertCmsCategory(actor, {
      slug: 'city-playbooks',
      nameEn: 'City Playbooks',
      nameVi: 'Cẩm nang thành phố',
    });

    // 1. Publish v1 live article
    const v1Doc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Live Version One Heading' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Published live body content version one.' }],
        },
      ],
    };

    const created = await saveCmsContentPro(actor, {
      contentType: 'article',
      categoryId: cat.id,
      locale: 'en',
      slug: 'cms-pro-isolation-test-v1',
      titleEn: 'CMS Pro Isolation Test v1',
      titleVi: 'Kiểm thử bản nháp CMS Pro v1',
      excerptEn: 'Testing isolated draft vs live snapshots.',
      bodyDocEn: v1Doc,
      bodyDocVi: v1Doc,
      seoTitle: 'CMS Pro Isolation Test v1 | VietNomad Stays',
      seoDescription: 'Comprehensive test of draft vs published snapshot isolation in VietNomad CMS.',
      focusKeyword: 'CMS Pro isolation',
      mode: 'publish_now',
    });

    expect(created.status).toBe('published');
    const liveV1 = await getPublishedCmsBySlug('cms-pro-isolation-test-v1');
    expect(liveV1?.docEn.content[1].content?.[0].text).toContain('version one');

    // 2. Autosave / Save draft v2 without publishing -> public SSR must STILL see v1!
    const v2DraftDoc: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Unpublished Draft Version Two' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Secret draft edits should stay hidden publicly.' }],
        },
      ],
    };

    await saveCmsContentPro(actor, {
      id: created.id,
      contentType: 'article',
      categoryId: cat.id,
      locale: 'en',
      slug: 'cms-pro-isolation-test-v1',
      titleEn: 'CMS Pro Isolation Test v1',
      titleVi: 'Kiểm thử bản nháp CMS Pro v1',
      bodyDocEn: v2DraftDoc,
      bodyDocVi: v2DraftDoc,
      mode: 'save_draft',
      changeSummary: 'Draft edit v2',
    });

    const stillLiveV1 = await getPublishedCmsBySlug('cms-pro-isolation-test-v1');
    expect(stillLiveV1?.docEn.content[1].content?.[0].text).toContain('version one');

    const adminPreview = await getAdminCmsPreviewByIdOrSlug('cms-pro-isolation-test-v1');
    expect(adminPreview?.docEn.content[1].content?.[0].text).toContain('Secret draft edits');

    const detail = await getAdminCmsContentDetail(created.id);
    expect(detail.hasUnpublishedChanges).toBe(true);
    expect(detail.revisions.length).toBeGreaterThanOrEqual(2);

    // 3. Restore v1 revision back into draft, then change slug & publish -> auto 301 redirect created!
    const firstRev =
      detail.revisions.find((r) => r.versionNumber === 1) ??
      detail.revisions[detail.revisions.length - 1]!;
    await transitionCmsWorkflow(actor, created.id, 'restore_revision', {
      revisionId: firstRev.id,
    });
    const afterRestore = await getAdminCmsContentDetail(created.id);
    expect(afterRestore.bodyDocEn.content[1].content?.[0].text).toContain('version one');

    await saveCmsContentPro(actor, {
      id: created.id,
      contentType: 'article',
      categoryId: cat.id,
      locale: 'en',
      slug: 'cms-pro-isolation-test-v2',
      titleEn: 'CMS Pro Isolation Test v2',
      titleVi: 'Kiểm thử bản nháp CMS Pro v2',
      bodyDocEn: v2DraftDoc,
      bodyDocVi: v2DraftDoc,
      mode: 'publish_now',
      createRedirectOnSlugChange: true,
    });

    const redir = await resolveCmsRedirect('/guides/cms-pro-isolation-test-v1');
    expect(redir).not.toBeNull();
    expect(redir?.statusCode).toBe(301);
    expect(redir?.targetPath).toBe('/guides/cms-pro-isolation-test-v2');

    // 4. Create independent VI translation sibling (must start as draft, never auto-published)
    const sibling = await createTranslationSibling(actor, created.id, 'vi');
    expect(sibling.alreadyExists).toBe(false);
    const siblingDetail = await getAdminCmsContentDetail(sibling.id);
    expect(siblingDetail.locale).toBe('vi');
    expect(siblingDetail.status).toBe('draft');

    const publishedEnBeforeVi = await getPublishedCmsBySlug('cms-pro-isolation-test-v2');
    expect(publishedEnBeforeVi?.alternates.some((a) => a.locale === 'vi')).toBe(false);

    await transitionCmsWorkflow(actor, sibling.id, 'publish');
    const publishedEnAfterVi = await getPublishedCmsBySlug('cms-pro-isolation-test-v2');
    expect(publishedEnAfterVi?.alternates.some((a) => a.locale === 'vi')).toBe(true);

    const indexable = await getIndexableCmsSlugs();
    expect(indexable.some((s) => s.slug === 'cms-pro-isolation-test-v2')).toBe(true);
  });

  it('hydrates live VietNomad blocks, hides paused/expired entities publicly, and enforces media usage guards', async () => {
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);

    // Upload real PNG to Shared Media Library
    const uploaded = await uploadCmsMediaBuffer({
      folder: 'editorial',
      buffer: TINY_PNG,
      originalName: 'test-beach-hero.png',
    });
    const media = await createCmsMediaRecord(actor, {
      storageMode: uploaded.storageMode,
      objectPath: uploaded.objectPath,
      url: uploaded.url,
      filename: 'test-beach-hero.png',
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
      altEn: 'Beachfront workspace in Da Nang',
      folder: 'editorial',
    });

    const expiredPromoId = 'ba000000-0000-4000-8000-000000000099';
    await dbQuery(
      `INSERT INTO promotions (
        id, code, name, discount_type, discount_value, min_nights, valid_from, valid_to, is_active
      ) VALUES ($1, 'EXPIRED99', 'Expired Offer', 'percent', 15, 7, '2024-01-01', '2024-02-01', TRUE)
      ON CONFLICT (id) DO NOTHING`,
      [expiredPromoId]
    );

    const docWithBlocks: TiptapDoc = {
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { src: media.url, alt: 'Workspace', mediaId: media.id },
        },
        {
          type: 'vnStayListing',
          attrs: { stayId: SEED_IDS.stays.myKheAtelier },
        },
        {
          type: 'vnPromotionBlock',
          attrs: { promotionId: expiredPromoId },
        },
        {
          type: 'vnDestinationCard',
          attrs: { destinationId: SEED_IDS.destinations.daNang },
        },
      ],
    };

    const article = await saveCmsContentPro(actor, {
      contentType: 'destination_guide',
      locale: 'en',
      slug: 'dynamic-blocks-hydrator-test',
      titleEn: 'Dynamic Blocks Hydrator Test',
      titleVi: 'Dynamic Blocks Hydrator Test VI',
      featuredMediaId: media.id,
      featuredImageUrl: media.url,
      bodyDocEn: docWithBlocks,
      bodyDocVi: docWithBlocks,
      mode: 'publish_now',
    });

    // Media usage must block accidental deletion while referenced
    const mediaRows = await listCmsMedia({ folder: 'editorial' });
    const foundMedia = mediaRows.find((m) => m.id === media.id);
    expect(foundMedia?.usageCount).toBeGreaterThanOrEqual(1);
    await expect(deleteCmsMediaRecord(actor, media.id)).rejects.toThrow();

    // Hydrate blocks & verify expired promotion is hidden publicly yet flagged in preview
    const hydratorCtx = await hydrateDynamicBlocksForDoc(docWithBlocks, {
      excludeContentId: article.id,
    });
    expect(hydratorCtx.staysById.has(SEED_IDS.stays.myKheAtelier)).toBe(true);
    expect(hydratorCtx.destinationsById.has(SEED_IDS.destinations.daNang)).toBe(true);

    const expiredPublicEl = renderVietNomadDynamicBlock({
      node: docWithBlocks.content[2],
      key: 'promo-public',
      ctx: hydratorCtx,
      locale: 'en',
      currency: 'USD',
      isPreview: false,
    });
    expect(expiredPublicEl).toBeNull();

    const expiredPreviewEl = renderVietNomadDynamicBlock({
      node: docWithBlocks.content[2],
      key: 'promo-preview',
      ctx: hydratorCtx,
      locale: 'en',
      currency: 'USD',
      isPreview: true,
    });
    expect(expiredPreviewEl).not.toBeNull();
  });

  it('enforces honest AI Gateway states, grounds prompts in verified DB data, logs usage, and tracks article_view attribution', async () => {
    const admin = await fetchSessionUser(SEED_IDS.users.admin);
    const actor = await getAdminActorContext(admin);

    // 1. Disabled by feature flag -> returns honest 'disabled', no fake completion
    await updateAiGatewayConfig(actor, { isEnabled: false });
    const disabledRes = await runCmsAiAssistant(actor, {
      featureKey: 'outlineBrief',
      locale: 'en',
      title: 'Hoi An Living Guide',
    });
    expect(disabledRes.ok).toBe(false);
    expect(disabledRes.status).toBe('disabled');

    // 2. Enabled with mocked OpenAI transport -> verifies grounding & usage logging
    await updateAiGatewayConfig(actor, {
      isEnabled: true,
      monthlyBudgetUsd: 50,
      rateLimitPerHour: 100,
    });

    let capturedSystemPrompt = '';
    const aiRes = await runCmsAiAssistant(
      actor,
      {
        featureKey: 'outlineBrief',
        locale: 'en',
        destinationId: SEED_IDS.destinations.daNang,
        title: 'An Thuong Remote Work Brief',
        focusKeyword: 'An Thuong remote work',
      },
      {
        complete: async ({ systemPrompt }) => {
          capturedSystemPrompt = systemPrompt;
          return {
            text: '## Overview of An Thuong\n- Verified fiber Wi-Fi across monthly stays',
            promptTokens: 320,
            completionTokens: 140,
          };
        },
      }
    );

    expect(aiRes.ok).toBe(true);
    expect(aiRes.outputText).toContain('Overview of An Thuong');
    expect(capturedSystemPrompt).toContain('da-nang');

    // 3. RBAC: limited staff without 'content.approve' cannot pass permission check
    const limitedActor = {
      ...actor,
      roleSlug: 'content_editor',
      permissions: {
        content: {
          moduleKey: 'content' as const,
          actions: ['view' as const, 'edit' as const],
          piiAccess: false,
          dataScope: 'all' as const,
        },
      },
    };
    await expect(
      assertAdminActorHasPermission(limitedActor, 'content', 'approve')
    ).rejects.toThrow();

    // 4. Track article_view via /api/track (verifying admin_staff_profiles query fix)
    const trackRes = await trackRoutePost(
      new NextRequest('http://localhost/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionKey: 'ses_cms_pro_test_001',
          eventName: 'article_view',
          contentId: 'b8000000-0000-4000-8000-000000000001',
          destinationSlug: 'da-nang',
          landingPath: '/guides/an-thuong-da-nang-30-day-living-guide',
          dedupeKey: 'article_view:ses_cms_pro_test_001:b8000000',
        }),
      })
    );
    expect(trackRes.status).toBe(200);
    const trackJson = (await trackRes.json()) as { ok: boolean };
    expect(trackJson.ok).toBe(true);
  });
});
