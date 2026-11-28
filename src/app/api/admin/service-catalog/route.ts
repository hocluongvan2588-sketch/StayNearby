import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { logAdminAudit } from '@/modules/admin-rbac';
import {
  adminSetStayServiceEnabled,
  getServiceCatalog,
  setCatalogItemEnabled,
} from '@/modules/stay-extras';

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== 'admin') throw new AppError('FORBIDDEN', 'Admin access required.');
    const includeDisabled = new URL(req.url).searchParams.get('includeDisabled') === '1';
    const catalog = await getServiceCatalog({ includeDisabled });
    return okJson({ catalog });
  } catch (err) {
    return errJson(err);
  }
}

const toggleSchema = z.object({
  catalogId: z.string().uuid().optional(),
  stayServiceId: z.string().uuid().optional(),
  enabled: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== 'admin') throw new AppError('FORBIDDEN', 'Admin access required.');
    const raw = await req.json().catch(() => ({}));
    const parsed = toggleSchema.safeParse(raw);
    if (!parsed.success || (!parsed.data.catalogId && !parsed.data.stayServiceId)) {
      throw new AppError('VALIDATION_ERROR', 'Provide catalogId or stayServiceId to toggle.');
    }
    const { catalogId, stayServiceId, enabled } = parsed.data;
    if (catalogId) {
      await setCatalogItemEnabled(user, catalogId, enabled);
      await logAdminAudit({
        actor: user,
        module: 'stay_extras',
        action: enabled ? 'enable_catalog' : 'disable_catalog',
        entityType: 'service_catalog',
        entityId: catalogId,
        after: { enabled },
      });
    } else if (stayServiceId) {
      await adminSetStayServiceEnabled(user, stayServiceId, enabled);
      await logAdminAudit({
        actor: user,
        module: 'stay_extras',
        action: enabled ? 'enable_stay_service' : 'disable_stay_service',
        entityType: 'stay_services',
        entityId: stayServiceId,
        after: { enabled },
      });
    }
    return okJson({ ok: true });
  } catch (err) {
    return errJson(err);
  }
}
