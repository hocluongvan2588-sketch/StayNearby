import { errJson, okJson } from '@/lib/http';
import { getStayServicesForPublic } from '@/modules/stay-extras';

/**
 * Public list of enabled extra services for a stay (the path segment is
 * named [slug] to match sibling routes; the value may be the stay id).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const services = await getStayServicesForPublic(slug);
    return okJson({ services });
  } catch (err) {
    return errJson(err);
  }
}
