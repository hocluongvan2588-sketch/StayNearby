import { errJson, okJson } from '@/lib/http';
import { getServiceCatalog } from '@/modules/stay-extras';

/** Enabled platform service categories (safe to expose: labels only). */
export async function GET() {
  try {
    const catalog = await getServiceCatalog();
    return okJson({ catalog });
  } catch (err) {
    return errJson(err);
  }
}
