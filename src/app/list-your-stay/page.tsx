import { getCurrentUser } from '@/lib/auth/session';
import { getDestinations } from '@/modules/catalog';
import { ListYourStayClient } from '@/components/ListYourStayClient';

export const dynamic = 'force-dynamic';

export default async function ListYourStayPage() {
  const [user, destinations] = await Promise.all([
    getCurrentUser(),
    getDestinations(),
  ]);
  return <ListYourStayClient user={user} destinations={destinations} />;
}
