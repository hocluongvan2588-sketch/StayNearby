import { getConfig } from '@/lib/config';
import { DEMO_CREDENTIALS } from '@/lib/db/seed-data';
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

  const demoAccounts = getConfig().demoMode
    ? DEMO_CREDENTIALS.map((d) => ({
        key: d.key,
        email: d.email,
        password: d.password,
        role: d.role,
        labelEn: d.labelEn,
        labelVi: d.labelVi,
      }))
    : [];

  return <LoginClient nextPath={nextPath} demoAccounts={demoAccounts} />;
}
