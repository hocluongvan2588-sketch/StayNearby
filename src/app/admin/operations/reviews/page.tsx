import { AdminAccessWall, requireAdminPageAccess } from '@/lib/admin-page-guard';
import { listAdminReviews } from '@/modules/admin-bos';
import { ReviewsModerationView } from '@/components/admin/bos/OperationsClient';

export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
  const access = await requireAdminPageAccess('reviews', 'view');
  if (!access.allowed) return <AdminAccessWall reason={access.reason} email={access.email} />;
  const reviews = await listAdminReviews();
  return <ReviewsModerationView initialReviews={reviews} />;
}
