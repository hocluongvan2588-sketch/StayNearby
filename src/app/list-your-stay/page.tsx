import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/session';
import { getDestinations } from '@/modules/catalog';
import { ListYourStayClient } from '@/components/ListYourStayClient';

export const dynamic = 'force-dynamic';

export default async function ListYourStayPage() {
  const [user, destinations] = await Promise.all([
    getCurrentUser(),
    getDestinations(),
  ]);
  const isHost = user?.role === 'host' || user?.role === 'admin';
  return (
    <div>
      {isHost && (
        <div className="border-b border-[#E5DFD3] bg-[#E7F1EC] px-4 py-3">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-medium text-[#164E3F]">
              Bạn đã có tài khoản Host. Bạn có thể tạo chỗ ở mới trực tiếp bằng Trình hướng dẫn mới với lưu nháp tự động.
            </span>
            <Link
              href="/host/listings/create"
              className="rounded-lg bg-[#164E3F] px-3.5 py-1.5 font-semibold text-white hover:bg-[#0F392E]"
            >
              Mở Wizard đăng chỗ ở →
            </Link>
          </div>
        </div>
      )}
      <ListYourStayClient user={user} destinations={destinations} />
    </div>
  );
}
