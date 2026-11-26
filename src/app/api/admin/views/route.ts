import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { dbQuery } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { requireAdminPermission } from '@/modules/admin-rbac';

const createSchema = z.object({
  moduleKey: z.string().min(2).max(60),
  name: z.string().min(2).max(80),
  filtersJson: z.record(z.string(), z.unknown()).default({}),
  columnsJson: z.array(z.string()).default([]),
});

export async function GET(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('overview', 'view');
    const mod = req.nextUrl.searchParams.get('moduleKey');
    const res = await dbQuery<{
      id: string;
      module_key: string;
      name: string;
      filters_json: Record<string, unknown>;
      columns_json: string[];
    }>(
      mod
        ? `SELECT id, module_key, name, filters_json, columns_json FROM admin_saved_views WHERE user_id = $1 AND module_key = $2 ORDER BY created_at DESC`
        : `SELECT id, module_key, name, filters_json, columns_json FROM admin_saved_views WHERE user_id = $1 ORDER BY created_at DESC`,
      mod ? [actor.user.id, mod] : [actor.user.id]
    );
    return okJson({
      views: res.rows.map((v) => ({
        id: String(v.id),
        moduleKey: String(v.module_key),
        name: String(v.name),
        filtersJson: v.filters_json ?? {},
        columnsJson: Array.isArray(v.columns_json) ? v.columns_json : [],
      })),
    });
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('overview', 'view');
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid saved view payload.');
    const id = crypto.randomUUID();
    await dbQuery(
      `INSERT INTO admin_saved_views (id, user_id, module_key, name, filters_json, columns_json)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`,
      [
        id,
        actor.user.id,
        parsed.data.moduleKey,
        parsed.data.name.trim(),
        JSON.stringify(parsed.data.filtersJson),
        JSON.stringify(parsed.data.columnsJson),
      ]
    );
    return okJson({ id }, 201);
  } catch (err) {
    return errJson(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = await requireAdminPermission('overview', 'view');
    const { id } = (await req.json()) as { id?: string };
    if (!id) throw new AppError('VALIDATION_ERROR', 'Saved view id required.');
    await dbQuery('DELETE FROM admin_saved_views WHERE id = $1 AND user_id = $2', [
      id,
      actor.user.id,
    ]);
    return okJson({ ok: true });
  } catch (err) {
    return errJson(err);
  }
}
