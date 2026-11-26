import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { getConversationMessages, getHostInboxData } from '@/modules/host-inbox';
import { HostMessagesClient } from '@/components/host/HostMessagesClient';

export const dynamic = 'force-dynamic';

export default async function HostMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'host' && user.role !== 'admin')) {
    redirect('/login?next=/host/messages');
  }
  const sp = await searchParams;
  const inbox = await getHostInboxData(user);
  const selectedId =
    sp.c && inbox.conversations.some((c) => c.id === sp.c)
      ? sp.c
      : inbox.conversations[0]?.id ?? null;

  const messages = selectedId ? await getConversationMessages(user, selectedId) : [];

  return (
    <HostMessagesClient
      initialInbox={inbox}
      initialSelectedId={selectedId}
      initialMessages={messages}
    />
  );
}
