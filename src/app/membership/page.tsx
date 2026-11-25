import { getCurrentUser } from '@/lib/auth/session';
import { MembershipUpgradeClient } from '@/components/MembershipUpgradeClient';

export const dynamic = 'force-dynamic';

export default async function MembershipPage() {
  const user = await getCurrentUser();
  return <MembershipUpgradeClient user={user} />;
}
