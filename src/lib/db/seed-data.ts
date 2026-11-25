import { hashPassword } from '@/lib/auth/password';
import { addDaysIso, getTodayIsoInTimezone } from '@/lib/format';
import { markDbInitialized, runWithDbBootstrap, withTransaction } from './index';
import { computeQuoteHash } from '@/modules/pricing';
import { CANCELLATION_POLICIES } from '@/lib/config';

export const SEED_IDS = {
  users: {
    guest: '11111111-1111-4111-8111-111111111101',
    host1: '11111111-1111-4111-8111-111111111102',
    host2: '11111111-1111-4111-8111-111111111103',
    admin: '11111111-1111-4111-8111-111111111104',
  },
  areas: {
    tayHo: '22222222-2222-4222-8222-222222222201',
    anThuong: '22222222-2222-4222-8222-222222222202',
    camChau: '22222222-2222-4222-8222-222222222203',
    thaoDien: '22222222-2222-4222-8222-222222222204',
  },
  listings: {
    tayHoLoft: '33333333-3333-4333-8333-333333333301',
    tayHoStudio: '33333333-3333-4333-8333-333333333302',
    anThuongApt: '33333333-3333-4333-8333-333333333303',
    anThuongHouse: '33333333-3333-4333-8333-333333333304',
    camChauVilla: '33333333-3333-4333-8333-333333333305',
    thaoDienStudio: '33333333-3333-4333-8333-333333333306',
    tayHoPending: '33333333-3333-4333-8333-333333333307',
    camChauDraft: '33333333-3333-4333-8333-333333333308',
  },
  bookings: {
    confirmedSample: '44444444-4444-4444-8444-444444444401',
    pendingSample: '44444444-4444-4444-8444-444444444402',
  },
  localPlaces: {
    tayHoCowork: '55555555-5555-4555-8555-555555555501',
    tayHoFood: '55555555-5555-4555-8555-555555555502',
    tayHoWalk: '55555555-5555-4555-8555-555555555503',
    anThuongMiQuang: '55555555-5555-4555-8555-555555555504',
    anThuongCowork: '55555555-5555-4555-8555-555555555505',
    anThuongBeach: '55555555-5555-4555-8555-555555555506',
    camChauLantern: '55555555-5555-4555-8555-555555555507',
    camChauCaoLau: '55555555-5555-4555-8555-555555555508',
    camChauCycle: '55555555-5555-4555-8555-555555555509',
    thaoDienRoastery: '55555555-5555-4555-8555-555555555510',
    thaoDienRiverBistro: '55555555-5555-4555-8555-555555555511',
  },
  localGuides: {
    tayHoMorningWork: '66666666-6666-4666-8666-666666666601',
    tayHoEveningFood: '66666666-6666-4666-8666-666666666602',
    tayHoDraftHidden: '66666666-6666-4666-8666-666666666603',
    anThuongFoodStroll: '66666666-6666-4666-8666-666666666604',
    anThuongWorkDay: '66666666-6666-4666-8666-666666666605',
    camChauLanternEvening: '66666666-6666-4666-8666-666666666606',
    camChauHalfDayCycle: '66666666-6666-4666-8666-666666666607',
    thaoDienDeepWork: '66666666-6666-4666-8666-666666666608',
    thaoDienGroupDinner: '66666666-6666-4666-8666-666666666609',
  },
} as const;

export const DEMO_ACCOUNTS = {
  guest: {
    email: 'guest@workinghome.demo',
    password: 'DemoGuest!2026',
    displayName: 'Alex Mercer',
    roleSummaryEn: 'Guest (Solo remote worker, 2–4 week stay)',
    roleSummaryVi: 'Khách lưu trú (Làm việc từ xa 2–4 tuần)',
  },
  host: {
    email: 'host@workinghome.demo',
    password: 'DemoHost!2026',
    displayName: 'Minh Anh Nguyễn',
    roleSummaryEn: 'Host + Guest (Tây Hồ & Đà Nẵng)',
    roleSummaryVi: 'Chủ nhà + Khách (Tây Hồ & Đà Nẵng)',
  },
  host2: {
    email: 'host2@workinghome.demo',
    password: 'DemoHost2!2026',
    displayName: 'Quốc Bảo Trần',
    roleSummaryEn: 'Host (Hội An & Thảo Điền)',
    roleSummaryVi: 'Chủ nhà (Hội An & Thảo Điền)',
  },
  admin: {
    email: 'admin@workinghome.demo',
    password: 'DemoAdmin!2026',
    displayName: 'Thu Hà Phạm',
    roleSummaryEn: 'Platform Admin (Moderation & Ops)',
    roleSummaryVi: 'Quản trị nền tảng (Kiểm duyệt & Vận hành)',
  },
} as const;

