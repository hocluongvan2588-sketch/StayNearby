import { LoginClient } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const nextRaw = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  const nextPath = nextRaw && nextRaw.startsWith('/') ? nextRaw : '';

  return <LoginClient nextPath={nextPath} demoAccounts={[]} />;
}
