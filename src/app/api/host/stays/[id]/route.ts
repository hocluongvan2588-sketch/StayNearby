import { z } from 'zod';
import { requireRole } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import { updateHostStayConfiguration } from '@/modules/host';

const coworkingSchema = z.object({
  name: z.string().min(1).max(120),
  distance: z.string().min(1).max(80),
});

const schema = z.object({
  wholesale7Vnd: z.number().positive().optional(),
  wholesale14Vnd: z.number().positive().optional(),
  wholesale21Vnd: z.number().positive().optional(),
  wholesale30Vnd: z.number().positive().optional(),
  extraNightVnd: z.number().positive().optional(),
  isDealFeatured: z.boolean().optional(),
  dealMonthLabel: z.string().max(60).optional(),

  heroImage: z.string().min(1).max(600).optional(),
  workspacePhotoUrl: z.string().min(1).max(600).optional(),
  galleryImages: z.array(z.string().min(1).max(600)).max(24).optional(),

  titleEn: z.string().min(2).max(140).optional(),
  titleVi: z.string().min(2).max(140).optional(),
  subtitleEn: z.string().min(2).max(200).optional(),
  subtitleVi: z.string().min(2).max(200).optional(),
  descriptionEn: z.string().min(10).max(4000).optional(),
  descriptionVi: z.string().min(10).max(4000).optional(),
  neighborhoodEn: z.string().min(2).max(120).optional(),
  neighborhoodVi: z.string().min(2).max(120).optional(),
  exactAddress: z.string().min(4).max(300).optional(),
  checkinInstructionsEn: z.string().min(4).max(2000).optional(),
  checkinInstructionsVi: z.string().min(4).max(2000).optional(),
  propertyType: z
    .enum(['apartment', 'coliving', 'boutique_hotel', 'villa', 'eco_lodge'])
    .optional(),
  cancellationPolicy: z.enum(['flexible', 'moderate', 'strict']).optional(),
  isInstantBook: z.boolean().optional(),
  workspaceSummaryEn: z.string().min(4).max(1500).optional(),
  workspaceSummaryVi: z.string().min(4).max(1500).optional(),
  hasWorkspace: z.boolean().optional(),
  hasErgonomicChair: z.boolean().optional(),
  hasExternalMonitor: z.boolean().optional(),
  hasCallBooth: z.boolean().optional(),
  kitchenType: z.enum(['full', 'kitchenette', 'shared', 'none']).optional(),
  laundryType: z.enum(['in_unit', 'building', 'service', 'none']).optional(),
  petFriendly: z.boolean().optional(),
  wheelchairFriendly: z.boolean().optional(),
  amenities: z.array(z.string().min(1).max(80)).max(30).optional(),
  nearbyCoworking: z.array(coworkingSchema).max(8).optional(),
  status: z.enum(['live', 'paused']).optional(),
  checkinFrom: z.string().max(20).optional(),
  checkoutBefore: z.string().max(20).optional(),
  defaultMinNights: z.number().int().min(7).max(90).optional(),
  houseRules: z
    .object({
      quietHours: z.string().max(80).optional(),
      smokingAllowed: z.boolean().optional(),
      partiesAllowed: z.boolean().optional(),
      petsNote: z.string().max(300).optional(),
      extraGuestNote: z.string().max(300).optional(),
    })
    .optional(),
});

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
