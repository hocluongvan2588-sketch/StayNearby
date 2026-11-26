import { dbQuery } from '@/lib/db';
import { listCmsCategories, listCmsTags } from '@/modules/cms-vietnomad';

export async function loadCmsEditorOptions() {
  const [categories, tags, destRes, nbRes] = await Promise.all([
    listCmsCategories(),
    listCmsTags(),
    dbQuery<{ id: string; slug: string; name_en: string }>(
      `SELECT id, slug, name_en FROM destinations ORDER BY name_en ASC`
    ),
    dbQuery<{ id: string; destination_id: string; name_en: string }>(
      `SELECT id, destination_id, name_en FROM neighborhoods ORDER BY name_en ASC`
    ),
  ]);

  return {
    categories,
    tags,
    destinations: destRes.rows.map((d) => ({
      id: d.id,
      slug: d.slug,
      nameEn: d.name_en,
    })),
    neighborhoods: nbRes.rows.map((n) => ({
      id: n.id,
      destinationId: n.destination_id,
      nameEn: n.name_en,
    })),
  };
}
