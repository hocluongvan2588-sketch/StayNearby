import Link from 'next/link';
import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { getCmsOverviewAndSeoAudit } from '@/modules/cms-vietnomad';
import { CmsSubNav } from '@/components/cms-admin/CmsSubNav';

export const dynamic = 'force-dynamic';

export default async function AdminCmsSeoAuditPage() {
  const access = await requireAdminPageAccess('content', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;

  const audit = await getCmsOverviewAndSeoAudit();

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          SEO Audit &amp; Content Attribution
        </h1>
        <p className="text-sm text-[#53635D]">
          Identify orphan articles, keyword conflicts, broken internal links, and track content-to-stay booking attribution.
        </p>
      </div>

      <CmsSubNav />

      {/* Overview Metric Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Published Articles" value={String(audit.summary.published)} />
        <StatCard
          label="Average SEO Score"
          value={`${audit.summary.avgSeoScore}/100`}
          tone={audit.summary.avgSeoScore >= 75 ? 'good' : 'warn'}
        />
        <StatCard
          label="Orphan Pages"
          value={String(audit.summary.orphanContentsCount)}
          tone={audit.summary.orphanContentsCount === 0 ? 'good' : 'warn'}
        />
        <StatCard
          label="Broken Internal Links"
          value={String(audit.summary.brokenLinksCount)}
          tone={audit.summary.brokenLinksCount === 0 ? 'good' : 'bad'}
        />
        <StatCard
          label="Attributed Bookings"
          value={String(audit.funnel.attributedBookings)}
          tone="good"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Orphan Content / Keyword Conflicts */}
        <section className="rounded-2xl border border-[#E5DFD3] bg-white p-5">
          <h2 className="mb-3 font-serif-display text-lg font-semibold text-[#17221E]">
            Orphan Published Articles ({audit.orphanContents.length})
          </h2>
          {audit.orphanContents.length === 0 ? (
            <p className="text-xs text-[#164E3F]">
              All published articles have incoming internal links.
            </p>
          ) : (
            <div className="divide-y divide-[#E5DFD3] text-xs">
              {audit.orphanContents.slice(0, 12).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <Link
                      href={`/admin/growth/content/${item.id}`}
                      className="font-semibold text-[#17221E] hover:text-[#164E3F] hover:underline"
                    >
                      {item.title}
                    </Link>
                    <div className="text-[11px] text-[#53635D]">
                      /guides/{item.slug} · {item.contentType.replace('_', ' ')}
                    </div>
                  </div>
                  <span className="rounded-full bg-[#FEF7EC] px-2.5 py-0.5 font-bold text-[#9A5B13]">
                    {item.seoScore}/100
                  </span>
                </div>
              ))}
            </div>
          )}

          {audit.keywordConflicts.length > 0 && (
            <div className="mt-5 border-t border-[#E5DFD3] pt-4">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#9A5B13]">
                Duplicate Focus Keywords ({audit.keywordConflicts.length})
              </h3>
              <div className="space-y-2 text-xs">
                {audit.keywordConflicts.map((kc) => (
                  <div
                    key={kc.keyword}
                    className="rounded-xl border border-[#E6B87A] bg-[#FEF7EC] p-2.5"
                  >
                    <div className="font-semibold text-[#6B4211]">
                      &ldquo;{kc.keyword}&rdquo; ({kc.count} articles)
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {kc.items.map((it) => (
                        <Link
                          key={it.id}
                          href={`/admin/growth/content/${it.id}`}
                          className="underline text-[#164E3F]"
                        >
                          {it.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Broken Links Monitor */}
        <section className="rounded-2xl border border-[#E5DFD3] bg-white p-5">
          <h2 className="mb-3 font-serif-display text-lg font-semibold text-[#17221E]">
            Broken Internal Links Monitor ({audit.brokenLinks.length})
          </h2>
          {audit.brokenLinks.length === 0 ? (
            <p className="text-xs text-[#164E3F]">
              Zero broken internal links detected across CMS content.
            </p>
          ) : (
            <div className="divide-y divide-[#E5DFD3] text-xs">
              {audit.brokenLinks.map((lk) => (
                <div key={lk.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="font-semibold text-[#17221E]">{lk.sourceTitle}</div>
                    <div className="font-mono text-[11px] text-red-600">{lk.targetPath}</div>
                  </div>
                  <Link
                    href={`/admin/growth/content/${lk.sourceContentId}`}
                    className="rounded-lg border border-[#E5DFD3] px-2.5 py-1 font-semibold text-[#164E3F]"
                  >
                    Fix Link
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Attribution Funnel Performance */}
      <section className="mt-6 rounded-2xl border border-[#E5DFD3] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif-display text-lg font-semibold text-[#17221E]">
            Content Attribution &amp; Conversion Funnel
          </h2>
          <div className="flex flex-wrap gap-3 text-xs text-[#53635D]">
            <span>
              Article Views: <strong>{audit.funnel.articleViews}</strong>
            </span>
            <span>
              Destination Views: <strong>{audit.funnel.destinationViews}</strong>
            </span>
            <span>
              Stay Views: <strong>{audit.funnel.stayViews}</strong>
            </span>
            <span>
              Completed Bookings: <strong>{audit.funnel.bookingCompleted}</strong>
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-semibold uppercase text-[#53635D]">
              <tr>
                <th className="px-3 py-2.5">Content / Slug</th>
                <th className="px-3 py-2.5">SEO Score</th>
                <th className="px-3 py-2.5">Article Views</th>
                <th className="px-3 py-2.5">Bookings Assisted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {audit.topPerformingArticles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[#53635D]">
                    Attribution events will appear here as readers browse /guides/[slug] and book stays.
                  </td>
                </tr>
              ) : (
                audit.topPerformingArticles.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/admin/growth/content/${row.id}`}
                        className="font-semibold text-[#17221E] hover:underline"
                      >
                        {row.title}
                      </Link>
                      <div className="font-mono text-[11px] text-[#53635D]">/guides/{row.slug}</div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{row.seoScore}/100</td>
                    <td className="px-3 py-2.5 font-semibold">{row.articleViews}</td>
                    <td className="px-3 py-2.5 font-semibold text-[#164E3F]">
                      {row.bookingsAssisted}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneCls =
    tone === 'good'
      ? 'text-[#164E3F]'
      : tone === 'warn'
        ? 'text-[#9A5B13]'
        : tone === 'bad'
          ? 'text-red-700'
          : 'text-[#17221E]';
  return (
    <div className="rounded-2xl border border-[#E5DFD3] bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#53635D]">
        {label}
      </div>
      <div className={`mt-1 font-serif-display text-2xl font-semibold ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}
