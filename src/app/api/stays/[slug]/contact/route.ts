import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { errJson, okJson } from '@/lib/http';
import {
  getGuestInquiryThreadForStay,
  sendGuestInquiryToHost,
} from '@/modules/host-inbox';

const postSchema = z.object({
  body: z.string().min(2).max(4000),
});

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await requireUser();
    const { slug } = await context.params;
    const out = await getGuestInquiryThreadForStay(user, slug);
    return okJson(out);
  } catch (err) {
    return errJson(err);
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const user = await requireUser();
    const { slug } = await context.params;
    const raw = await req.json();
    const parsed = postSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'Please write a short message (2–4000 characters).');
    }
    const out = await sendGuestInquiryToHost(user, slug, parsed.data.body);
    return okJson(out, 201);
  } catch (err) {
    return errJson(err);
  }
}