export async function runSeed(): Promise<void> {
  return runWithDbBootstrap(async () => {
  const todayVn = getTodayIsoInTimezone('Asia/Ho_Chi_Minh');

  const guestHash = hashPassword(DEMO_ACCOUNTS.guest.password);
  const hostHash = hashPassword(DEMO_ACCOUNTS.host.password);
  const host2Hash = hashPassword(DEMO_ACCOUNTS.host2.password);
  const adminHash = hashPassword(DEMO_ACCOUNTS.admin.password);

  await withTransaction(async (tx) => {
    // 1. Roles
    const rolesData = [
      ['guest', 'Guest', 'Khách lưu trú', 'Search stays, request bookings, manage own trips.'],
      ['host', 'Host', 'Chủ nhà', 'Manage own stays, calendar, rates, and respond to booking requests.'],
      ['admin', 'Administrator', 'Quản trị viên', 'Moderate listings, inspect bookings, and handle support exceptions.'],
    ];
    for (const [code, labelEn, labelVi, description] of rolesData) {
      await tx.query(
        `INSERT INTO roles (code, label_en, label_vi, description)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (code) DO UPDATE
         SET label_en = EXCLUDED.label_en, label_vi = EXCLUDED.label_vi, description = EXCLUDED.description`,
        [code, labelEn, labelVi, description]
      );
    }

    // 2. Demo Profiles & Role Grants
    const profiles = [
      [
        SEED_IDS.users.guest,
        DEMO_ACCOUNTS.guest.email,
        DEMO_ACCOUNTS.guest.displayName,
        'en',
        '+84 90 123 4500',
        guestHash,
        'vip',
        'Khách lưu trú dài ngày (remote work 2–4 tuần), ưu tiên khu Tây Hồ và An Thượng.',
      ],
      [
        SEED_IDS.users.host1,
        DEMO_ACCOUNTS.host.email,
        DEMO_ACCOUNTS.host.displayName,
        'vi',
        '+84 90 123 4501',
        hostHash,
        'active',
        'Chủ nhà đối tác lâu năm tại Hà Nội & Đà Nẵng, tỷ lệ phản hồi nhanh.',
      ],
      [
        SEED_IDS.users.host2,
        DEMO_ACCOUNTS.host2.email,
        DEMO_ACCOUNTS.host2.displayName,
        'vi',
        '+84 90 123 4502',
        host2Hash,
        'follow_up',
        'Chủ nhà mới tại Hội An & Thảo Điền, cần hỗ trợ hoàn thiện hồ sơ căn hộ Thảo Điền.',
      ],
      [
        SEED_IDS.users.admin,
        DEMO_ACCOUNTS.admin.email,
        DEMO_ACCOUNTS.admin.displayName,
        'vi',
        '+84 90 123 4599',
        adminHash,
        'active',
        'Quản trị viên phụ trách kiểm duyệt chỗ ở, vận hành & chăm sóc khách hàng.',
      ],
    ] as const;

    for (const [id, email, name, locale, phone, pwHash, crmStage, crmNote] of profiles) {
      await tx.query(
        `INSERT INTO profiles (
           id, email, display_name, preferred_locale, phone, password_hash, is_demo,
           crm_stage, crm_note, crm_updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, NOW())
         ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             display_name = EXCLUDED.display_name,
             preferred_locale = EXCLUDED.preferred_locale,
             phone = COALESCE(profiles.phone, EXCLUDED.phone),
             password_hash = EXCLUDED.password_hash,
             is_demo = TRUE,
             crm_stage = CASE WHEN profiles.crm_updated_by IS NULL THEN EXCLUDED.crm_stage ELSE profiles.crm_stage END,
             crm_note = CASE WHEN profiles.crm_note = '' THEN EXCLUDED.crm_note ELSE profiles.crm_note END`,
        [id, email, name, locale, phone, pwHash, crmStage, crmNote]
      );
    }

    const roleGrants: [string, string][] = [
      [SEED_IDS.users.guest, 'guest'],
      [SEED_IDS.users.host1, 'host'],
      [SEED_IDS.users.host1, 'guest'], // Multi-role account
      [SEED_IDS.users.host2, 'host'],
      [SEED_IDS.users.admin, 'admin'],
    ];

    for (const [userId, roleCode] of roleGrants) {
      await tx.query(
        `INSERT INTO user_roles (user_id, role_code, granted_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, role_code) DO NOTHING`,
        [userId, roleCode, SEED_IDS.users.admin]
      );
    }

    // 3. Areas (Bilingual EN/VI with neighborhood vibe & walkability)
    const areas = [
      [
        SEED_IDS.areas.tayHo,
        'tay-ho-hanoi',
        'Tây Hồ',
        'Tây Hồ',
        'Hanoi',
        'Hà Nội',
        'Asia/Ho_Chi_Minh',
        'Leafy lakeside quarters with morning coffee spots, bakeries, and quiet residential alleys.',
        'Khu vực ven hồ nhiều cây xanh, yên tĩnh, thuận tiện cho khách lưu trú nhiều tuần.',
        'Calm lakeside mornings, lively cafés by day',
        'Yên tĩnh buổi sáng ven hồ, nhiều quán cà phê ban ngày',
        '5-minute walk to Xuân Diệu bakeries, pho stalls, and West Lake promenade.',
        'Đi bộ 5 phút tới tiệm bánh Xuân Diệu, quán phở sáng và đường dạo ven Hồ Tây.',
        '/images/stays/tay-ho-loft-main.jpg',
      ],
      [
        SEED_IDS.areas.anThuong,
        'an-thuong-da-nang',
        'An Thượng',
        'An Thượng',
        'Da Nang',
        'Đà Nẵng',
        'Asia/Ho_Chi_Minh',
        'Walkable coastal streets minutes from Mỹ Khê beach with late-night eateries and coworking.',
        'Khu phố ven biển Mỹ Khê, thuận tiện đi bộ ăn uống và không gian làm việc chung.',
        'Breezy coastal streets, social evenings',
        'Phố biển thoáng đãng, sôi động vào buổi tối',
        '3–6 minute walk to Mỹ Khê beach, local mì Quảng spots, and neighborhood gyms.',
        'Đi bộ 3–6 phút ra bãi biển Mỹ Khê, quán mì Quảng địa phương và phòng tập gần nhà.',
        '/images/stays/an-thuong-apartment-main.jpg',
      ],
      [
        SEED_IDS.areas.camChau,
        'cam-chau-hoi-an',
        'Cẩm Châu',
        'Cẩm Châu',
        'Hoi An',
        'Hội An',
        'Asia/Ho_Chi_Minh',
        'Peaceful ricefield lanes midway between Hoi An Ancient Town and Cửa Đại beach.',
        'Khu làng ven ruộng lúa yên bình giữa phố cổ Hội An và biển Cửa Đại.',
        'Quiet ricefield village, slow pace',
        'Làng quê yên bình bên ruộng lúa, nhịp sống chậm',
        '10 minutes by bicycle to Ancient Town markets, cafes, and riverside dining.',
        'Đạp xe 10 phút tới chợ Phố cổ Hội An, quán cà phê và hàng ăn ven sông.',
        '/images/stays/cam-chau-villa-main.jpg',
      ],
      [
        SEED_IDS.areas.thaoDien,
        'thao-dien-ho-chi-minh',
        'Thảo Điền',
        'Thảo Điền',
        'Ho Chi Minh City',
        'TP. Hồ Chí Minh',
        'Asia/Ho_Chi_Minh',
        'Tree-lined riverbend district with sunlit studios, metro access, and diverse dining.',
        'Khu dân cư nhiều cây xanh ven sông Sài Gòn, gần tuyến metro và nhiều nhà hàng.',
        'Lush riverbend streets, vibrant dining',
        'Đường rợp bóng cây ven sông, ẩm thực phong phú',
        '8-minute walk to An Phú Metro station, organic grocers, and specialty coffee.',
        'Đi bộ 8 phút tới ga Metro An Phú, cửa hàng thực phẩm sạch và cà phê đặc sản.',
        '/images/stays/thao-dien-studio-main.jpg',
      ],
    ] as const;

    for (const [
      id,
      slug,
      nameEn,
      nameVi,
      cityEn,
      cityVi,
      tz,
      descEn,
      descVi,
      vibeEn,
      vibeVi,
      walkEn,
      walkVi,
      img,
    ] of areas) {
      await tx.query(
        `INSERT INTO areas (
           id, slug, name_en, name_vi, city_en, city_vi, timezone,
           description_en, description_vi, vibe_summary_en, vibe_summary_vi,
           walkability_note_en, walkability_note_vi, hero_image_path, is_published
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, TRUE)
         ON CONFLICT (id) DO UPDATE
         SET slug = EXCLUDED.slug,
             name_en = EXCLUDED.name_en,
             name_vi = EXCLUDED.name_vi,
             city_en = EXCLUDED.city_en,
             city_vi = EXCLUDED.city_vi,
             timezone = EXCLUDED.timezone,
             description_en = EXCLUDED.description_en,
             description_vi = EXCLUDED.description_vi,
             vibe_summary_en = EXCLUDED.vibe_summary_en,
             vibe_summary_vi = EXCLUDED.vibe_summary_vi,
             walkability_note_en = EXCLUDED.walkability_note_en,
             walkability_note_vi = EXCLUDED.walkability_note_vi,
             hero_image_path = EXCLUDED.hero_image_path,
             is_published = TRUE`,
        [id, slug, nameEn, nameVi, cityEn, cityVi, tz, descEn, descVi, vibeEn, vibeVi, walkEn, walkVi, img]
      );
    }

    // 4. Structured Amenities (Wi-Fi is an optional host-declared checkbox, no speed ranking)
    const amenities = [
      ['wifi', 'workspace', 'Wi-Fi (host-declared)', 'Wi-Fi (chủ nhà khai báo)', 'Wifi'],
      ['dedicated_desk', 'workspace', 'Dedicated work desk & chair', 'Bàn làm việc và ghế riêng', 'Laptop'],
      ['kitchen', 'kitchen', 'Full kitchen & cookware', 'Bếp đầy đủ dụng cụ', 'Utensils'],
      ['washer', 'essentials', 'In-unit washing machine', 'Máy giặt riêng', 'Shirt'],
      ['air_conditioning', 'essentials', 'Air conditioning', 'Điều hòa nhiệt độ', 'Wind'],
      ['coffee_kettle', 'kitchen', 'Electric kettle & coffee drip', 'Ấm đun và dụng cụ pha cà phê', 'Coffee'],
      ['private_balcony', 'outdoor', 'Private balcony or garden', 'Ban công hoặc sân vườn riêng', 'Trees'],
      ['bicycle', 'outdoor', 'Complimentary bicycle', 'Xe đạp miễn phí', 'Bike'],
    ] as const;

    for (const [code, cat, labelEn, labelVi, icon] of amenities) {
      await tx.query(
        `INSERT INTO amenities (code, category, label_en, label_vi, icon_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE
         SET category = EXCLUDED.category, label_en = EXCLUDED.label_en,
             label_vi = EXCLUDED.label_vi, icon_name = EXCLUDED.icon_name`,
        [code, cat, labelEn, labelVi, icon]
      );
    }

    // 5. Listings (6 published, 1 pending_review, 1 draft without photos)
    const listings = [
      {
        id: SEED_IDS.listings.tayHoLoft,
        hostId: SEED_IDS.users.host1,
        areaId: SEED_IDS.areas.tayHo,
        slug: 'tay-ho-sunlit-lake-loft',
        status: 'published',
        propertyType: 'apartment',
        maxGuests: 2,
        bedrooms: 1,
        beds: 1,
        bathrooms: 1.0,
        minNights: 2,
        maxNights: 60,
        baseRate: 1450000,
        cleaningFee: 250000,
        policy: 'flexible_24h',
        titleEn: 'Sunlit West Lake Workspace Loft',
        titleVi: 'Loft sáng nắng ven Hồ Tây có bàn làm việc riêng',
        summaryEn: 'Corner lakeside apartment in Quảng An with an oak work desk, full kitchen, and in-unit washer.',
        summaryVi: 'Căn hộ góc ven hồ tại Quảng An trang bị bàn làm việc gỗ sồi, bếp đầy đủ và máy giặt riêng.',
        descEn:
          'Thoughtfully arranged for remote professionals spending two to four weeks in Hanoi. Enjoy natural afternoon light over West Lake, an oak work desk set apart from the bedroom, a full cooking kitchen, and quiet double-glazed windows.',
        descVi:
          'Được bố trí tinh tế cho người làm việc từ xa lưu trú từ hai đến bốn tuần tại Hà Nội. Căn hộ đón nắng chiều tự nhiên hướng Hồ Tây, có bàn làm việc gỗ sồi tách biệt khu ngủ, bếp nấu đầy đủ và cửa kính cách âm yên tĩnh.',
        houseRulesEn: [
          'Check-in from 14:00, check-out before 11:00 local time',
          'Quiet hours after 22:30 for residential neighbors',
          'No indoor smoking or unregistered overnight guests',
        ],
        houseRulesVi: [
          'Nhận phòng từ 14:00, trả phòng trước 11:00 theo giờ địa phương',
          'Giữ yên tĩnh sau 22:30 để tôn trọng hàng xóm khu dân cư',
          'Không hút thuốc trong nhà và không đưa khách qua đêm chưa đăng ký',
        ],
        hasDesk: true,
        workspaceNotesEn: '140 cm oak work desk beside the lake window with ergonomic chair and accessible power outlets.',
        workspaceNotesVi: 'Bàn làm việc gỗ sồi 140 cm cạnh cửa sổ hướng hồ kèm ghế công thái học và ổ cắm thuận tiện.',
        checkinConditionsEn: 'Self check-in via building gate & smart lock from 14:00; late arrival after 22:00 supported.',
        checkinConditionsVi: 'Tự nhận phòng qua cổng tòa nhà và khóa thông minh từ 14:00; hỗ trợ nhận phòng muộn sau 22:00.',
        lateCheckinAvailable: true,
        exactAddress: '48 Quảng Khánh Alley, Quảng An Ward, Tây Hồ District, Hanoi',
        checkinInstructionsEn: 'Building gate code #4820. Take elevator to 5th floor, apartment 5B smart-lock code sent after confirmation.',
        checkinInstructionsVi: 'Mã cổng tòa nhà #4820. Đi thang máy lên tầng 5, mã khóa thông minh căn 5B được gửi sau khi xác nhận đơn.',
        amenities: ['wifi', 'dedicated_desk', 'kitchen', 'washer', 'air_conditioning', 'coffee_kettle'],
        photos: [
          {
            id: '55555555-5555-4555-8555-555555555501',
            path: '/images/stays/tay-ho-loft-main.jpg',
            altEn: 'Sunlit West Lake living room and wooden workspace overlooking Hanoi lake',
            altVi: 'Phòng khách ngập nắng và góc làm việc gỗ hướng Hồ Tây tại Hà Nội',
            isCover: true,
            isDraft: false,
            sortOrder: 0,
          },
          {
            id: '55555555-5555-4555-8555-555555555502',
            path: '/images/stays/tay-ho-loft-desk.jpg',
            altEn: 'Ergonomic remote work desk with laptop stand and natural window light',
            altVi: 'Bàn làm việc từ xa có giá đỡ laptop cạnh cửa sổ ánh sáng tự nhiên',
            isCover: false,
            isDraft: false,
            sortOrder: 1,
          },
        ],
      },
      {
        id: SEED_IDS.listings.tayHoStudio,
        hostId: SEED_IDS.users.host1,
        areaId: SEED_IDS.areas.tayHo,
        slug: 'tay-ho-garden-terrace-studio',
        status: 'published',
        propertyType: 'studio',
        maxGuests: 2,
        bedrooms: 1,
        beds: 1,
        bathrooms: 1.0,
        minNights: 1,
        maxNights: 45,
        baseRate: 980000,
        cleaningFee: 180000,
        policy: 'flexible_24h',
        titleEn: 'Quiet Garden Terrace Studio',
        titleVi: 'Studio sân vườn yên tĩnh gần Xuân Diệu',
        summaryEn: 'Timber-lined studio off Xuân Diệu opening onto a leafy terrace with kitchen and writing desk.',
        summaryVi: 'Studio ốp gỗ ấm áp trong ngõ yên tĩnh phố Xuân Diệu, mở ra hiên vườn xanh với bếp và bàn viết.',
        descEn:
          'Tucked inside a peaceful lane just minutes from neighborhood bakeries and West Lake walking paths. Features warm teak cabinetry, an induction kitchenette, and a quiet desk by the terrace doors.',
        descVi:
          'Nằm trong con ngõ yên bình chỉ cách tiệm bánh và đường dạo Hồ Tây vài phút đi bộ. Không gian dùng nội thất gỗ tếch ấm cúng, bếp từ gọn gàng và bàn làm việc cạnh cửa kính ra sân vườn.',
        houseRulesEn: [
          'Check-in from 14:00, check-out before 11:00',
          'No pets and no parties',
        ],
        houseRulesVi: [
          'Nhận phòng từ 14:00, trả phòng trước 11:00',
          'Không mang thú cưng và không tổ chức tiệc ồn ào',
        ],
        hasDesk: true,
        workspaceNotesEn: 'Solid timber writing desk facing the private garden terrace.',
        workspaceNotesVi: 'Bàn làm việc gỗ tự nhiên hướng thẳng ra hiên vườn riêng.',
        checkinConditionsEn: 'Self check-in lockbox next to courtyard gate from 14:00; late arrival supported until 01:00.',
        checkinConditionsVi: 'Tự nhận phòng qua hộp khóa cạnh cổng sân từ 14:00; hỗ trợ nhận phòng muộn đến 01:00 sáng.',
        lateCheckinAvailable: true,
        exactAddress: '19/62 Xuân Diệu Lane, Quảng An, Tây Hồ, Hanoi',
        checkinInstructionsEn: 'Self check-in lockbox next to timber courtyard door; code sent after confirmation.',
        checkinInstructionsVi: 'Hộp khóa tự nhận phòng cạnh cửa gỗ sân vườn; mã hộp khóa sẽ được gửi sau khi xác nhận.',
        amenities: ['wifi', 'dedicated_desk', 'kitchen', 'air_conditioning', 'coffee_kettle', 'private_balcony'],
        photos: [
          {
            id: '55555555-5555-4555-8555-555555555503',
            path: '/images/stays/tay-ho-studio-main.jpg',
            altEn: 'Garden terrace studio with timber cabinetry and leafy balcony in Tay Ho',
            altVi: 'Studio sân vườn nội thất gỗ và ban công nhiều cây xanh ở Tây Hồ',
            isCover: true,
            isDraft: false,
            sortOrder: 0,
          },
        ],
      },
      {
        id: SEED_IDS.listings.anThuongApt,
        hostId: SEED_IDS.users.host1,
        areaId: SEED_IDS.areas.anThuong,
        slug: 'an-thuong-coastal-work-apartment',
        status: 'published',
        propertyType: 'apartment',
        maxGuests: 3,
        bedrooms: 1,
        beds: 2,
        bathrooms: 1.0,
        minNights: 2,
        maxNights: 90,
        baseRate: 1250000,
        cleaningFee: 200000,
        policy: 'flexible_24h',
        titleEn: 'Coastal Breeze Remote-Ready Apartment',
        titleVi: 'Căn hộ biển An Thượng sẵn sàng cho tuần làm việc',
        summaryEn: 'Bright sea-view apartment in An Thượng with full kitchen, washing machine, and balcony work table.',
        summaryVi: 'Căn hộ thoáng sáng khu An Thượng gần biển với bếp đầy đủ, máy giặt riêng và bàn làm việc cạnh ban công.',
        descEn:
          'Crafted for multi-week stays near Mỹ Khê beach. Wide oak dining-and-work table right beside the balcony, full kitchen and washer for daily living, and walking distance to neighborhood coworking and eateries.',
        descVi:
          'Phù hợp cho kỳ lưu trú nhiều tuần gần bãi biển Mỹ Khê. Bàn gỗ sồi rộng cạnh ban công đón gió biển, bếp nấu đầy đủ cùng máy giặt trong căn hộ và thuận tiện đi bộ tới quán ăn, coworking.',
        houseRulesEn: [
          'Rinse beach sand before entering the apartment',
          'Check-in from 14:00, check-out by 11:00',
          'Keep balcony doors closed when AC is running',
        ],
        houseRulesVi: [
          'Vui lòng xả sạch cát biển trước khi vào căn hộ',
          'Nhận phòng từ 14:00, trả phòng trước 11:00',
          'Đóng kín cửa ban công khi đang bật điều hòa',
        ],
        hasDesk: true,
        workspaceNotesEn: 'Wide oak table with natural sea light and supportive seating.',
        workspaceNotesVi: 'Bàn gỗ sồi rộng đón ánh sáng biển tự nhiên và ghế ngồi êm ái.',
        checkinConditionsEn: 'Reception 07:00–22:00; keypad PIN available for late arrivals after 22:00.',
        checkinConditionsVi: 'Lễ tân hỗ trợ 07:00–22:00; có mã PIN cửa điện tử cho khách nhận phòng muộn sau 22:00.',
        lateCheckinAvailable: true,
        exactAddress: '32 An Thượng 4, Mỹ An Ward, Ngũ Hành Sơn District, Da Nang',
        checkinInstructionsEn: 'Reception desk operates 07:00–22:00; keypad pin for unit 602 provided upon confirmation.',
        checkinInstructionsVi: 'Quầy lễ tân trực 07:00–22:00; mã PIN cửa căn 602 được cấp ngay sau khi xác nhận.',
        amenities: ['wifi', 'dedicated_desk', 'kitchen', 'washer', 'air_conditioning', 'private_balcony'],
        photos: [
          {
            id: '55555555-5555-4555-8555-555555555504',
            path: '/images/stays/an-thuong-apartment-main.jpg',
            altEn: 'Bright coastal apartment interior with work table and balcony view in Da Nang',
            altVi: 'Nội thất căn hộ ven biển thoáng sáng với bàn làm việc và ban công tại Đà Nẵng',
            isCover: true,
            isDraft: false,
            sortOrder: 0,
          },
        ],
      },
      {
        id: SEED_IDS.listings.anThuongHouse,
        hostId: SEED_IDS.users.host2,
        areaId: SEED_IDS.areas.anThuong,
        slug: 'an-thuong-minimal-beach-house',
        status: 'published',
        propertyType: 'house',
        maxGuests: 4,
        bedrooms: 2,
        beds: 2,
        bathrooms: 2.0,
        minNights: 3,
        maxNights: 60,
        baseRate: 2350000,
        cleaningFee: 350000,
        policy: 'moderate_5d',
        titleEn: 'Minimalist Timber Beach House',
        titleVi: 'Nhà phố giếng trời gỗ mộc gần biển Mỹ Khê',
        summaryEn: 'Two-bedroom courtyard townhouse near Mỹ Khê with quiet study nook, kitchen, and laundry.',
        summaryVi: 'Nhà nguyên căn 2 phòng ngủ gần biển Mỹ Khê có góc làm việc yên tĩnh, bếp và máy giặt riêng.',
        descEn:
          'Architectural two-level home blending raw concrete, warm teak stairs, and a lush internal atrium. Ideal for long work stays with separate living and quiet work zones.',
        descVi:
          'Ngôi nhà hai tầng thiết kế tối giản kết hợp bê tông mộc, cầu thang gỗ tếch và giếng trời cây xanh. Tách biệt không gian tiếp khách và góc làm việc yên tĩnh cho kỳ lưu trú dài ngày.',
        houseRulesEn: [
          'Check-in from 15:00, check-out before 11:00',
          'Lock courtyard gate at night',
          'No smoking indoors',
        ],
        houseRulesVi: [
          'Nhận phòng từ 15:00, trả phòng trước 11:00',
          'Khóa cổng sân trước khi đi ngủ vào buổi tối',
          'Không hút thuốc trong nhà',
        ],
        hasDesk: true,
        workspaceNotesEn: 'Built-in teak study desk overlooking the internal palm courtyard.',
        workspaceNotesVi: 'Bàn làm việc gỗ tếch đóng âm tường nhìn ra giếng trời xanh mát.',
        checkinConditionsEn: 'In-person or digital gate check-in 15:00–21:00 (notify host in advance for later arrival).',
        checkinConditionsVi: 'Nhận phòng trực tiếp hoặc mã cổng từ 15:00–21:00 (vui lòng báo trước nếu đến muộn hơn).',
        lateCheckinAvailable: false,
        exactAddress: '118 Châu Thị Vĩnh Tế, Mỹ An, Ngũ Hành Sơn, Da Nang',
        checkinInstructionsEn: 'Host welcomes you or shares digital gate code 24 hours prior to check-in.',
        checkinInstructionsVi: 'Chủ nhà đón tiếp trực tiếp hoặc gửi mã cổng điện tử trước giờ nhận phòng 24 giờ.',
        amenities: ['wifi', 'dedicated_desk', 'kitchen', 'washer', 'air_conditioning', 'coffee_kettle', 'private_balcony'],
        photos: [
          {
            id: '55555555-5555-4555-8555-555555555505',
            path: '/images/stays/an-thuong-house-main.jpg',
            altEn: 'Double-height timber and concrete townhouse with indoor palm courtyard in Da Nang',
            altVi: 'Nhà phố hai tầng gỗ và bê tông với giếng trời cây xanh tại Đà Nẵng',
            isCover: true,
            isDraft: false,
            sortOrder: 0,
          },
        ],
      },
      {
        id: SEED_IDS.listings.camChauVilla,
        hostId: SEED_IDS.users.host2,
        areaId: SEED_IDS.areas.camChau,
        slug: 'cam-chau-ricefield-villa',
        status: 'published',
        propertyType: 'villa',
        maxGuests: 4,
        bedrooms: 2,
        beds: 2,
        bathrooms: 2.0,
        minNights: 2,
        maxNights: 45,
        baseRate: 2850000,
        cleaningFee: 400000,
        policy: 'moderate_5d',
        titleEn: 'Cẩm Châu Ricefield Courtyard Villa',
        titleVi: 'Biệt thự sân vườn Cẩm Châu hướng cánh đồng lúa',
        summaryEn: 'Restored timber-and-ochre garden villa facing open green rice paddies in Hoi An.',
        summaryVi: 'Biệt thự vườn tường vàng mái gỗ nhìn thẳng ra đồng lúa xanh thoáng đãng tại Hội An.',
        descEn:
          'Wake to open views over Cẩm Châu paddies with shaded verandas, full kitchen, and complimentary bicycles to cycle ten minutes into Hoi An Ancient Town or Cửa Đại beach.',
        descVi:
          'Thức dậy giữa khung cảnh đồng lúa Cẩm Châu bình yên với hàng hiên râm mát, bếp đầy đủ tiện nghi và xe đạp miễn phí để đạp 10 phút vào Phố cổ Hội An hoặc ra biển Cửa Đại.',
        houseRulesEn: [
          'Quiet countryside neighborhood after 22:00',
          'Please park bicycles inside the courtyard gate',
          'Check-in from 14:00, check-out before 11:00',
        ],
        houseRulesVi: [
          'Giữ không gian làng quê yên tĩnh sau 22:00',
          'Vui lòng dắt xe đạp vào trong cổng sân vào ban đêm',
          'Nhận phòng từ 14:00, trả phòng trước 11:00',
        ],
        hasDesk: true,
        workspaceNotesEn: 'Indoor air-conditioned timber study table plus shaded garden veranda table.',
        workspaceNotesVi: 'Bàn làm việc gỗ trong phòng điều hòa kèm bàn gỗ ngoài hiên vườn râm mát.',
        checkinConditionsEn: 'Caretaker check-in 14:00–20:00; self keybox provided for late arrivals after 20:00.',
        checkinConditionsVi: 'Quản gia đón nhận phòng 14:00–20:00; có hộp chìa khóa tự mở nếu đến sau 20:00.',
        lateCheckinAvailable: true,
        exactAddress: '64 Trần Nhân Tông Lane, Cẩm Châu Ward, Hoi An, Quảng Nam',
        checkinInstructionsEn: 'Caretaker welcomes arrivals until 20:00; late arrival keybox instructions shared after confirmation.',
        checkinInstructionsVi: 'Quản gia hỗ trợ đón đến 20:00; hướng dẫn hộp chìa khóa nhận phòng muộn gửi sau khi xác nhận.',
        amenities: ['wifi', 'dedicated_desk', 'kitchen', 'air_conditioning', 'coffee_kettle', 'private_balcony', 'bicycle'],
        photos: [
          {
            id: '55555555-5555-4555-8555-555555555506',
            path: '/images/stays/cam-chau-villa-main.jpg',
            altEn: 'Hoi An villa shaded timber veranda facing bright green rice paddies',
            altVi: 'Hàng hiên gỗ râm mát của biệt thự Hội An nhìn ra cánh đồng lúa xanh',
            isCover: true,
            isDraft: false,
            sortOrder: 0,
          },
          {
            id: '55555555-5555-4555-8555-555555555507',
            path: '/images/stays/cam-chau-villa-garden.jpg',
            altEn: 'Teak four-poster bedroom opening to lush tropical garden in Hoi An',
            altVi: 'Phòng ngủ gỗ tếch mở cửa ra khu vườn nhiệt đới xanh mát tại Hội An',
            isCover: false,
            isDraft: false,
            sortOrder: 1,
          },
        ],
      },
      {
        id: SEED_IDS.listings.thaoDienStudio,
        hostId: SEED_IDS.users.host2,
        areaId: SEED_IDS.areas.thaoDien,
        slug: 'thao-dien-botanical-studio',
        status: 'published',
        propertyType: 'studio',
        maxGuests: 2,
        bedrooms: 1,
        beds: 1,
        bathrooms: 1.0,
        minNights: 2,
        maxNights: 90,
        baseRate: 1350000,
        cleaningFee: 220000,
        policy: 'flexible_24h',
        titleEn: 'Thảo Điền Botanical Courtyard Studio',
        titleVi: 'Studio gác lửng sân vườn xanh Thảo Điền',
        summaryEn: 'High-ceiling mezzanine loft in Thảo Điền with walnut desk, kitchen, washer, and garden glass.',
        summaryVi: 'Studio gác lửng trần cao tại Thảo Điền có bàn làm việc gỗ óc chó, bếp, máy giặt và cửa kính hướng vườn.',
        descEn:
          'Calm limewashed loft hidden down a quiet Thảo Điền lane, eight minutes from An Phú Metro Station. Features a dedicated walnut study desk, full kitchenette, and private washer.',
        descVi:
          'Căn gác lửng tường vôi dịu mắt nằm trong hẻm yên tĩnh Thảo Điền, cách ga Metro An Phú 8 phút đi bộ. Trang bị bàn làm việc gỗ óc chó riêng, bếp nấu gọn gàng và máy giặt riêng.',
        houseRulesEn: [
          'No smoking inside the building',
          'Check-in from 14:00, check-out before 11:00',
          'Respect building quiet hours 22:00–07:00',
        ],
        houseRulesVi: [
          'Không hút thuốc trong tòa nhà',
          'Nhận phòng từ 14:00, trả phòng trước 11:00',
          'Giữ yên tĩnh chung trong khung giờ 22:00–07:00',
        ],
        hasDesk: true,
        workspaceNotesEn: 'Dedicated walnut desk with task lamp facing courtyard greenery.',
        workspaceNotesVi: 'Bàn làm việc gỗ óc chó kèm đèn bàn nhìn ra khoảng sân cây xanh.',
        checkinConditionsEn: '24/7 keypad smart-lock check-in from 14:00; flexible late arrivals.',
        checkinConditionsVi: 'Khóa thông minh nhận phòng tự động 24/7 từ 14:00; linh hoạt nhận phòng muộn.',
        lateCheckinAvailable: true,
        exactAddress: '27 Quốc Hương Alley 14, Thảo Điền Ward, Thủ Đức City, Ho Chi Minh City',
        checkinInstructionsEn: 'Smart lock PIN instructions sent after host confirms booking.',
        checkinInstructionsVi: 'Mã PIN khóa thông minh được gửi sau khi chủ nhà xác nhận đặt phòng.',
        amenities: ['wifi', 'dedicated_desk', 'kitchen', 'washer', 'air_conditioning', 'coffee_kettle'],
        photos: [
          {
            id: '55555555-5555-4555-8555-555555555508',
            path: '/images/stays/thao-dien-studio-main.jpg',
            altEn: 'Botanical studio loft with walnut study desk beside tall garden windows in Thao Dien',
            altVi: 'Studio gác lửng với bàn làm việc gỗ óc chó cạnh cửa sổ vườn cao ở Thảo Điền',
            isCover: true,
            isDraft: false,
            sortOrder: 0,
          },
        ],
      },
      {
        id: SEED_IDS.listings.tayHoPending,
        hostId: SEED_IDS.users.host1,
        areaId: SEED_IDS.areas.tayHo,
        slug: 'tay-ho-courtyard-homestay-pending',
        status: 'pending_review',
        propertyType: 'homestay',
        maxGuests: 2,
        bedrooms: 1,
        beds: 1,
        bathrooms: 1.0,
        minNights: 2,
        maxNights: 30,
        baseRate: 890000,
        cleaningFee: 150000,
        policy: 'flexible_24h',
        titleEn: 'Quảng An Quiet Courtyard Homestay',
        titleVi: 'Homestay sân vườn yên tĩnh Quảng An',
        summaryEn: 'Ground-floor garden room awaiting admin verification.',
        summaryVi: 'Phòng tầng trệt hướng vườn đang chờ quản trị viên duyệt công bố.',
        descEn: 'Submitted by host for verification in Phase 2 moderation workflow.',
        descVi: 'Chỗ ở mẫu do chủ nhà gửi kiểm duyệt trước khi công bố.',
        houseRulesEn: ['No smoking indoors'],
        houseRulesVi: ['Không hút thuốc trong nhà'],
        hasDesk: true,
        workspaceNotesEn: 'Compact desk beside garden window.',
        workspaceNotesVi: 'Bàn làm việc gọn cạnh cửa sổ vườn.',
        checkinConditionsEn: 'Standard check-in 14:00–21:00.',
        checkinConditionsVi: 'Nhận phòng tiêu chuẩn 14:00–21:00.',
        lateCheckinAvailable: false,
        exactAddress: '91 Tô Ngọc Vân, Quảng An, Tây Hồ, Hà Nội',
        checkinInstructionsEn: 'Ring bell at courtyard gate.',
        checkinInstructionsVi: 'Bấm chuông tại cổng sân vườn.',
        amenities: ['wifi', 'dedicated_desk', 'air_conditioning'],
        photos: [
          {
            id: '55555555-5555-4555-8555-555555555509',
            path: '/images/stays/tay-ho-studio-main.jpg',
            altEn: 'Quang An garden homestay preview photo',
            altVi: 'Ảnh xem trước homestay sân vườn Quảng An',
            isCover: true,
            isDraft: true,
            sortOrder: 0,
          },
        ],
      },
      {
        id: SEED_IDS.listings.camChauDraft,
        hostId: SEED_IDS.users.host2,
        areaId: SEED_IDS.areas.camChau,
        slug: 'cam-chau-bamboo-draft',
        status: 'draft',
        propertyType: 'studio',
        maxGuests: 2,
        bedrooms: 1,
        beds: 1,
        bathrooms: 1.0,
        minNights: 1,
        maxNights: 30,
        baseRate: 920000,
        cleaningFee: 150000,
        policy: 'flexible_24h',
        titleEn: 'Cẩm Châu Bamboo Studio Draft',
        titleVi: 'Bản nháp Studio Tre Cẩm Châu',
        summaryEn: 'Draft stay with no photos uploaded yet.',
        summaryVi: 'Bản nháp chỗ ở chưa tải ảnh.',
        descEn: 'Draft listing created to test photo fallback and cross-host ownership checks.',
        descVi: 'Bản nháp tạo sẵn để kiểm tra phân quyền chủ sở hữu và hiển thị khi chưa có ảnh.',
        houseRulesEn: ['Check-in after 14:00'],
        houseRulesVi: ['Nhận phòng sau 14:00'],
        hasDesk: false,
        workspaceNotesEn: null,
        workspaceNotesVi: null,
        checkinConditionsEn: 'Check-in after 14:00.',
        checkinConditionsVi: 'Nhận phòng sau 14:00.',
        lateCheckinAvailable: false,
        exactAddress: '12 Lê Thánh Tông, Cẩm Châu, Hội An',
        checkinInstructionsEn: 'Draft instructions not published.',
        checkinInstructionsVi: 'Hướng dẫn bản nháp chưa công bố.',
        amenities: ['wifi', 'air_conditioning'],
        photos: [],
      },
    ];

    for (const item of listings) {
      const isPublished = item.status === 'published';
      await tx.query(
        `INSERT INTO listings (
           id, host_id, area_id, slug, status, property_type,
           max_guests, bedrooms, beds, bathrooms, min_nights, max_nights,
           base_nightly_rate_vnd, cleaning_fee_vnd, currency, cancellation_policy_version,
           published_title_en, published_title_vi,
           published_summary_en, published_summary_vi,
           published_description_en, published_description_vi,
           published_house_rules_en, published_house_rules_vi,
           published_has_dedicated_desk,
           published_workspace_notes_en, published_workspace_notes_vi,
           published_checkin_conditions_en, published_checkin_conditions_vi,
           published_late_checkin_available,
           exact_address, checkin_instructions_en, checkin_instructions_vi, is_demo
         )
         VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12,
           $13, $14, 'VND', $15,
           $16, $17,
           $18, $19,
           $20, $21,
           $22::jsonb, $23::jsonb,
           $24,
           $25, $26,
           $27, $28,
           $29,
           $30, $31, $32, TRUE
         )
         ON CONFLICT (id) DO UPDATE
         SET status = EXCLUDED.status,
             base_nightly_rate_vnd = EXCLUDED.base_nightly_rate_vnd,
             cleaning_fee_vnd = EXCLUDED.cleaning_fee_vnd,
             published_title_en = EXCLUDED.published_title_en,
             published_title_vi = EXCLUDED.published_title_vi,
             published_summary_en = EXCLUDED.published_summary_en,
             published_summary_vi = EXCLUDED.published_summary_vi,
             published_description_en = EXCLUDED.published_description_en,
             published_description_vi = EXCLUDED.published_description_vi,
             published_house_rules_en = EXCLUDED.published_house_rules_en,
             published_house_rules_vi = EXCLUDED.published_house_rules_vi,
             published_has_dedicated_desk = EXCLUDED.published_has_dedicated_desk,
             published_workspace_notes_en = EXCLUDED.published_workspace_notes_en,
             published_workspace_notes_vi = EXCLUDED.published_workspace_notes_vi,
             published_checkin_conditions_en = EXCLUDED.published_checkin_conditions_en,
             published_checkin_conditions_vi = EXCLUDED.published_checkin_conditions_vi,
             published_late_checkin_available = EXCLUDED.published_late_checkin_available,
             exact_address = EXCLUDED.exact_address,
             checkin_instructions_en = EXCLUDED.checkin_instructions_en,
             checkin_instructions_vi = EXCLUDED.checkin_instructions_vi,
             is_demo = TRUE`,
        [
          item.id,
          item.hostId,
          item.areaId,
          item.slug,
          item.status,
          item.propertyType,
          item.maxGuests,
          item.bedrooms,
          item.beds,
          item.bathrooms,
          item.minNights,
          item.maxNights,
          item.baseRate,
          item.cleaningFee,
          item.policy,
          isPublished ? item.titleEn : null,
          isPublished ? item.titleVi : null,
          isPublished ? item.summaryEn : null,
          isPublished ? item.summaryVi : null,
          isPublished ? item.descEn : null,
          isPublished ? item.descVi : null,
          JSON.stringify(item.houseRulesEn),
          JSON.stringify(item.houseRulesVi),
          isPublished ? item.hasDesk : false,
          isPublished ? item.workspaceNotesEn : null,
          isPublished ? item.workspaceNotesVi : null,
          isPublished ? item.checkinConditionsEn : '',
          isPublished ? item.checkinConditionsVi : '',
          isPublished ? item.lateCheckinAvailable : false,
          item.exactAddress,
          item.checkinInstructionsEn,
          item.checkinInstructionsVi,
        ]
      );

      const revStatus =
        item.status === 'published'
          ? 'approved'
          : item.status === 'pending_review'
            ? 'pending_review'
            : 'draft';

      await tx.query(
        `INSERT INTO listing_revisions (
           listing_id, revision_number, status,
           title_en, title_vi, summary_en, summary_vi, description_en, description_vi,
           house_rules_en, house_rules_vi, has_dedicated_desk,
           workspace_notes_en, workspace_notes_vi,
           checkin_conditions_en, checkin_conditions_vi, late_checkin_available,
           exact_address, checkin_instructions_en, checkin_instructions_vi
         )
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         ON CONFLICT (listing_id, revision_number) DO UPDATE
         SET status = EXCLUDED.status,
             title_en = EXCLUDED.title_en,
             title_vi = EXCLUDED.title_vi,
             summary_en = EXCLUDED.summary_en,
             summary_vi = EXCLUDED.summary_vi,
             description_en = EXCLUDED.description_en,
             description_vi = EXCLUDED.description_vi,
             house_rules_en = EXCLUDED.house_rules_en,
             house_rules_vi = EXCLUDED.house_rules_vi,
             workspace_notes_en = EXCLUDED.workspace_notes_en,
             workspace_notes_vi = EXCLUDED.workspace_notes_vi,
             checkin_conditions_en = EXCLUDED.checkin_conditions_en,
             checkin_conditions_vi = EXCLUDED.checkin_conditions_vi,
             late_checkin_available = EXCLUDED.late_checkin_available,
             checkin_instructions_en = EXCLUDED.checkin_instructions_en,
             checkin_instructions_vi = EXCLUDED.checkin_instructions_vi`,
        [
          item.id,
          revStatus,
          item.titleEn,
          item.titleVi,
          item.summaryEn,
          item.summaryVi,
          item.descEn,
          item.descVi,
          JSON.stringify(item.houseRulesEn),
          JSON.stringify(item.houseRulesVi),
          item.hasDesk,
          item.workspaceNotesEn,
          item.workspaceNotesVi,
          item.checkinConditionsEn,
          item.checkinConditionsVi,
          item.lateCheckinAvailable,
          item.exactAddress,
          item.checkinInstructionsEn,
          item.checkinInstructionsVi,
        ]
      );

      await tx.query(`DELETE FROM listing_amenities WHERE listing_id = $1`, [item.id]);
      for (const amenityCode of item.amenities) {
        await tx.query(
          `INSERT INTO listing_amenities (listing_id, amenity_code) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [item.id, amenityCode]
        );
      }

      for (const photo of item.photos) {
        await tx.query(
          `INSERT INTO listing_photos (
             id, listing_id, storage_path, public_url, alt_text_en, alt_text_vi, sort_order, is_cover, is_draft
           )
           VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE
           SET storage_path = EXCLUDED.storage_path,
               public_url = EXCLUDED.public_url,
               alt_text_en = EXCLUDED.alt_text_en,
               alt_text_vi = EXCLUDED.alt_text_vi,
               sort_order = EXCLUDED.sort_order,
               is_cover = EXCLUDED.is_cover,
               is_draft = EXCLUDED.is_draft`,
          [photo.id, item.id, photo.path, photo.altEn, photo.altVi, photo.sortOrder, photo.isCover, photo.isDraft]
        );
      }
    }

    // Clean legacy amenity code if upgrading from pre-0003 DB
    await tx.query(`DELETE FROM amenities WHERE code = 'wifi_fiber'`);

    // 6. Nightly Rate Overrides
    const overrideDay1 = addDaysIso(todayVn, 5);
    const overrideDay2 = addDaysIso(todayVn, 6);
    for (const d of [overrideDay1, overrideDay2]) {
      await tx.query(
        `INSERT INTO nightly_rates (listing_id, night_date, nightly_rate_vnd, updated_by)
         VALUES ($1, $2::date, 1750000, $3)
         ON CONFLICT (listing_id, night_date) DO UPDATE
         SET nightly_rate_vnd = EXCLUDED.nightly_rate_vnd`,
        [SEED_IDS.listings.tayHoLoft, d, SEED_IDS.users.host1]
      );
    }

    // 7. Host calendar block + Sample bookings
    const blockDay1 = addDaysIso(todayVn, 20);
    const blockDay2 = addDaysIso(todayVn, 21);
    for (const d of [blockDay1, blockDay2]) {
      await tx.query(
        `INSERT INTO occupancy_nights (listing_id, night_date, source_type, booking_id, block_reason, created_by)
         VALUES ($1, $2::date, 'host_block', NULL, 'Bảo trì hệ thống điều hòa', $3)
         ON CONFLICT (listing_id, night_date) DO NOTHING`,
        [SEED_IDS.listings.tayHoLoft, d, SEED_IDS.users.host1]
      );
    }

    const confCheckIn = addDaysIso(todayVn, 10);
    const confCheckOut = addDaysIso(todayVn, 13);
    const confNights = [
      { date: addDaysIso(todayVn, 10), rateVnd: 1250000, isOverride: false },
      { date: addDaysIso(todayVn, 11), rateVnd: 1250000, isOverride: false },
      { date: addDaysIso(todayVn, 12), rateVnd: 1250000, isOverride: false },
    ];
    const confHash = computeQuoteHash({
      listingId: SEED_IDS.listings.anThuongApt,
      checkIn: confCheckIn,
      checkOut: confCheckOut,
      nightlyBreakdown: confNights,
      cleaningFeeVnd: 200000,
      totalVnd: 3950000,
      cancellationPolicyVersion: 'flexible_24h',
      paymentTerms: 'Pay the host directly',
    });

    await tx.query(
      `INSERT INTO bookings (
         id, booking_code, listing_id, guest_id, check_in, check_out, guests_count,
         status, expires_at, idempotency_key, request_payload_hash, quote_hash,
         currency, nightly_breakdown, accommodation_subtotal_vnd, cleaning_fee_vnd, total_vnd,
         payment_terms, payment_terms_details_en, cancellation_policy_version,
         cancellation_policy_snapshot, host_timezone, guest_note, confirmed_at
       )
       VALUES (
         $1, 'WH-DEMO-1001', $2, $3, $4::date, $5::date, 1,
         'confirmed', NOW() + INTERVAL '24 hours', 'seed-confirmed-1001', 'seed-hash-1', $6,
         'VND', $7::jsonb, 3750000, 200000, 3950000,
         'Pay the host directly',
         'Pay the host directly upon check-in or via bank transfer as agreed before arrival.',
         'flexible_24h',
         $8::jsonb,
         'Asia/Ho_Chi_Minh',
         'Looking forward to a two-week work stay near My Khe beach.',
         NOW()
       )
       ON CONFLICT (id) DO UPDATE SET booking_code = EXCLUDED.booking_code`,
      [
        SEED_IDS.bookings.confirmedSample,
        SEED_IDS.listings.anThuongApt,
        SEED_IDS.users.guest,
        confCheckIn,
        confCheckOut,
        confHash,
        JSON.stringify(confNights),
        JSON.stringify(CANCELLATION_POLICIES.flexible_24h),
      ]
    );

    for (const night of confNights) {
      await tx.query(
        `INSERT INTO occupancy_nights (listing_id, night_date, source_type, booking_id, created_by)
         VALUES ($1, $2::date, 'booking', $3, $4)
         ON CONFLICT (listing_id, night_date) DO NOTHING`,
        [SEED_IDS.listings.anThuongApt, night.date, SEED_IDS.bookings.confirmedSample, SEED_IDS.users.host1]
      );
    }

    const pendCheckIn = addDaysIso(todayVn, 14);
    const pendCheckOut = addDaysIso(todayVn, 16);
    const pendNights = [
      { date: addDaysIso(todayVn, 14), rateVnd: 980000, isOverride: false },
      { date: addDaysIso(todayVn, 15), rateVnd: 980000, isOverride: false },
    ];
    const pendHash = computeQuoteHash({
      listingId: SEED_IDS.listings.tayHoStudio,
      checkIn: pendCheckIn,
      checkOut: pendCheckOut,
      nightlyBreakdown: pendNights,
      cleaningFeeVnd: 180000,
      totalVnd: 2140000,
      cancellationPolicyVersion: 'flexible_24h',
      paymentTerms: 'Pay the host directly',
    });

    await tx.query(
      `INSERT INTO bookings (
         id, booking_code, listing_id, guest_id, check_in, check_out, guests_count,
         status, expires_at, idempotency_key, request_payload_hash, quote_hash,
         currency, nightly_breakdown, accommodation_subtotal_vnd, cleaning_fee_vnd, total_vnd,
         payment_terms, payment_terms_details_en, cancellation_policy_version,
         cancellation_policy_snapshot, host_timezone, guest_note
       )
       VALUES (
         $1, 'WH-DEMO-1002', $2, $3, $4::date, $5::date, 1,
         'pending', NOW() + INTERVAL '24 hours', 'seed-pending-1002', 'seed-hash-2', $6,
         'VND', $7::jsonb, 1960000, 180000, 2140000,
         'Pay the host directly',
         'Pay the host directly upon check-in or via bank transfer as agreed before arrival.',
         'flexible_24h',
         $8::jsonb,
         'Asia/Ho_Chi_Minh',
         'Arriving late evening for a quiet work week in Hanoi.'
       )
       ON CONFLICT (id) DO UPDATE SET booking_code = EXCLUDED.booking_code`,
      [
        SEED_IDS.bookings.pendingSample,
        SEED_IDS.listings.tayHoStudio,
        SEED_IDS.users.guest,
        pendCheckIn,
        pendCheckOut,
        pendHash,
        JSON.stringify(pendNights),
        JSON.stringify(CANCELLATION_POLICIES.flexible_24h),
      ]
    );

    // 8. Phase 4 Local Places, Guides & Ordered Stops (bilingual EN/VI)
    const places = [
      {
        id: SEED_IDS.localPlaces.tayHoCowork,
        areaId: SEED_IDS.areas.tayHo,
        slug: 'quang-ba-lake-workroom',
        nameEn: 'Quảng Bá Lakefront Workroom',
        nameVi: 'Không gian làm việc ven hồ Quảng Bá',
        theme: 'coworking',
        descEn: 'Sunlit oak work tables facing West Lake with two soundproof call booths and pour-over coffee.',
        descVi: 'Bàn gỗ sồi thoáng sáng nhìn ra Hồ Tây với 2 buồng gọi video cách âm và cà phê pha thủ công.',
        imagePath: '/images/guides/tay-ho-cowork-cafe.jpg',
        costVnd: 120000,
        budgetTier: 'budget',
        durationMinutes: 120,
        solo: true,
        group: true,
        hasVideoCallBooths: true,
        bookingRequired: true,
        coworkNotesEn: '2 acoustic call booths included with day pass; book booth slots at reception or online.',
        coworkNotesVi: 'Vé ngày gồm 2 buồng gọi video cách âm; nên đặt lịch phòng gọi trước tại quầy hoặc trực tuyến.',
        dirEn: '8-minute walk along Quảng Khánh lakeside lane.',
        dirVi: 'Đi bộ 8 phút dọc đường ven hồ Quảng Khánh.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Quang+Ba+Tay+Ho+Hanoi',
        partnerUrl: 'https://workinghome.demo/partners/quang-ba-day-pass',
      },
      {
        id: SEED_IDS.localPlaces.tayHoFood,
        areaId: SEED_IDS.areas.tayHo,
        slug: 'xuan-dieu-evening-bun-thang',
        nameEn: 'Xuân Diệu Heritage Bún Thang & Bún Chả',
        nameVi: 'Quán Bún Thang & Bún Chả Xuân Diệu',
        theme: 'food',
        descEn: 'Quiet family-run Hanoi kitchen serving delicate shredded-chicken noodle soup and charcoal pork.',
        descVi: 'Quán ăn gia đình lâu năm phục vụ bún thang thanh nhẹ và bún chả nướng than hoa.',
        imagePath: '/images/guides/an-thuong-local-food.jpg',
        costVnd: 75000,
        budgetTier: 'budget',
        durationMinutes: 45,
        solo: true,
        group: true,
        hasVideoCallBooths: false,
        bookingRequired: false,
        coworkNotesEn: null,
        coworkNotesVi: null,
        dirEn: '5-minute walk north onto Xuân Diệu street.',
        dirVi: 'Đi bộ 5 phút ra mặt phố Xuân Diệu.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Xuan+Dieu+Tay+Ho+Hanoi',
        partnerUrl: null,
      },
      {
        id: SEED_IDS.localPlaces.tayHoWalk,
        areaId: SEED_IDS.areas.tayHo,
        slug: 'phu-tay-ho-peninsula-walk',
        nameEn: 'Phủ Tây Hồ Peninsula Lakeside Path',
        nameVi: 'Đường dạo bán đảo Phủ Tây Hồ',
        theme: 'culture',
        descEn: 'Breezy sunset walkway winding past banyan trees, lotus ponds, and the historic lakeside temple.',
        descVi: 'Lối dạo mát ven hồ lúc hoàng hôn qua rặng si cổ thụ, đầm sen và di tích Phủ Tây Hồ.',
        imagePath: '/images/guides/tay-ho-cowork-cafe.jpg',
        costVnd: 0,
        budgetTier: 'budget',
        durationMinutes: 50,
        solo: true,
        group: true,
        hasVideoCallBooths: false,
        bookingRequired: false,
        coworkNotesEn: null,
        coworkNotesVi: null,
        dirEn: '12-minute walk west toward the West Lake peninsula tip.',
        dirVi: 'Đi bộ 12 phút về phía mũi bán đảo Tây Hồ.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Phu+Tay+Ho+Hanoi',
        partnerUrl: null,
      },
      {
        id: SEED_IDS.localPlaces.anThuongMiQuang,
        areaId: SEED_IDS.areas.anThuong,
        slug: 'an-thuong-mi-quang-ba-vi',
        nameEn: 'Mì Quảng Bà Vị Corner Eatery',
        nameVi: 'Quán Mì Quảng Bà Vị An Thượng',
        theme: 'food',
        descEn: 'Turmeric rice noodles with prawn, slow-braised pork, herbs, and crispy sesame rice crackers.',
        descVi: 'Mì Quảng nghệ truyền thống ăn kèm tôm thịt rim, rau sống Trà Quế và bánh tráng mè.',
        imagePath: '/images/guides/an-thuong-local-food.jpg',
        costVnd: 55000,
        budgetTier: 'budget',
        durationMinutes: 40,
        solo: true,
        group: true,
        hasVideoCallBooths: false,
        bookingRequired: false,
        coworkNotesEn: null,
        coworkNotesVi: null,
        dirEn: '3-minute walk on An Thượng 4.',
        dirVi: 'Đi bộ 3 phút ngay trên phố An Thượng 4.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=An+Thuong+4+Da+Nang',
        partnerUrl: null,
      },
      {
        id: SEED_IDS.localPlaces.anThuongCowork,
        areaId: SEED_IDS.areas.anThuong,
        slug: 'my-an-surf-desk-hub',
        nameEn: 'Mỹ An Surf & Desk Hub',
        nameVi: 'Trung tâm làm việc Mỹ An Surf & Desk',
        theme: 'coworking',
        descEn: 'Ergonomic coastal coworking floor two blocks from Mỹ Khê Beach with private call pods.',
        descVi: 'Không gian coworking công thái học cách biển Mỹ Khê 2 dãy nhà, có buồng gọi riêng.',
        imagePath: '/images/guides/tay-ho-cowork-cafe.jpg',
        costVnd: 150000,
        budgetTier: 'moderate',
        durationMinutes: 180,
        solo: true,
        group: true,
        hasVideoCallBooths: true,
        bookingRequired: false,
        coworkNotesEn: '4 private Zoom booths on first-come basis; walk-in day pass available at desk.',
        coworkNotesVi: 'Có 4 buồng gọi Zoom riêng dùng tự do; mua vé ngày trực tiếp không cần đặt trước.',
        dirEn: '6-minute walk east toward Võ Nguyên Giáp avenue.',
        dirVi: 'Đi bộ 6 phút về phía đại lộ Võ Nguyên Giáp.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=My+An+Da+Nang',
        partnerUrl: 'https://workinghome.demo/partners/my-an-desk-pass',
      },
      {
        id: SEED_IDS.localPlaces.anThuongBeach,
        areaId: SEED_IDS.areas.anThuong,
        slug: 'my-khe-coastal-promenade',
        nameEn: 'Mỹ Khê Beach Evening Promenade',
        nameVi: 'Đường dạo biển Mỹ Khê buổi chiều',
        theme: 'leisure',
        descEn: 'Wide seaside footpath ideal for post-work walks, fresh coconut water, and ocean air.',
        descVi: 'Lối đi bộ ven biển rộng rãi, lý tưởng để đi dạo sau giờ làm và hóng gió biển.',
        imagePath: '/images/guides/an-thuong-local-food.jpg',
        costVnd: 30000,
        budgetTier: 'budget',
        durationMinutes: 50,
        solo: true,
        group: true,
        hasVideoCallBooths: false,
        bookingRequired: false,
        coworkNotesEn: null,
        coworkNotesVi: null,
        dirEn: '5-minute walk straight east to Mỹ Khê Beach.',
        dirVi: 'Đi bộ thẳng ra biển Mỹ Khê mất 5 phút.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=My+Khe+Beach+Da+Nang',
        partnerUrl: null,
      },
      {
        id: SEED_IDS.localPlaces.camChauLantern,
        areaId: SEED_IDS.areas.camChau,
        slug: 'thu-bon-riverside-lantern-lane',
        nameEn: 'Thu Bồn Riverside Lantern Lane',
        nameVi: 'Phố đèn lồng ven sông Thu Bồn',
        theme: 'culture',
        descEn: 'Calm twilight footpath lit by silk lanterns beside historic yellow walls and riverside boats.',
        descVi: 'Lối đi bộ yên bình bên bờ sông Thu Bồn rực sáng đèn lồng lụa lúc chạng vạng.',
        imagePath: '/images/guides/hoi-an-lantern-walk.jpg',
        costVnd: 0,
        budgetTier: 'budget',
        durationMinutes: 60,
        solo: true,
        group: true,
        hasVideoCallBooths: false,
        bookingRequired: false,
        coworkNotesEn: null,
        coworkNotesVi: null,
        dirEn: '7-minute bicycle ride west along Cửa Đại street.',
        dirVi: 'Đạp xe 7 phút theo đường Cửa Đại hướng phố cổ.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Thu+Bon+River+Hoi+An',
        partnerUrl: null,
      },
      {
        id: SEED_IDS.localPlaces.camChauCaoLau,
        areaId: SEED_IDS.areas.camChau,
        slug: 'cam-chau-garden-cao-lau',
        nameEn: 'Cẩm Châu Garden Cao Lầu Kitchen',
        nameVi: 'Bếp vườn Cao Lầu Cẩm Châu',
        theme: 'food',
        descEn: 'Shaded courtyard serving signature Hội An smoked pork Cao Lầu noodles and herbal tea.',
        descVi: 'Sân vườn thoáng mát phục vụ đặc sản Cao Lầu Hội An và trà thảo mộc địa phương.',
        imagePath: '/images/guides/an-thuong-local-food.jpg',
        costVnd: 70000,
        budgetTier: 'budget',
        durationMinutes: 45,
        solo: true,
        group: true,
        hasVideoCallBooths: false,
        bookingRequired: false,
        coworkNotesEn: null,
        coworkNotesVi: null,
        dirEn: '4-minute walk along Trần Nhân Tông.',
        dirVi: 'Đi bộ 4 phút dọc đường Trần Nhân Tông.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cam+Chau+Hoi+An',
        partnerUrl: null,
      },
      {
        id: SEED_IDS.localPlaces.camChauCycle,
        areaId: SEED_IDS.areas.camChau,
        slug: 'cam-thanh-rice-paddy-cycle',
        nameEn: 'Cẩm Thanh Rice Paddy & Coconut Loop',
        nameVi: 'Tuyến đạp xe đồng lúa & dừa nước Cẩm Thanh',
        theme: 'leisure',
        descEn: 'Flat paved village paths winding through emerald rice fields and water coconut groves.',
        descVi: 'Đường làng bằng phẳng uốn lượn qua cánh đồng lúa xanh và rừng dừa nước mát lành.',
        imagePath: '/images/guides/hoi-an-lantern-walk.jpg',
        costVnd: 180000,
        budgetTier: 'moderate',
        durationMinutes: 150,
        solo: true,
        group: true,
        hasVideoCallBooths: false,
        bookingRequired: true,
        coworkNotesEn: null,
        coworkNotesVi: null,
        dirEn: 'Starts 5 minutes east of Cẩm Châu village lanes.',
        dirVi: 'Xuất phát cách ngõ làng Cẩm Châu 5 phút đạp xe về hướng đông.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Cam+Thanh+Hoi+An',
        partnerUrl: 'https://workinghome.demo/partners/cam-chau-bike-tour',
      },
      {
        id: SEED_IDS.localPlaces.thaoDienRoastery,
        areaId: SEED_IDS.areas.thaoDien,
        slug: 'xuan-thuy-courtyard-roastery',
        nameEn: 'Xuân Thủy Courtyard Roastery & Study',
        nameVi: 'Xưởng rang & góc làm việc sân vườn Xuân Thủy',
        theme: 'coworking',
        descEn: 'Leafy tropical garden café with quiet indoor reading desks, power strips, and Vietnamese single-origin espresso.',
        descVi: 'Quán cà phê sân vườn nhiều cây xanh có phòng làm việc yên tĩnh, ổ cắm và espresso hạt Việt Nam.',
        imagePath: '/images/guides/thao-dien-espresso-studio.jpg',
        costVnd: 95000,
        budgetTier: 'budget',
        durationMinutes: 120,
        solo: true,
        group: true,
        hasVideoCallBooths: false,
        bookingRequired: false,
        coworkNotesEn: 'Quiet deep-work indoor wing; no dedicated call booth so best for async/focused tasks.',
        coworkNotesVi: 'Khu trong nhà yên tĩnh chuyên làm việc tập trung; chưa có buồng gọi riêng nên hợp việc không họp thoại.',
        dirEn: '4-minute walk down Xuân Thủy alley.',
        dirVi: 'Đi bộ 4 phút vào hẻm Xuân Thủy.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Xuan+Thuy+Thao+Dien+HCMC',
        partnerUrl: null,
      },
      {
        id: SEED_IDS.localPlaces.thaoDienRiverBistro,
        areaId: SEED_IDS.areas.thaoDien,
        slug: 'saigon-riverside-bistro',
        nameEn: 'Saigon Riverside Bistro & Terrace',
        nameVi: 'Nhà hàng sân hiên ven sông Sài Gòn',
        theme: 'food',
        descEn: 'Open-air riverfront dining with modern Vietnamese sharing plates for unhurried group dinners.',
        descVi: 'Không gian ngoài trời nhìn ra sông Sài Gòn với thực đơn món Việt hiện đại cho bữa tối nhóm.',
        imagePath: '/images/guides/thao-dien-espresso-studio.jpg',
        costVnd: 325000,
        budgetTier: 'splurge',
        durationMinutes: 120,
        solo: false,
        group: true,
        hasVideoCallBooths: false,
        bookingRequired: true,
        coworkNotesEn: null,
        coworkNotesVi: null,
        dirEn: '7-minute ride north toward Nguyễn Văn Hưởng riverside.',
        dirVi: 'Di chuyển 7 phút về phía bờ sông Nguyễn Văn Hưởng.',
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Nguyen+Van+Huong+Thao+Dien',
        partnerUrl: 'https://workinghome.demo/partners/saigon-river-table',
      },
    ];

    for (const p of places) {
      await tx.query(
        `INSERT INTO local_places (
           id, area_id, slug, name_en, name_vi, theme,
           short_description_en, short_description_vi, image_path,
           estimated_cost_vnd, budget_tier, duration_minutes,
           suitable_solo, suitable_group, coworking_notes_en, coworking_notes_vi,
           directions_note_en, directions_note_vi, has_video_call_booths, booking_required,
           maps_url, partner_booking_url, source, verified_at, is_published
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9,
           $10, $11, $12,
           $13, $14, $15, $16,
           $17, $18, $19, $20,
           $21, $22, 'WorkingHome Editorial Field Audit', NOW(), TRUE
         )
         ON CONFLICT (id) DO UPDATE SET
           name_en = EXCLUDED.name_en,
           name_vi = EXCLUDED.name_vi,
           short_description_en = EXCLUDED.short_description_en,
           short_description_vi = EXCLUDED.short_description_vi,
           image_path = EXCLUDED.image_path,
           estimated_cost_vnd = EXCLUDED.estimated_cost_vnd,
           budget_tier = EXCLUDED.budget_tier,
           duration_minutes = EXCLUDED.duration_minutes,
           suitable_solo = EXCLUDED.suitable_solo,
           suitable_group = EXCLUDED.suitable_group,
           coworking_notes_en = EXCLUDED.coworking_notes_en,
           coworking_notes_vi = EXCLUDED.coworking_notes_vi,
           directions_note_en = EXCLUDED.directions_note_en,
           directions_note_vi = EXCLUDED.directions_note_vi,
           has_video_call_booths = EXCLUDED.has_video_call_booths,
           booking_required = EXCLUDED.booking_required,
           maps_url = EXCLUDED.maps_url,
           partner_booking_url = EXCLUDED.partner_booking_url,
           is_published = EXCLUDED.is_published`,
        [
          p.id,
          p.areaId,
          p.slug,
          p.nameEn,
          p.nameVi,
          p.theme,
          p.descEn,
          p.descVi,
          p.imagePath,
          p.costVnd,
          p.budgetTier,
          p.durationMinutes,
          p.solo,
          p.group,
          p.coworkNotesEn,
          p.coworkNotesVi,
          p.dirEn,
          p.dirVi,
          p.hasVideoCallBooths,
          p.bookingRequired,
          p.mapsUrl,
          p.partnerUrl,
        ]
      );
    }

    const guides = [
      {
        id: SEED_IDS.localGuides.tayHoMorningWork,
        areaId: SEED_IDS.areas.tayHo,
        slug: 'tay-ho-focus-morning-and-lake-stroll',
        titleEn: 'Lakefront Focus Sprint & Sunset Peninsula Walk',
        titleVi: 'Buổi làm việc ven hồ & dạo bộ hoàng hôn bán đảo',
        summaryEn: 'Settle into a quiet West Lake coworking booth for calls, then unwind along the Phủ Tây Hồ peninsula path.',
        summaryVi: 'Làm việc tập trung và họp video tại buồng cách âm ven hồ, sau đó dạo bộ đón gió chiều quanh bán đảo Phủ Tây Hồ.',
        directionsEn: 'Walk 8 minutes down Quảng Khánh lakeside lane; finish with a flat 12-minute lakeside stroll.',
        directionsVi: 'Đi bộ 8 phút dọc ngõ ven hồ Quảng Khánh rồi tản bộ 12 phút ven bán đảo.',
        theme: 'coworking',
        durationBucket: '1_2_hours',
        budgetTier: 'budget',
        estimatedTotalVnd: 120000,
        solo: true,
        group: true,
        coverImagePath: '/images/guides/tay-ho-cowork-cafe.jpg',
        isPublished: true,
        stops: [
          {
            order: 1,
            placeId: SEED_IDS.localPlaces.tayHoCowork,
            recEn: 'Order a pour-over coffee and reserve a soundproof booth for afternoon standups.',
            recVi: 'Gọi một ly pour-over và đặt trước buồng cách âm cho buổi họp chiều.',
            notesEn: 'Quiet hours before 11:00 AM; reliable AC and desk outlets.',
            notesVi: 'Rất yên tĩnh trước 11:00; điều hòa mát và đủ ổ cắm tại từng chỗ ngồi.',
          },
          {
            order: 2,
            placeId: SEED_IDS.localPlaces.tayHoWalk,
            recEn: 'Catch golden hour near the lakeside banyan trees.',
            recVi: 'Ngắm hoàng hôn dưới rặng si cổ thụ ven hồ.',
            notesEn: 'Flat pedestrian path; safe and breezy after 17:00.',
            notesVi: 'Đường đi bộ bằng phẳng, thoáng mát sau 17:00.',
          },
        ],
      },
      {
        id: SEED_IDS.localGuides.tayHoEveningFood,
        areaId: SEED_IDS.areas.tayHo,
        slug: 'tay-ho-after-work-noodles',
        titleEn: 'After-Work Bún Thang & Lakeside Twilight',
        titleVi: 'Bữa tối Bún Thang & dạo hồ sau giờ làm',
        summaryEn: 'An easy solo-friendly evening route pairing warm Hanoi noodle soup with an unhurried lake walk.',
        summaryVi: 'Lịch trình nhẹ nhàng phù hợp đi một mình: thưởng thức bún thang nóng hổi rồi tản bộ ven Hồ Tây.',
        directionsEn: '5 minutes on foot to Xuân Diệu street, returning via Quảng Khánh water edge.',
        directionsVi: 'Đi bộ 5 phút ra phố Xuân Diệu và vòng về theo đường ven hồ Quảng Khánh.',
        theme: 'food',
        durationBucket: '1_2_hours',
        budgetTier: 'budget',
        estimatedTotalVnd: 95000,
        solo: true,
        group: true,
        coverImagePath: '/images/guides/an-thuong-local-food.jpg',
        isPublished: true,
        stops: [
          {
            order: 1,
            placeId: SEED_IDS.localPlaces.tayHoFood,
            recEn: 'Try the signature Bún Thang with pickled radish and jasmine iced tea.',
            recVi: 'Thử tô Bún Thang truyền thống kèm củ cải dầm và trà đá.',
            notesEn: 'Cash or VietQR accepted; quick counter service for solo diners.',
            notesVi: 'Nhận tiền mặt hoặc chuyển khoản VietQR; phục vụ nhanh gọn cho khách đi một mình.',
          },
          {
            order: 2,
            placeId: SEED_IDS.localPlaces.tayHoWalk,
            recEn: '20-minute digestif walk along the lakeside promenade.',
            recVi: 'Đi dạo tiêu cơm 20 phút dọc đường ven hồ.',
            notesEn: 'Well-lit evening walkway.',
            notesVi: 'Đường dạo có đèn sáng an toàn buổi tối.',
          },
        ],
      },
      {
        id: SEED_IDS.localGuides.tayHoDraftHidden,
        areaId: SEED_IDS.areas.tayHo,
        slug: 'tay-ho-unpublished-draft-guide',
        titleEn: 'Unpublished Draft Pottery Walk',
        titleVi: 'Bản nháp chưa công bố Tây Hồ',
        summaryEn: 'Internal admin draft not yet verified for publication.',
        summaryVi: 'Bản nháp nội bộ chưa được kiểm chứng để công bố.',
        directionsEn: 'Draft route pending verification.',
        directionsVi: 'Đang chờ xác minh tuyến đường.',
        theme: 'culture',
        durationBucket: 'half_day',
        budgetTier: 'moderate',
        estimatedTotalVnd: 250000,
        solo: true,
        group: true,
        coverImagePath: null,
        isPublished: false,
        stops: [
          {
            order: 1,
            placeId: SEED_IDS.localPlaces.tayHoWalk,
            recEn: 'Draft stop',
            recVi: 'Điểm dừng nháp',
            notesEn: 'Internal draft',
            notesVi: 'Nháp nội bộ',
          },
        ],
      },
      {
        id: SEED_IDS.localGuides.anThuongFoodStroll,
        areaId: SEED_IDS.areas.anThuong,
        slug: 'an-thuong-mi-quang-and-my-khe-walk',
        titleEn: 'Local Mì Quảng & Mỹ Khê Sunset Stroll',
        titleVi: 'Mì Quảng địa phương & dạo biển Mỹ Khê hoàng hôn',
        summaryEn: 'Taste authentic Da Nang turmeric noodles around the corner, then walk straight to Mỹ Khê Beach.',
        summaryVi: 'Thưởng thức tô Mì Quảng chuẩn vị Đà Nẵng ngay gần nhà rồi đi bộ ra bờ biển Mỹ Khê hóng gió.',
        directionsEn: 'All on foot within 500m of An Thượng 4.',
        directionsVi: 'Toàn bộ hành trình đi bộ trong bán kính 500m quanh phố An Thượng 4.',
        theme: 'food',
        durationBucket: '1_2_hours',
        budgetTier: 'budget',
        estimatedTotalVnd: 85000,
        solo: true,
        group: true,
        coverImagePath: '/images/guides/an-thuong-local-food.jpg',
        isPublished: true,
        stops: [
          {
            order: 1,
            placeId: SEED_IDS.localPlaces.anThuongMiQuang,
            recEn: 'Mì Quảng tôm thịt with sesame rice cracker and fresh chili-lime.',
            recVi: 'Mì Quảng tôm thịt ăn kèm bánh tráng mè nướng giòn và ớt chanh.',
            notesEn: 'Best before 19:30 when broth is freshest.',
            notesVi: 'Ngon nhất trước 19:30 khi nước dùng mới nấu.',
          },
          {
            order: 2,
            placeId: SEED_IDS.localPlaces.anThuongBeach,
            recEn: 'Grab a fresh coconut and walk the oceanfront promenade.',
            recVi: 'Mua dừa tươi và đi dạo dọc lối ven biển.',
            notesEn: 'Easy solo evening routine with ocean breeze.',
            notesVi: 'Thói quen buổi tối nhẹ nhàng, an toàn cho người đi một mình.',
          },
        ],
      },
      {
        id: SEED_IDS.localGuides.anThuongWorkDay,
        areaId: SEED_IDS.areas.anThuong,
        slug: 'an-thuong-half-day-cowork-and-lunch',
        titleEn: 'Coastal Deep-Work Half Day & Noodle Lunch',
        titleVi: 'Nửa ngày làm việc tại hub Mỹ An & ăn trưa Mì Quảng',
        summaryEn: 'Combine a productive call-ready coworking session near the beach with a quick neighborhood lunch.',
        summaryVi: 'Kết hợp nửa ngày làm việc tập trung với buồng gọi riêng gần biển và bữa trưa Mì Quảng địa phương.',
        directionsEn: '6-minute walk east to the coworking hub, then 5 minutes back to An Thượng 4.',
        directionsVi: 'Đi bộ 6 phút tới khu coworking rồi quay lại ăn trưa tại An Thượng 4.',
        theme: 'coworking',
        durationBucket: 'half_day',
        budgetTier: 'moderate',
        estimatedTotalVnd: 205000,
        solo: true,
        group: true,
        coverImagePath: '/images/guides/tay-ho-cowork-cafe.jpg',
        isPublished: true,
        stops: [
          {
            order: 1,
            placeId: SEED_IDS.localPlaces.anThuongCowork,
            recEn: 'Use a private Zoom pod for client calls and take lunch break at 12:30.',
            recVi: 'Dùng buồng Zoom riêng cho cuộc họp khách hàng rồi nghỉ trưa lúc 12:30.',
            notesEn: 'Day pass includes filter coffee and monitor loan on request.',
            notesVi: 'Vé ngày gồm cà phê phin và có thể mượn màn hình phụ.',
          },
          {
            order: 2,
            placeId: SEED_IDS.localPlaces.anThuongMiQuang,
            recEn: 'Quick local noodle bowl before returning home.',
            recVi: 'Thưởng thức tô Mì Quảng nhanh gọn trước khi về căn hộ.',
            notesEn: 'Open through midday.',
            notesVi: 'Mở cửa xuyên trưa.',
          },
        ],
      },
      {
        id: SEED_IDS.localGuides.camChauLanternEvening,
        areaId: SEED_IDS.areas.camChau,
        slug: 'cam-chau-lantern-evening-route',
        titleEn: 'Cẩm Châu Cao Lầu & Riverside Lantern Evening',
        titleVi: 'Thưởng thức Cao Lầu & dạo phố đèn lồng bên sông Thu Bồn',
        summaryEn: 'Dine in a quiet Cẩm Châu garden before strolling along the lantern-lit Thu Bồn riverfront at dusk.',
        summaryVi: 'Dùng bữa tối tại bếp vườn Cẩm Châu yên tĩnh rồi đạp xe/đi bộ ngắm phố đèn lồng ven sông Thu Bồn.',
        directionsEn: '7-minute flat bike ride along Cửa Đại avenue toward the old riverside quarter.',
        directionsVi: 'Đạp xe 7 phút đường bằng dọc phố Cửa Đại về hướng bờ sông cổ.',
        theme: 'culture',
        durationBucket: '1_2_hours',
        budgetTier: 'budget',
        estimatedTotalVnd: 70000,
        solo: true,
        group: true,
        coverImagePath: '/images/guides/hoi-an-lantern-walk.jpg',
        isPublished: true,
        stops: [
          {
            order: 1,
            placeId: SEED_IDS.localPlaces.camChauCaoLau,
            recEn: 'Order traditional Cao Lầu noodles with crispy wontons and herbal lime tea.',
            recVi: 'Gọi Cao Lầu Hội An, hoành thánh chiên giòn và nước mót thảo mộc.',
            notesEn: 'Peaceful courtyard tables welcoming solo travelers.',
            notesVi: 'Không gian sân vườn yên tĩnh, rất thân thiện với khách đi một mình.',
          },
          {
            order: 2,
            placeId: SEED_IDS.localPlaces.camChauLantern,
            recEn: 'Walk past the yellow historic shophouses after 18:00 when lanterns glow.',
            recVi: 'Dạo bộ qua dãy nhà cổ tường vàng sau 18:00 khi đèn lồng lên đèn.',
            notesEn: 'Quieter riverside section east of the main tourist bridge.',
            notesVi: 'Đoạn ven sông phía đông vắng và bình yên hơn khu cầu chính.',
          },
        ],
      },
      {
        id: SEED_IDS.localGuides.camChauHalfDayCycle,
        areaId: SEED_IDS.areas.camChau,
        slug: 'cam-chau-rice-paddy-weekend-cycle',
        titleEn: 'Weekend Rice Paddy Bike Loop & Garden Lunch',
        titleVi: 'Đạp xe cuối tuần qua đồng lúa Cẩm Thanh & ăn trưa vườn',
        summaryEn: 'A breezy half-day bicycle loop through green rice paddies and coconut groves with a partner-guided option.',
        summaryVi: 'Hành trình đạp xe nửa ngày qua cánh đồng lúa và rặng dừa nước, kèm lựa chọn đặt tour đối tác địa phương.',
        directionsEn: 'Starts right from Cẩm Châu lanes on quiet paved village paths.',
        directionsVi: 'Xuất phát thẳng từ ngõ Cẩm Châu theo các tuyến đường làng ít xe.',
        theme: 'leisure',
        durationBucket: 'half_day',
        budgetTier: 'moderate',
        estimatedTotalVnd: 250000,
        solo: true,
        group: true,
        coverImagePath: '/images/guides/hoi-an-lantern-walk.jpg',
        isPublished: true,
        stops: [
          {
            order: 1,
            placeId: SEED_IDS.localPlaces.camChauCycle,
            recEn: 'Ride early (07:00–09:30) for cool shade and golden morning light over the paddies.',
            recVi: 'Đạp xe sớm (07:00–09:30) để tận hưởng nắng nhẹ và không khí đồng quê mát mẻ.',
            notesEn: 'Free bicycles included at most Cẩm Châu villas; guided option available via partner link.',
            notesVi: 'Hầu hết villa ở Cẩm Châu có sẵn xe đạp miễn phí; có thể đặt tour qua liên kết đối tác.',
          },
          {
            order: 2,
            placeId: SEED_IDS.localPlaces.camChauCaoLau,
            recEn: 'Refuel with Cao Lầu and iced coffee in the shaded garden.',
            recVi: 'Nghỉ chân ăn Cao Lầu và uống cà phê sữa đá dưới tán cây.',
            notesEn: 'Bicycle parking right inside the courtyard.',
            notesVi: 'Có chỗ để xe đạp an toàn ngay trong sân.',
          },
        ],
      },
      {
        id: SEED_IDS.localGuides.thaoDienDeepWork,
        areaId: SEED_IDS.areas.thaoDien,
        slug: 'thao-dien-garden-espresso-deep-work',
        titleEn: 'Xuân Thủy Courtyard Espresso & Deep-Work Morning',
        titleVi: 'Cà phê sân vườn Xuân Thủy & buổi sáng làm việc tập trung',
        summaryEn: 'A calm tropical courtyard café built for uninterrupted writing, coding, and asynchronous work blocks.',
        summaryVi: 'Quán cà phê sân vườn rợp bóng cây lý tưởng cho phiên làm việc sâu không bị làm phiền.',
        directionsEn: '4-minute walk off Xuân Thủy main street.',
        directionsVi: 'Đi bộ 4 phút vào hẻm yên tĩnh cạnh đường Xuân Thủy.',
        theme: 'coworking',
        durationBucket: '1_2_hours',
        budgetTier: 'budget',
        estimatedTotalVnd: 95000,
        solo: true,
        group: true,
        coverImagePath: '/images/guides/thao-dien-espresso-studio.jpg',
        isPublished: true,
        stops: [
          {
            order: 1,
            placeId: SEED_IDS.localPlaces.thaoDienRoastery,
            recEn: 'Single-origin Đà Lạt pour-over and indoor quiet desk seating.',
            recVi: 'Cà phê pour-over hạt Đà Lạt và khu bàn làm việc yên tĩnh trong nhà.',
            notesEn: 'No private call booths; ideal for focused solo work blocks.',
            notesVi: 'Không có buồng gọi riêng; phù hợp nhất cho làm việc độc lập tập trung.',
          },
        ],
      },
      {
        id: SEED_IDS.localGuides.thaoDienGroupDinner,
        areaId: SEED_IDS.areas.thaoDien,
        slug: 'thao-dien-riverside-group-evening',
        titleEn: 'Thảo Điền Garden Aperitif & Riverside Group Dinner',
        titleVi: 'Cà phê chiều & bữa tối ven sông Sài Gòn cho nhóm',
        summaryEn: 'An unhurried half-day social itinerary combining garden coffee and riverfront dining for small groups.',
        summaryVi: 'Hành trình nửa ngày thư thái dành cho nhóm bạn: cà phê sân vườn và dùng bữa tối ven sông Sài Gòn.',
        directionsEn: 'Starts near Xuân Thủy alley, then a short 7-minute Grab ride north to the riverfront.',
        directionsVi: 'Bắt đầu tại khu Xuân Thủy rồi đi xe 7 phút ra bờ sông Nguyễn Văn Hưởng.',
        theme: 'food',
        durationBucket: 'half_day',
        budgetTier: 'splurge',
        estimatedTotalVnd: 420000,
        solo: false,
        group: true,
        coverImagePath: '/images/guides/thao-dien-espresso-studio.jpg',
        isPublished: true,
        stops: [
          {
            order: 1,
            placeId: SEED_IDS.localPlaces.thaoDienRoastery,
            recEn: 'Late afternoon cold brew meetup in the garden courtyard.',
            recVi: 'Gặp gỡ uống cold brew buổi chiều tại khoảng sân vườn.',
            notesEn: 'Large wooden tables seat 4–6 comfortably.',
            notesVi: 'Có bàn gỗ lớn đủ cho nhóm 4–6 người.',
          },
          {
            order: 2,
            placeId: SEED_IDS.localPlaces.thaoDienRiverBistro,
            recEn: 'Reserve a river terrace table for sunset sharing plates.',
            recVi: 'Đặt bàn sân hiên ven sông ngắm hoàng hôn.',
            notesEn: 'Reservation recommended on Friday and weekend evenings.',
            notesVi: 'Nên đặt bàn trước vào tối thứ Sáu và cuối tuần.',
          },
        ],
      },
    ];

    for (const g of guides) {
      await tx.query(
        `INSERT INTO local_guides (
           id, area_id, slug, title_en, title_vi, summary_en, summary_vi,
           directions_summary_en, directions_summary_vi,
           theme, duration_bucket, budget_tier, estimated_total_vnd,
           suitable_solo, suitable_group, cover_image_path,
           source, verified_at, is_published
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7,
           $8, $9,
           $10, $11, $12, $13,
           $14, $15, $16,
           'WorkingHome Local Curation Team', NOW(), $17
         )
         ON CONFLICT (id) DO UPDATE SET
           title_en = EXCLUDED.title_en,
           title_vi = EXCLUDED.title_vi,
           summary_en = EXCLUDED.summary_en,
           summary_vi = EXCLUDED.summary_vi,
           directions_summary_en = EXCLUDED.directions_summary_en,
           directions_summary_vi = EXCLUDED.directions_summary_vi,
           theme = EXCLUDED.theme,
           duration_bucket = EXCLUDED.duration_bucket,
           budget_tier = EXCLUDED.budget_tier,
           estimated_total_vnd = EXCLUDED.estimated_total_vnd,
           suitable_solo = EXCLUDED.suitable_solo,
           suitable_group = EXCLUDED.suitable_group,
           cover_image_path = EXCLUDED.cover_image_path,
           is_published = EXCLUDED.is_published`,
        [
          g.id,
          g.areaId,
          g.slug,
          g.titleEn,
          g.titleVi,
          g.summaryEn,
          g.summaryVi,
          g.directionsEn,
          g.directionsVi,
          g.theme,
          g.durationBucket,
          g.budgetTier,
          g.estimatedTotalVnd,
          g.solo,
          g.group,
          g.coverImagePath,
          g.isPublished,
        ]
      );

      for (const s of g.stops) {
        await tx.query(
          `INSERT INTO local_guide_stops (
             guide_id, place_id, stop_order,
             recommended_items_en, recommended_items_vi,
             local_notes_en, local_notes_vi
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (guide_id, stop_order) DO UPDATE SET
             place_id = EXCLUDED.place_id,
             recommended_items_en = EXCLUDED.recommended_items_en,
             recommended_items_vi = EXCLUDED.recommended_items_vi,
             local_notes_en = EXCLUDED.local_notes_en,
             local_notes_vi = EXCLUDED.local_notes_vi`,
          [g.id, s.placeId, s.order, s.recEn, s.recVi, s.notesEn, s.notesVi]
        );
      }
    }
  });
  markDbInitialized();
  });
}
