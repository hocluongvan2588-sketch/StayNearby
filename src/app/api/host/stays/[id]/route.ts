import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { listingPatchSchema } from '@/lib/listing-form-schema';
import { updateHostStayConfiguration } from '@/modules/host';

// Shared validation — single source with the create Wizard (see
// src/lib/listing-form-schema.ts).
const schema = listingPatchSchema;

async function handleUpdate(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(['host', 'admin']);
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid stay update payload.');
    }
    const out = await updateHostStayConfiguration(user, id, parsed.data);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdate(req, context);
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  return handleUpdate(req, context);
}
