import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { updateAdminStayStatus, updateAdminStayVerification } from '@/modules/admin';

const schema = z.object({
  status: z.enum(['live', 'limited', 'paused']).optional(),
  verificationTier: z
    .enum(['SELF_DECLARED', 'HOST_VERIFIED', 'VIETNOMAD_CERTIFIED'])
    .optional(),
  isWifiVerified: z.boolean().optional(),
  isWorkReady: z.boolean().optional(),
  speedtestProofUrl: z.string().max(500).optional(),
  workspaceVideoUrl: z.string().max(500).optional(),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireRole('admin');
    const { id } = await context.params;
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Invalid stay update payload.');

    if (parsed.data.status) {
      await updateAdminStayStatus(admin, id, parsed.data.status);
    }
    if (
      parsed.data.verificationTier !== undefined ||
      parsed.data.isWifiVerified !== undefined ||
      parsed.data.isWorkReady !== undefined ||
      parsed.data.speedtestProofUrl !== undefined ||
      parsed.data.workspaceVideoUrl !== undefined
    ) {
      await updateAdminStayVerification(admin, id, {
        verificationTier: parsed.data.verificationTier,
        isWifiVerified: parsed.data.isWifiVerified,
        isWorkReady: parsed.data.isWorkReady,
        speedtestProofUrl: parsed.data.speedtestProofUrl,
        workspaceVideoUrl: parsed.data.workspaceVideoUrl,
      });
    }
    return okJson({ ok: true });
  } catch (err) {
    return errJson(err);
  }
}
