import { getServerPreferences } from '@/lib/preferences';
import { getDestinations } from '@/modules/catalog';
import { getEventTaxonomy } from '@/modules/platform-settings';
import { SubmitEventForm } from '@/components/events/SubmitEventForm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Đăng sự kiện | VietNomad Stays',
  description: 'Gửi sự kiện của bạn để VietNomad kiểm duyệt và xuất bản trên trang Cộng đồng.',
};

export default async function SubmitEventPage() {
  const [prefs, taxonomy, destinations] = await Promise.all([
    getServerPreferences(),
    getEventTaxonomy(),
    getDestinations(),
  ]);
  const isVi = prefs.locale === 'vi';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-[#17221E] sm:text-4xl">
        {isVi ? 'Đăng sự kiện' : 'Submit an event'}
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#53635D]">
        {isVi
          ? 'Cá nhân, chủ nhà, doanh nghiệp địa phương và đơn vị tổ chức đều có thể gửi sự kiện. Thông tin được VietNomad kiểm duyệt trước khi xuất bản; email liên hệ không được công khai.'
          : 'Individuals, hosts, local businesses, and organizers can all submit. VietNomad reviews every submission before it goes live; your contact email is never published.'}
      </p>
      <div className="mt-8">
        <SubmitEventForm
          destinations={destinations.map((d) => ({
            id: d.id,
            nameEn: d.nameEn,
            nameVi: d.nameVi,
          }))}
          taxonomy={taxonomy}
          locale={prefs.locale}
        />
      </div>
    </div>
  );
}
