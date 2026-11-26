import type { MetadataRoute } from 'next';
import { getConfig } from '@/lib/config';
import { getDestinations, searchStays } from '@/modules/catalog';
import { getIndexableCmsSlugs } from '@/modules/cms';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getConfig().appBaseUrl.replace(/\/$/, '');
  const [destinations, stays, cmsItems] = await Promise.all([
    getDestinations(),
    searchStays(),
    getIndexableCmsSlugs(),
  ]);

  const staticRoutes = ['', '/stays', '/deals', '/community', '/guides', '/list-your-stay', '/membership'].map(
    (path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
    })
  );

  const destinationRoutes = destinations.map((d) => ({
    url: `${baseUrl}/destinations/${d.slug}`,
    lastModified: new Date(),
  }));

  const stayRoutes = stays.map((s) => ({
    url: `${baseUrl}/stays/${s.slug}`,
    lastModified: new Date(),
  }));

  const cmsRoutes = cmsItems.map((c) => ({
    url: `${baseUrl}/guides/${c.slug}`,
    lastModified: new Date(c.updatedAt),
  }));

  return [...staticRoutes, ...destinationRoutes, ...stayRoutes, ...cmsRoutes];
}
