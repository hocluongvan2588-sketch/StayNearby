import { getConfig } from '@/lib/config';
import { dbQuery } from '@/lib/db';
import { errJson, okJson } from '@/lib/http';

export async function GET() {
  try {
    const res = await dbQuery<{ count: string | number }>('SELECT COUNT(*) AS count FROM stays');
    const cfg = getConfig();
    return okJson({
      brandName: cfg.brandName,
      dbMode: cfg.databaseUrl ? 'postgres' : 'pglite',
      liveStays: Number(res.rows[0]?.count ?? 0),
    });
  } catch (err) {
    return errJson(err);
  }
}
