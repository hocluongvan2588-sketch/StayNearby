import { dbQuery } from './index';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import { seedSystemRoles } from '@/modules/admin-rbac';

export async function seedAdminBosFoundationData(params?: {
  primaryAdminId?: string;
  primaryHostId?: string;
  primaryGuestId?: string;
  primaryStayId?: string;
}) {
  const adminId = params?.primaryAdminId ?? null;
  const hostId = params?.primaryHostId ?? null;
  const guestId = params?.primaryGuestId ?? null;
  const stayId = params?.primaryStayId ?? null;
  const today = getTodayIsoVietnam();

  await seedSystemRoles();

  if (adminId) {
    await dbQuery(
      `INSERT INTO admin_staff_profiles (user_id, role_id, department, title, is_active, assigned_cities)
       VALUES ($1, 'a1000000-0000-4000-8000-000000000001', 'Executive', 'Founder & Super Admin', TRUE, '["da-nang","hanoi","ho-chi-minh-city","hoi-an","da-lat","phu-quoc"]'::jsonb)
       ON CONFLICT (user_id) DO NOTHING`,
      [adminId]
    );
  }

  // Platform settings (non-hardcoded fee rates & FX)
  const settings: Array<[string, unknown]> = [
    ['service_fee_rate', { value: 0.12 }],
    ['host_commission_rate', { value: 0 }],
    ['vat_discount_rate', { value: 0.05 }],
    ['premium_reward_rate', { value: 0.04 }],
    ['default_min_nights', { value: 7 }],
    ['fx_rates', { VND: 1, USD: 25400, EUR: 27400, GBP: 32000, SGD: 18900, AUD: 16500 }],
  ];
  for (const [k, v] of settings) {
    await dbQuery(
      `INSERT INTO platform_settings (key, value_json, updated_by)
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT (key) DO NOTHING`,
      [k, JSON.stringify(v), adminId]
    );
  }

  await dbQuery(
    `INSERT INTO fx_rate_history (id, currency_code, rate_to_vnd, source, created_by)
     VALUES
       ('b1000000-0000-4000-8000-000000000001', 'USD', 25400, 'system_seed', $1),
       ('b1000000-0000-4000-8000-000000000002', 'EUR', 27400, 'system_seed', $1),
       ('b1000000-0000-4000-8000-000000000003', 'GBP', 32000, 'system_seed', $1)
     ON CONFLICT (id) DO NOTHING`,
    [adminId]
  );

  // Neighborhoods across key Vietnam destinations
  const neighborhoods = [
    {
      id: 'b2000000-0000-4000-8000-000000000001',
      destId: '20000000-0000-4000-8000-000000000001',
      slug: 'an-thuong-my-khe',
      nameEn: 'An Thuong & My Khe',
      nameVi: 'An Thượng & Mỹ Khê',
      sumEn: 'Beachfront nomad hub with walkable specialty cafes, coworking and international eateries.',
      sumVi: 'Khu phố ven biển sôi động với cà phê đặc sản, coworking và nhà hàng quốc tế.',
      x: 62,
      y: 44,
    },
    {
      id: 'b2000000-0000-4000-8000-000000000002',
      destId: '20000000-0000-4000-8000-000000000002',
      slug: 'tay-ho-quang-an',
      nameEn: 'Tay Ho & Quang An',
      nameVi: 'Tây Hồ & Quảng An',
      sumEn: 'Lakeside diplomatic district with quiet leafy alleys, bakeries, and gyms.',
      sumVi: 'Khu vực ven hồ yên tĩnh với nhiều ngõ xanh, tiệm bánh và phòng gym.',
      x: 49,
      y: 16,
    },
    {
      id: 'b2000000-0000-4000-8000-000000000003',
      destId: '20000000-0000-4000-8000-000000000004',
      slug: 'thao-dien',
      nameEn: 'Thao Dien',
      nameVi: 'Thảo Điền',
      sumEn: 'Saigon startup and expat enclave along the river bend with coworking lounges.',
      sumVi: 'Cộng đồng startup & expat ven sông Sài Gòn với nhiều coworking hiện đại.',
      x: 56,
      y: 80,
    },
    {
      id: 'b2000000-0000-4000-8000-000000000004',
      destId: '20000000-0000-4000-8000-000000000003',
      slug: 'cam-chau',
      nameEn: 'Cam Chau & Rice Terraces',
      nameVi: 'Cẩm Châu & Làng Lúa',
      sumEn: 'Peaceful rice-paddy cycling lane connecting Ancient Town and An Bang Beach.',
      sumVi: 'Khu vực đồng lúa yên bình nằm giữa Phố Cổ Hội An và biển An Bàng.',
      x: 63,
      y: 47,
    },
    {
      id: 'b2000000-0000-4000-8000-000000000005',
      destId: '20000000-0000-4000-8000-000000000005',
      slug: 'xuan-huong-pine-hills',
      nameEn: 'Xuan Huong & Pine Hills',
      nameVi: 'Hồ Xuân Hương & Đồi Thông',
      sumEn: 'Cool highland center with heritage roasteries and misty walking trails.',
      sumVi: 'Trung tâm cao nguyên mát mẻ với các quán cà phê rang xay và đồi thông.',
      x: 58,
      y: 67,
    },
    {
      id: 'b2000000-0000-4000-8000-000000000006',
      destId: '20000000-0000-4000-8000-000000000006',
      slug: 'duong-dong-sunset-coast',
      nameEn: 'Duong Dong & Sunset Coast',
      nameVi: 'Dương Đông & Bờ Tây Hoàng Hôn',
      sumEn: 'Island beach strip with fresh seafood markets and calm ocean sunset cafés.',
      sumVi: 'Dải biển trung tâm đảo Ngọc gần chợ đêm, hải sản và quán cà phê ngắm hoàng hôn.',
      x: 34,
      y: 85,
    },
  ];
  for (const n of neighborhoods) {
    await dbQuery(
      `INSERT INTO neighborhoods (
        id, destination_id, slug, name_en, name_vi, summary_en, summary_vi, map_x, map_y
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO NOTHING`,
      [n.id, n.destId, n.slug, n.nameEn, n.nameVi, n.sumEn, n.sumVi, n.x, n.y]
    );
  }

  // Local Partners
  const partners = [
    {
      id: 'b3000000-0000-4000-8000-000000000001',
      name: 'Enouvo Space Da Nang',
      category: 'coworking',
      destId: '20000000-0000-4000-8000-000000000001',
      contactName: 'Lan Phuong Nguyen',
      contactEmail: 'partners@enouvospace.vn',
      contactPhone: '+84 905 881 220',
      status: 'active',
      contractRef: 'LP-DN-2026-01',
      perkOffer: '20% off monthly hot-desk & 2 free day passes for VietNomad guests',
      commissionTerms: '10% partner referral fee on monthly passes',
    },
    {
      id: 'b3000000-0000-4000-8000-000000000002',
      name: '43 Factory Coffee Roaster',
      category: 'cafe',
      destId: '20000000-0000-4000-8000-000000000001',
      contactName: 'Duc Minh Vo',
      contactEmail: 'hello@43factory.coffee',
      contactPhone: '+84 905 430 043',
      status: 'active',
      contractRef: 'LP-DN-2026-02',
      perkOffer: '10% off specialty pour-over for long-stay members',
      commissionTerms: 'Co-marketing collaboration',
    },
    {
      id: 'b3000000-0000-4000-8000-000000000003',
      name: 'The Hive Thao Dien',
      category: 'coworking',
      destId: '20000000-0000-4000-8000-000000000004',
      contactName: 'Anh Khoa Pham',
      contactEmail: 'thaodien@thehive.vn',
      contactPhone: '+84 28 3620 4560',
      status: 'active',
      contractRef: 'LP-SG-2026-01',
      perkOffer: '15% discount on dedicated desk & rooftop events access',
      commissionTerms: '12% commission on new member signups',
    },
    {
      id: 'b3000000-0000-4000-8000-000000000004',
      name: 'Zenith Yoga & Wellness Tay Ho',
      category: 'gym_yoga',
      destId: '20000000-0000-4000-8000-000000000002',
      contactName: 'Mai Linh Hoang',
      contactEmail: 'care@zenithyoga.vn',
      contactPhone: '+84 904 353 561',
      status: 'in_discussion',
      contractRef: 'LP-HN-2026-DRAFT',
      perkOffer: 'First trial week free + 15% off monthly unlimited pass',
      commissionTerms: 'Negotiating referral tier',
    },
  ];
  for (const p of partners) {
    await dbQuery(
      `INSERT INTO local_partners (
        id, business_name, category, destination_id, contact_name, contact_email, contact_phone,
        assigned_staff_id, partnership_status, contract_ref, perk_offer, commission_terms
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO NOTHING`,
      [
        p.id,
        p.name,
        p.category,
        p.destId,
        p.contactName,
        p.contactEmail,
        p.contactPhone,
        adminId,
        p.status,
        p.contractRef,
        p.perkOffer,
        p.commissionTerms,
      ]
    );
  }

  // Centralized Local Discovery Places (reusable across Destinations, Stay Detail, SEO)
  const places = [
    {
      id: 'b4000000-0000-4000-8000-000000000001',
      destId: '20000000-0000-4000-8000-000000000001',
      nbId: 'b2000000-0000-4000-8000-000000000001',
      partnerId: 'b3000000-0000-4000-8000-000000000001',
      cat: 'coworking',
      slug: 'enouvo-space-an-thuong-da-nang',
      name: 'Enouvo Space — An Thuong',
      address: '16–18 An Thuong 3, Ngu Hanh Son, Da Nang',
      lat: 16.0504,
      lng: 108.2468,
      imageUrl: '/images/workspaces/vietnam-coworking-lounge.jpg',
      descEn: 'Bright seaside coworking with 500 Mbps dual-ISP fiber, call booths, and community lunches.',
      descVi: 'Không gian coworking gần biển với đường truyền 500 Mbps, buồng gọi điện và cộng đồng sôi nổi.',
      price: '$$',
      hours: '07:30 - 21:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000002',
      destId: '20000000-0000-4000-8000-000000000001',
      nbId: 'b2000000-0000-4000-8000-000000000001',
      partnerId: 'b3000000-0000-4000-8000-000000000002',
      cat: 'cafe',
      slug: '43-factory-coffee-roaster-da-nang',
      name: '43 Factory Coffee Roaster',
      address: 'Lot 422 Ngo Thi Si, Ngu Hanh Son, Da Nang',
      lat: 16.0462,
      lng: 108.2448,
      imageUrl: '/images/places/cafe-roastery.jpg',
      descEn: 'Architectural specialty coffee house surrounded by koi ponds and natural daylight.',
      descVi: 'Quán cà phê đặc sản kiến trúc mở giữa hồ cá Koi, ánh sáng tự nhiên lý tưởng.',
      price: '$$',
      hours: '06:30 - 22:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000003',
      destId: '20000000-0000-4000-8000-000000000001',
      nbId: 'b2000000-0000-4000-8000-000000000001',
      partnerId: null,
      cat: 'restaurant',
      slug: 'nha-bep-xua-an-thuong-da-nang',
      name: 'Bep Que Central Kitchen',
      address: '29 Tran Bach Dang, Ngu Hanh Son, Da Nang',
      lat: 16.0518,
      lng: 108.2471,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Wholesome central Vietnamese home-cooked meals, fresh seafood, and clean vegetarian bowls.',
      descVi: 'Cơm nhà miền Trung thanh đạm, hải sản tươi mỗi ngày và thực đơn chay lành mạnh.',
      price: '$',
      hours: '10:00 - 22:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000004',
      destId: '20000000-0000-4000-8000-000000000001',
      nbId: 'b2000000-0000-4000-8000-000000000001',
      partnerId: null,
      cat: 'essential',
      slug: 'moonmilk-organic-mart-an-thuong',
      name: 'Moonmilk Market & Pharmacy Hub',
      address: '08 An Thuong 1, Ngu Hanh Son, Da Nang',
      lat: 16.0522,
      lng: 108.2462,
      imageUrl: '/images/places/market-essentials.jpg',
      descEn: 'Imported groceries, fresh organic produce, dairy, and next-door pharmacy.',
      descVi: 'Siêu thị thực phẩm nhập khẩu, rau sạch và nhà thuốc tiện lợi ngay trung tâm An Thượng.',
      price: '$$',
      hours: '07:00 - 22:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000005',
      destId: '20000000-0000-4000-8000-000000000002',
      nbId: 'b2000000-0000-4000-8000-000000000002',
      partnerId: 'b3000000-0000-4000-8000-000000000004',
      cat: 'gym_yoga',
      slug: 'zenith-yoga-tay-ho-hanoi',
      name: 'Zenith Yoga & Strength Studio',
      address: '247 Au Co, Quang An, Tay Ho, Hanoi',
      lat: 21.0691,
      lng: 105.8245,
      imageUrl: '/images/places/wellness-yoga.jpg',
      descEn: 'Peaceful yoga studio, aerial fitness, and functional training overlooking West Lake gardens.',
      descVi: 'Phòng tập Yoga và thể hình thoáng đãng ngay trục Âu Cơ, Quảng An, Tây Hồ.',
      price: '$$',
      hours: '06:00 - 21:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000006',
      destId: '20000000-0000-4000-8000-000000000004',
      nbId: 'b2000000-0000-4000-8000-000000000003',
      partnerId: 'b3000000-0000-4000-8000-000000000003',
      cat: 'coworking',
      slug: 'the-hive-thao-dien-saigon',
      name: 'The Hive Villa — Thao Dien',
      address: '29 Nguyen Ba Lan, Thao Dien, Thu Duc City, HCMC',
      lat: 10.8054,
      lng: 106.7324,
      imageUrl: '/images/workspaces/vietnam-coworking-lounge.jpg',
      descEn: 'Garden villa coworking campus with pool deck, studio podcast room, and founder mixers.',
      descVi: 'Coworking biệt thự sân vườn có hồ bơi, phòng thu podcast và cộng đồng founder.',
      price: '$$$',
      hours: '08:00 - 20:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000007',
      destId: '20000000-0000-4000-8000-000000000005',
      nbId: 'b2000000-0000-4000-8000-000000000005',
      partnerId: null,
      cat: 'cafe',
      slug: 'la-viet-coffee-da-lat',
      name: 'La Viet Coffee Roastery',
      address: '200 Nguyen Cong Tru, Ward 8, Da Lat',
      lat: 11.9541,
      lng: 108.4369,
      imageUrl: '/images/places/cafe-roastery.jpg',
      descEn: 'Iconic Da Lat Arabica roastery in a sunlit industrial hall with plenty of power outlets.',
      descVi: 'Xưởng rang xay Arabica nổi tiếng Đà Lạt, không gian rộng rãi nhiều ổ cắm làm việc.',
      price: '$',
      hours: '07:00 - 22:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000008',
      destId: '20000000-0000-4000-8000-000000000001',
      nbId: 'b2000000-0000-4000-8000-000000000001',
      partnerId: null,
      cat: 'attraction',
      slug: 'my-khe-beach-promenade-da-nang',
      name: 'My Khe Beach Promenade',
      address: 'Vo Nguyen Giap, Phuoc My, Son Tra, Da Nang',
      lat: 16.0598,
      lng: 108.2469,
      imageUrl: '/images/places/beach-attraction.jpg',
      descEn: 'Sweeping white-sand crescent ideal for sunrise swims, oceanfront walks, and paddleboarding.',
      descVi: 'Bãi biển cát trắng mịn lý tưởng để bơi sáng, chạy bộ dọc bờ biển và chèo SUP.',
      price: 'Free',
      hours: 'Open 24h',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000009',
      destId: '20000000-0000-4000-8000-000000000001',
      nbId: 'b2000000-0000-4000-8000-000000000001',
      partnerId: null,
      cat: 'shopping',
      slug: 'an-thuong-craft-ceramics',
      name: 'Non Nuoc Craft & Linen Studio',
      address: '44 Nguyen Van Thoai, Ngu Hanh Son, Da Nang',
      lat: 16.0531,
      lng: 108.2452,
      imageUrl: '/images/places/shopping-boutique.jpg',
      descEn: 'Locally thrown stoneware, coastal linen shirts, and handmade incense sourced from central artisans.',
      descVi: 'Gốm thủ công, áo linen thoáng mát và đồ mỹ nghệ của nghệ nhân miền Trung.',
      price: '$$',
      hours: '09:00 - 21:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000010',
      destId: '20000000-0000-4000-8000-000000000001',
      nbId: 'b2000000-0000-4000-8000-000000000001',
      partnerId: null,
      cat: 'entertainment',
      slug: 'an-thuong-acoustic-bistro',
      name: 'Bistro & Acoustic Bar An Thuong',
      address: '18 Hoang Ke Viem, Ngu Hanh Son, Da Nang',
      lat: 16.0512,
      lng: 108.2464,
      imageUrl: '/images/places/nightlife-entertainment.jpg',
      descEn: 'Intimate courtyard acoustic sets, botanical cocktails, and warm evening conversations.',
      descVi: 'Không gian acoustic sân vườn ấm cúng với cocktail thảo mộc nhẹ nhàng mỗi tối.',
      price: '$$',
      hours: '17:30 - 23:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000011',
      destId: '20000000-0000-4000-8000-000000000003',
      nbId: 'b2000000-0000-4000-8000-000000000004',
      partnerId: null,
      cat: 'attraction',
      slug: 'hoi-an-ancient-town-riverfront',
      name: 'Hoi An Ancient Town & Thu Bon River',
      address: 'Nguyen Thai Hoc, Minh An, Hoi An',
      lat: 15.8771,
      lng: 108.3282,
      imageUrl: '/images/places/heritage-lantern.jpg',
      descEn: 'UNESCO lantern-lit merchant streets, wooden Japanese bridge, and tranquil evening riverboats.',
      descVi: 'Phố cổ di sản rực rỡ ánh đèn lồng bên sông Thu Bồn, lý tưởng dạo bộ chiều tà.',
      price: '$',
      hours: 'Open 24h',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000012',
      destId: '20000000-0000-4000-8000-000000000003',
      nbId: 'b2000000-0000-4000-8000-000000000004',
      partnerId: null,
      cat: 'experience',
      slug: 'tra-que-garden-cooking-class',
      name: 'Tra Que Herb Garden Cooking Class',
      address: 'Tra Que Vegetable Village, Cam Ha, Hoi An',
      lat: 15.9023,
      lng: 108.3389,
      imageUrl: '/images/places/experience-cooking.jpg',
      descEn: 'Morning organic market visit and hands-on Cao Lau & rice-paper cooking in a garden pavilion.',
      descVi: 'Đi chợ sớm và tự tay nấu món Cao Lầu cùng rau thơm hữu cơ giữa vườn xanh.',
      price: '$$',
      hours: '08:30 - 16:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000013',
      destId: '20000000-0000-4000-8000-000000000003',
      nbId: 'b2000000-0000-4000-8000-000000000004',
      partnerId: null,
      cat: 'restaurant',
      slug: 'cam-chau-rice-paddy-bistro',
      name: 'Field Kitchen Cam Chau',
      address: '112 Nguyen Duy Hieu, Cam Chau, Hoi An',
      lat: 15.8794,
      lng: 108.3471,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Farm-to-table central Vietnamese dining overlooking lotus ponds and breezy emerald paddies.',
      descVi: 'Nhà hàng ẩm thực bản địa nhìn thẳng ra đồng lúa và đầm sen yên ả.',
      price: '$$',
      hours: '10:30 - 21:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000014',
      destId: '20000000-0000-4000-8000-000000000003',
      nbId: 'b2000000-0000-4000-8000-000000000004',
      partnerId: null,
      cat: 'cafe',
      slug: 'cam-chau-roastery-garden',
      name: 'Roving Chillhouse Garden Café',
      address: 'Nguyen Trai Extension, Thanh Dong, Hoi An',
      lat: 15.8842,
      lng: 108.3526,
      imageUrl: '/images/places/cafe-roastery.jpg',
      descEn: 'Open-air wooden pavilion café surrounded by rice fields with cold brew and quiet morning breeze.',
      descVi: 'Quán cà phê nhà gỗ thoáng mát giữa cánh đồng lúa, thích hợp đọc sách sáng.',
      price: '$',
      hours: '07:00 - 20:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000015',
      destId: '20000000-0000-4000-8000-000000000002',
      nbId: 'b2000000-0000-4000-8000-000000000002',
      partnerId: null,
      cat: 'cafe',
      slug: 'quang-an-lakeside-coffee',
      name: 'West Lake Roastery & Courtyard',
      address: '19 Quang Khanh, Quang An, Tay Ho, Hanoi',
      lat: 21.0642,
      lng: 105.8211,
      imageUrl: '/images/places/cafe-roastery.jpg',
      descEn: 'Quiet lakeside heritage courtyard serving egg coffee, single-origin pour-overs, and warm pastries.',
      descVi: 'Quán cà phê sân vườn ven Hồ Tây phục vụ cà phê trứng và bánh nướng mỗi sáng.',
      price: '$$',
      hours: '07:00 - 22:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000016',
      destId: '20000000-0000-4000-8000-000000000002',
      nbId: 'b2000000-0000-4000-8000-000000000002',
      partnerId: null,
      cat: 'restaurant',
      slug: 'tay-ho-lotus-dining',
      name: 'Sen Tay Ho Heritage Kitchen',
      address: '614 Lac Long Quan, Tay Ho, Hanoi',
      lat: 21.0731,
      lng: 105.8147,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Refined Hanoi seasonal dishes, pho, and lotus-steamed specialties in leafy garden pavilions.',
      descVi: 'Ẩm thực Hà Nội truyền thống trong không gian vườn xanh mát gần Hồ Tây.',
      price: '$$',
      hours: '11:00 - 22:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000017',
      destId: '20000000-0000-4000-8000-000000000002',
      nbId: 'b2000000-0000-4000-8000-000000000002',
      partnerId: null,
      cat: 'essential',
      slug: 'tay-ho-organic-market',
      name: 'Quang An Weekend & Organic Grocer',
      address: '236 Au Co, Quang An, Tay Ho, Hanoi',
      lat: 21.0674,
      lng: 105.8266,
      imageUrl: '/images/places/market-essentials.jpg',
      descEn: 'Fresh organic produce, artisan sourdough, and neighborhood pharmacy staples.',
      descVi: 'Cửa hàng thực phẩm hữu cơ, bánh mì tươi và nhu yếu phẩm cho khách ở dài ngày.',
      price: '$$',
      hours: '07:00 - 21:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000018',
      destId: '20000000-0000-4000-8000-000000000004',
      nbId: 'b2000000-0000-4000-8000-000000000003',
      partnerId: null,
      cat: 'restaurant',
      slug: 'thao-dien-river-bistro',
      name: 'Saigon River Garden Bistro',
      address: '42 Xuan Thuy, Thao Dien, Thu Duc City, HCMC',
      lat: 10.8035,
      lng: 106.7336,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Modern southern Vietnamese cuisine and organic salads under shaded banyan trees.',
      descVi: 'Ẩm thực Nam Bộ hiện đại và thực đơn lành mạnh dưới tán cây xanh Thảo Điền.',
      price: '$$',
      hours: '10:30 - 22:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000019',
      destId: '20000000-0000-4000-8000-000000000004',
      nbId: 'b2000000-0000-4000-8000-000000000003',
      partnerId: null,
      cat: 'shopping',
      slug: 'thao-dien-artisan-concept',
      name: 'Song Ceramics & Lifestyle Concept',
      address: '63 Xuan Thuy, Thao Dien, Thu Duc City, HCMC',
      lat: 10.8041,
      lng: 106.7348,
      imageUrl: '/images/places/shopping-boutique.jpg',
      descEn: 'Curated Vietnamese ceramics, hand-dyed textiles, and independent design objects.',
      descVi: 'Gốm thủ công, dệt nhuộm tự nhiên và đồ thiết kế nội địa tuyển chọn.',
      price: '$$',
      hours: '09:30 - 21:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000020',
      destId: '20000000-0000-4000-8000-000000000004',
      nbId: 'b2000000-0000-4000-8000-000000000003',
      partnerId: null,
      cat: 'entertainment',
      slug: 'thao-dien-evening-lounge',
      name: 'Thao Dien Vinyl & Cocktail Terrace',
      address: '12 Quoc Huong, Thao Dien, Thu Duc City, HCMC',
      lat: 10.8018,
      lng: 106.7311,
      imageUrl: '/images/places/nightlife-entertainment.jpg',
      descEn: 'Relaxed neighborhood vinyl lounge with craft cocktails and Saigon river breezes.',
      descVi: 'Quán nghe nhạc đĩa than và cocktail thư giãn cuối tuần giữa Thảo Điền.',
      price: '$$$',
      hours: '18:00 - 00:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000021',
      destId: '20000000-0000-4000-8000-000000000005',
      nbId: 'b2000000-0000-4000-8000-000000000005',
      partnerId: null,
      cat: 'attraction',
      slug: 'xuan-huong-lake-trail',
      name: 'Xuan Huong Lake & Pine Walk',
      address: 'Tran Quoc Toan, Ward 1, Da Lat',
      lat: 11.9412,
      lng: 108.4451,
      imageUrl: '/images/stays/dalat-pine-sanctuary.jpg',
      descEn: 'Scenic 5 km lakeside loop framed by weeping willows, cool highland mist, and flower gardens.',
      descVi: 'Cung đường dạo bộ 5 km quanh Hồ Xuân Hương giữa sương sớm và rừng thông.',
      price: 'Free',
      hours: 'Open 24h',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000022',
      destId: '20000000-0000-4000-8000-000000000005',
      nbId: 'b2000000-0000-4000-8000-000000000005',
      partnerId: null,
      cat: 'restaurant',
      slug: 'da-lat-highland-hearth',
      name: 'Highland Harvest Kitchen',
      address: '18 Ba Trieu, Ward 4, Da Lat',
      lat: 11.9378,
      lng: 108.4352,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Warm farm-fresh highland hotpots, roasted artichoke tea, and local vegetables.',
      descVi: 'Lẩu rau cao nguyên ấm áp, trà atiso và nguyên liệu tươi từ nông trại Đà Lạt.',
      price: '$$',
      hours: '11:00 - 21:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000023',
      destId: '20000000-0000-4000-8000-000000000006',
      nbId: 'b2000000-0000-4000-8000-000000000006',
      partnerId: null,
      cat: 'attraction',
      slug: 'phu-quoc-long-beach-sunset',
      name: 'Long Beach Sunset Promenade',
      address: 'Tran Hung Dao, Duong Dong, Phu Quoc',
      lat: 10.1932,
      lng: 103.9635,
      imageUrl: '/images/places/beach-attraction.jpg',
      descEn: 'Golden western coastline famous for calm evening swims and uninterrupted island sunsets.',
      descVi: 'Bờ biển phía Tây nổi tiếng với làn nước êm và hoàng hôn rực rỡ trên đảo Ngọc.',
      price: 'Free',
      hours: 'Open 24h',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000024',
      destId: '20000000-0000-4000-8000-000000000006',
      nbId: 'b2000000-0000-4000-8000-000000000006',
      partnerId: null,
      cat: 'restaurant',
      slug: 'duong-dong-coastal-grill',
      name: 'Duong Dong Coastal Seafood Grill',
      address: '86 Tran Hung Dao, Duong Dong, Phu Quoc',
      lat: 10.2054,
      lng: 103.9612,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Fresh daily catch, sea urchin, and Phu Quoc black-pepper specialties served ocean-side.',
      descVi: 'Hải sản tươi trong ngày và đặc sản tiêu Phú Quốc chế biến ngay sát bờ biển.',
      price: '$$',
      hours: '11:00 - 22:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000025',
      destId: '20000000-0000-4000-8000-000000000006',
      nbId: 'b2000000-0000-4000-8000-000000000006',
      partnerId: null,
      cat: 'cafe',
      slug: 'sunset-cliff-roasters-phu-quoc',
      name: 'Island Horizon Coffee Terrace',
      address: '118 Tran Hung Dao, Duong Dong, Phu Quoc',
      lat: 10.1897,
      lng: 103.9648,
      imageUrl: '/images/places/cafe-roastery.jpg',
      descEn: 'Breezy ocean-view espresso bar serving cold brew tonics and coconut pastries.',
      descVi: 'Quán cà phê hướng biển thoáng gió với cold brew và bánh ngọt thủ công.',
      price: '$$',
      hours: '07:00 - 21:30',
    },
  ];
  for (const pl of places) {
    await dbQuery(
      `INSERT INTO places (
        id, destination_id, neighborhood_id, partner_id, category, slug, name, address,
        lat, lng, image_url, description_en, description_vi, price_range, opening_hours,
        data_source, verification_status, is_featured
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'curated_team','verified',TRUE)
      ON CONFLICT (id) DO NOTHING`,
      [
        pl.id,
        pl.destId,
        pl.nbId,
        pl.partnerId,
        pl.cat,
        pl.slug,
        pl.name,
        pl.address,
        pl.lat,
        pl.lng,
        pl.imageUrl,
        pl.descEn,
        pl.descVi,
        pl.price,
        pl.hours,
      ]
    );
  }

  if (stayId) {
    await dbQuery(
      `INSERT INTO stay_nearby_places (stay_id, place_id, distance_label)
       VALUES
         ($1, 'b4000000-0000-4000-8000-000000000001', '4 min walk'),
         ($1, 'b4000000-0000-4000-8000-000000000002', '6 min scooter'),
         ($1, 'b4000000-0000-4000-8000-000000000008', '3 min walk'),
         ($1, 'b4000000-0000-4000-8000-000000000003', '4 min walk'),
         ($1, 'b4000000-0000-4000-8000-000000000004', '5 min walk'),
         ($1, 'b4000000-0000-4000-8000-000000000009', '6 min walk'),
         ($1, 'b4000000-0000-4000-8000-000000000010', '5 min walk')
       ON CONFLICT (stay_id, place_id) DO NOTHING`,
      [stayId]
    );
  }

  // Host Acquisition Pipeline Leads
  const leads = [
    {
      id: 'b5000000-0000-4000-8000-000000000001',
      source: 'partner_referral',
      businessName: 'Son Tra Ocean Residences',
      contactName: 'Quoc Bao Le',
      email: 'bao.le@sontraresidences.vn',
      phone: '+84 905 771 902',
      dest: 'da-nang',
      type: 'apartment',
      units: 12,
      stage: 'interested',
      kyc: 'submitted',
      notes: '12 ocean-view apartments; wants monthly BookingFlow distribution with 0% host commission.',
    },
    {
      id: 'b5000000-0000-4000-8000-000000000002',
      source: 'outbound_bd',
      businessName: 'West Lake Lotus Boutique Homes',
      contactName: 'Thu Trang Pham',
      email: 'trang@lotuswesthomes.vn',
      phone: '+84 912 440 818',
      dest: 'hanoi',
      type: 'boutique_hotel',
      units: 8,
      stage: 'onboarding',
      kyc: 'verified',
      notes: 'Ready to upload room inventory and iCal calendar links.',
    },
    {
      id: 'b5000000-0000-4000-8000-000000000003',
      source: 'inbound_web',
      businessName: 'Cam Thanh Palm Eco Villas',
      contactName: 'Hoang Nam Tran',
      email: 'nam@palmvillas.vn',
      phone: '+84 935 229 114',
      dest: 'hoi-an',
      type: 'villa',
      units: 5,
      stage: 'new_lead',
      kyc: 'pending',
      notes: 'Requested callback regarding 14/30-night package pricing.',
    },
  ];
  for (const ld of leads) {
    await dbQuery(
      `INSERT INTO host_leads (
        id, source, business_name, contact_name, email, phone, whatsapp_zalo,
        destination_slug, property_type, estimated_units, stage, assigned_staff_id,
        next_follow_up_at, kyc_status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,NOW() + INTERVAL '2 days',$12,$13)
      ON CONFLICT (id) DO NOTHING`,
      [
        ld.id,
        ld.source,
        ld.businessName,
        ld.contactName,
        ld.email,
        ld.phone,
        ld.dest,
        ld.type,
        ld.units,
        ld.stage,
        adminId,
        ld.kyc,
        ld.notes,
      ]
    );
  }

  // Support Tickets & Trust & Safety Reports
  await dbQuery(
    `INSERT INTO support_tickets (
      id, ticket_code, category, priority, status, stay_id, host_id, guest_id,
      assigned_staff_id, sla_due_at, subject, description
    ) VALUES (
      'b6000000-0000-4000-8000-000000000001',
      'TK-2026-101',
      'checkin_access',
      'high',
      'in_progress',
      $1, $2, $3, $4,
      NOW() + INTERVAL '4 hours',
      'Late-night airport arrival smart-lock setup confirmation',
      'Guest requested early confirmation of keypad access and airport transfer guidance prior to check-in.'
    ) ON CONFLICT (id) DO NOTHING`,
    [stayId, hostId, guestId, adminId]
  );

  await dbQuery(
    `INSERT INTO safety_reports (
      id, report_type, severity, status, stay_id, assigned_staff_id, summary
    ) VALUES (
      'b6500000-0000-4000-8000-000000000001',
      'misleading_listing',
      'low',
      'open',
      $1, $2,
      'Routine periodic check of check-in hours and street noise disclaimer requested by ops QA.'
    ) ON CONFLICT (id) DO NOTHING`,
    [stayId, adminId]
  );

  // Task Center
  const tasks = [
    {
      id: 'b7000000-0000-4000-8000-000000000001',
      title: 'Review new host application & publish Perfume River Suites',
      desc: 'Verify listing details and optionally assign trust badges after publication.',
      status: 'todo',
      priority: 'high',
      entityType: 'stay',
      entityId: stayId ?? 'queue',
      days: 1,
    },
    {
      id: 'b7000000-0000-4000-8000-000000000002',
      title: 'Follow up Son Tra Ocean Residences (12 units pipeline)',
      desc: 'Walk through 7/14/21/30-night package setup and 0% host commission onboarding.',
      status: 'in_progress',
      priority: 'high',
      entityType: 'host_lead',
      entityId: 'b5000000-0000-4000-8000-000000000001',
      days: 2,
    },
    {
      id: 'b7000000-0000-4000-8000-000000000003',
      title: 'Monthly Stripe & VietQR ledger reconciliation',
      desc: 'Confirm settled online booking fees match ledger_entries and issued invoices.',
      status: 'todo',
      priority: 'medium',
      entityType: 'general',
      entityId: 'finance',
      days: 4,
    },
  ];
  for (const t of tasks) {
    await dbQuery(
      `INSERT INTO admin_tasks (
        id, title, description, status, priority, assigned_staff_id, created_by,
        due_at, entity_type, entity_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$6,$7::timestamptz,$8,$9)
      ON CONFLICT (id) DO NOTHING`,
      [
        t.id,
        t.title,
        t.desc,
        t.status,
        t.priority,
        adminId,
        `${addDaysIso(today, t.days)}T10:00:00Z`,
        t.entityType,
        t.entityId,
      ]
    );
  }

  // CMS Content Pro Seed (Tiptap JSON docs with live VietNomad Dynamic Blocks)
  const dnGuideDocEn = {
    type: 'doc',
    content: [
      { type: 'tocBlock', attrs: { title: 'Guide Outline', maxLevel: 3 } },
      {
        type: 'heading',
        attrs: { level: 2, id: 'why-an-thuong-da-nang' },
        content: [{ type: 'text', text: 'Why remote workers choose An Thuong, Da Nang' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'An Thuong puts My Khe Beach, reliable fiber internet, specialty coffee roasters, and monthly apartments within a 10-minute walk. Most VietNomad stays offer dedicated desks, ergonomic seating, and transparent electricity billing for 30-night routines.',
          },
        ],
      },
      {
        type: 'vnDestinationCard',
        attrs: { destinationId: '20000000-0000-4000-8000-000000000001', showMetrics: true, layout: 'horizontal' },
      },
      {
        type: 'heading',
        attrs: { level: 2, id: 'coworking-and-neighborhood-essentials' },
        content: [{ type: 'text', text: 'Coworking and neighborhood essentials' }],
      },
      {
        type: 'vnNeighborhoodCard',
        attrs: { neighborhoodId: 'b2000000-0000-4000-8000-000000000001' },
      },
      {
        type: 'vnLocalPlaceCard',
        attrs: { placeId: 'b4000000-0000-4000-8000-000000000001', showHours: true, showPartnerNote: true },
      },
      {
        type: 'callout',
        attrs: {
          tone: 'tip',
          title: 'First-week arrival tip',
          body: 'Book a 14- or 30-night package in An Thuong to unlock lower nightly pricing and predictable weekly housekeeping.',
        },
      },
      {
        type: 'heading',
        attrs: { level: 2, id: 'verified-stays-an-thuong' },
        content: [{ type: 'text', text: 'Verified monthly stays in Da Nang' }],
      },
      {
        type: 'vnRecommendedStays',
        attrs: { destinationSlug: 'da-nang', maxItems: 3, workReadyOnly: true, title: 'Work-Ready Da Nang Stays' },
      },
      {
        type: 'vnPromotionBlock',
        attrs: { promotionId: 'ba000000-0000-4000-8000-000000000001', style: 'banner' },
      },
      {
        type: 'faqGroup',
        attrs: {
          title: 'Common Questions About Living in An Thuong',
          items: [
            {
              question: 'How fast is home Wi-Fi in An Thuong apartments?',
              answer: 'Most verified VietNomad apartments in Da Nang test between 120 and 300 Mbps on fiber lines.',
            },
            {
              question: 'Is there any host booking commission on VietNomad?',
              answer: 'Hosts list with 0% commission; guests pay a transparent 12% service fee at checkout with full price breakdown.',
            },
          ],
        },
      },
    ],
  };

  const dnGuideDocVi = {
    type: 'doc',
    content: [
      { type: 'tocBlock', attrs: { title: 'Mục lục bài viết', maxLevel: 3 } },
      {
        type: 'heading',
        attrs: { level: 2, id: 'vi-sao-chon-an-thuong' },
        content: [{ type: 'text', text: 'Vì sao cộng đồng làm việc từ xa chọn An Thượng, Đà Nẵng' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Khu phố An Thượng kết nối bãi biển Mỹ Khê, quán cà phê làm việc yên tĩnh, coworking space và căn hộ thuê theo tháng trong vòng 10 phút đi bộ.',
          },
        ],
      },
      {
        type: 'vnDestinationCard',
        attrs: { destinationId: '20000000-0000-4000-8000-000000000001', showMetrics: true, layout: 'horizontal' },
      },
      {
        type: 'vnLocalPlaceCard',
        attrs: { placeId: 'b4000000-0000-4000-8000-000000000001', showHours: true, showPartnerNote: true },
      },
      {
        type: 'vnRecommendedStays',
        attrs: { destinationSlug: 'da-nang', maxItems: 3, workReadyOnly: true, title: 'Chỗ ở chuẩn làm việc tại Đà Nẵng' },
      },
    ],
  };

  const hnGuideDocEn = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2, id: 'west-lake-routine' },
        content: [{ type: 'text', text: 'Morning coffee & lakefront calm in Tay Ho, Hanoi' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Tay Ho (West Lake) blends leafy residential alleys, lakeside running paths, and reliable serviced studios ideal for 14- to 30-night stays in northern Vietnam.',
          },
        ],
      },
      {
        type: 'vnNeighborhoodCard',
        attrs: { neighborhoodId: 'b2000000-0000-4000-8000-000000000002' },
      },
      {
        type: 'vnLocalPlaceCard',
        attrs: { placeId: 'b4000000-0000-4000-8000-000000000005', showHours: true, showPartnerNote: true },
      },
      {
        type: 'vnStaySearchWidget',
        attrs: { defaultDestinationSlug: 'hanoi', defaultPackageNights: 30, ctaLabel: 'Explore Tay Ho & Hanoi Stays' },
      },
    ],
  };

  await dbQuery(
    `INSERT INTO cms_contents (
      id, content_type, category, category_id, locale, translation_group_id, slug,
      title_en, title_vi, excerpt_en, excerpt_vi, body_en, body_vi,
      body_doc_en, body_doc_vi, published_doc_en, published_doc_vi,
      destination_id, neighborhood_id, seo_title, seo_description, focus_keyword,
      seo_score, word_count, reading_time_minutes, status, author_id, published_at, schema_type
    ) VALUES (
      'b8000000-0000-4000-8000-000000000001',
      'destination_guide',
      'living_guide',
      'c1000000-0000-4000-8000-000000000001',
      'en',
      'b8000000-0000-4000-8000-000000000001',
      'an-thuong-da-nang-30-day-living-guide',
      'Living & Working 30 Days in An Thuong, Da Nang',
      'Cẩm nang sống & làm việc 30 ngày tại An Thượng, Đà Nẵng',
      'Complete breakdown of fiber internet reliability, local seafood markets, coworking hubs, and monthly stays in An Thuong.',
      'Hướng dẫn chi tiết chi phí sinh hoạt, hạ tầng internet, coworking và căn hộ tháng tại khu phố biển An Thượng.',
      'Complete breakdown of fiber internet reliability, local seafood markets, scooter rentals, and coastal neighborhoods.',
      'Hướng dẫn chi tiết chi phí sinh hoạt, hạ tầng internet, đi lại và nhịp sống tại khu phố biển An Thượng.',
      $2::jsonb, $3::jsonb, $2::jsonb, $3::jsonb,
      '20000000-0000-4000-8000-000000000001',
      'b2000000-0000-4000-8000-000000000001',
      'An Thuong Da Nang 30-Day Living Guide | VietNomad Stays',
      'Monthly apartments, coworking spaces, and practical living costs in An Thuong, Da Nang.',
      'An Thuong Da Nang',
      88,
      240,
      2,
      'published',
      $1,
      NOW(),
      'Guide'
    ) ON CONFLICT (id) DO UPDATE SET
      body_doc_en = COALESCE(cms_contents.body_doc_en, EXCLUDED.body_doc_en),
      body_doc_vi = COALESCE(cms_contents.body_doc_vi, EXCLUDED.body_doc_vi),
      published_doc_en = COALESCE(cms_contents.published_doc_en, EXCLUDED.published_doc_en),
      published_doc_vi = COALESCE(cms_contents.published_doc_vi, EXCLUDED.published_doc_vi),
      category_id = COALESCE(cms_contents.category_id, EXCLUDED.category_id),
      focus_keyword = CASE WHEN COALESCE(cms_contents.focus_keyword, '') = '' THEN EXCLUDED.focus_keyword ELSE cms_contents.focus_keyword END,
      seo_score = CASE WHEN cms_contents.seo_score = 0 THEN EXCLUDED.seo_score ELSE cms_contents.seo_score END`,
    [adminId, JSON.stringify(dnGuideDocEn), JSON.stringify(dnGuideDocVi)]
  );

  await dbQuery(
    `INSERT INTO cms_contents (
      id, content_type, category, category_id, locale, translation_group_id, slug,
      title_en, title_vi, excerpt_en, excerpt_vi, body_en, body_vi,
      body_doc_en, body_doc_vi, published_doc_en, published_doc_vi,
      destination_id, neighborhood_id, seo_title, seo_description, focus_keyword,
      seo_score, word_count, reading_time_minutes, status, author_id, published_at, schema_type
    ) VALUES (
      'b8000000-0000-4000-8000-000000000002',
      'neighborhood_guide',
      'living_guide',
      'c1000000-0000-4000-8000-000000000002',
      'en',
      'b8000000-0000-4000-8000-000000000002',
      'tay-ho-hanoi-long-stay-neighborhood-guide',
      'Tay Ho (West Lake), Hanoi: A Calm Base for 30-Night Remote Work',
      'Tây Hồ, Hà Nội: Khu vực lý tưởng cho lưu trú dài ngày & làm việc từ xa',
      'Explore West Lake apartments, specialty cafes, yoga studios, and peaceful lakeside living in Tay Ho.',
      'Khám phá căn hộ Tây Hồ, không gian làm việc yên tĩnh và tiện ích sống quanh Hồ Tây.',
      'Explore West Lake apartments, specialty cafes, yoga studios, and peaceful lakeside living in Tay Ho.',
      'Khám phá căn hộ Tây Hồ, không gian làm việc yên tĩnh và tiện ích sống quanh Hồ Tây.',
      $2::jsonb, $2::jsonb, $2::jsonb, $2::jsonb,
      '20000000-0000-4000-8000-000000000002',
      'b2000000-0000-4000-8000-000000000002',
      'Tay Ho Hanoi Long-Stay Guide | VietNomad Stays',
      'Where to live, work, and book verified monthly apartments in Tay Ho, Hanoi.',
      'Tay Ho Hanoi',
      84,
      140,
      1,
      'published',
      $1,
      NOW(),
      'Guide'
    ) ON CONFLICT (id) DO NOTHING`,
    [adminId, JSON.stringify(hnGuideDocEn)]
  );

  await dbQuery(
    `INSERT INTO cms_content_tags (content_id, tag_id) VALUES
      ('b8000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001'),
      ('b8000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000002'),
      ('b8000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002')
     ON CONFLICT DO NOTHING`
  );

  await dbQuery(
    `INSERT INTO marketing_campaigns (
      id, name, channel, utm_source, utm_medium, utm_campaign, budget_vnd, start_date, status
    ) VALUES
      ('b9000000-0000-4000-8000-000000000001', 'Vietnam Winter Long-Stay SEO & Content', 'organic_seo', 'google', 'organic', 'vn_winter_longstay', 18000000, $1::date, 'active'),
      ('b9000000-0000-4000-8000-000000000002', 'Da Nang Beach Builders Partner Push', 'partnerships', 'enouvo', 'referral', 'dn_builders_2026', 12000000, $1::date, 'active')
    ON CONFLICT (id) DO NOTHING`,
    [addDaysIso(today, -15)]
  );

  await dbQuery(
    `INSERT INTO promotions (
      id, code, name, discount_type, discount_value, min_nights, max_uses,
      campaign_id, valid_from, valid_to, is_active
    ) VALUES (
      'ba000000-0000-4000-8000-000000000001',
      'LONGSTAY30',
      'Monthly Stay Welcome Credit',
      'fixed_vnd',
      350000,
      30,
      200,
      'b9000000-0000-4000-8000-000000000001',
      $1::date,
      $2::date,
      TRUE
    ) ON CONFLICT (id) DO NOTHING`,
    [today, addDaysIso(today, 90)]
  );

  await dbQuery(
    `INSERT INTO operating_expenses (
      id, category, department, description, amount_vnd, incurred_date, recorded_by
    ) VALUES
      ('bb000000-0000-4000-8000-000000000001', 'infrastructure', 'Engineering', 'Cloud hosting, PostgreSQL & media CDN storage', 4500000, $1::date, $2),
      ('bb000000-0000-4000-8000-000000000002', 'marketing', 'Growth', 'Local destination photography & SEO content production', 8200000, $1::date, $2)
    ON CONFLICT (id) DO NOTHING`,
    [today, adminId]
  );

  await dbQuery(
    `INSERT INTO management_reports (
      id, department, period_label, submitted_by, results_summary, target_comparison,
      issues_raised, root_cause_analysis, proposed_actions, next_plan, approval_request, status
    ) VALUES (
      'bc000000-0000-4000-8000-000000000001',
      'Operations & Supply',
      'Monthly Operating Review',
      $1,
      'Onboarded verified properties across 6 Vietnam hubs with 100% BookingFlow adoption and 0% host commission.',
      'Supply inventory at 92% of monthly city target; Da Nang & Hanoi lead booking conversion.',
      'Host approval SLA averaged 6 hours on non-instant stays.',
      'Missing automated task creation when guests pay the 12% fee on non-instant properties.',
      'Enable automatic Task Center reminder + Zalo alert for pending host confirmations over 4h.',
      'Expand An Thuong & Tay Ho inventory by 15 new apartments next month.',
      'Approve Q4 partner onboarding incentive budget of 12,000,000 VND for local coworking passes.',
      'submitted'
    ) ON CONFLICT (id) DO NOTHING`,
    [adminId]
  );

  const rules = [
    {
      id: 'bd000000-0000-4000-8000-000000000001',
      key: 'auto_task_new_host_app',
      name: 'Create moderation task on new host application',
      trigger: 'host_application.submitted',
      cfg: { defaultPriority: 'high', dueHours: 24 },
    },
    {
      id: 'bd000000-0000-4000-8000-000000000002',
      key: 'auto_task_refund_request',
      name: 'Create Finance review task on refund request',
      trigger: 'refund_request.created',
      cfg: { defaultPriority: 'urgent', dueHours: 12 },
    },
    {
      id: 'bd000000-0000-4000-8000-000000000003',
      key: 'auto_task_support_ticket',
      name: 'Create Ops SLA task on urgent support ticket',
      trigger: 'support_ticket.created',
      cfg: { defaultPriority: 'high', dueHours: 4 },
    },
  ];
  for (const r of rules) {
    await dbQuery(
      `INSERT INTO automation_rules (id, rule_key, name, trigger_event, action_type, action_config, is_active)
       VALUES ($1,$2,$3,$4,'create_task',$5::jsonb,TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [r.id, r.key, r.name, r.trigger, JSON.stringify(r.cfg)]
    );
  }
}

export async function ensureCuratedDiscoverySeeded() {
  const neighborhoods = [
    {
      id: 'b2000000-0000-4000-8000-000000000005',
      destId: '20000000-0000-4000-8000-000000000005',
      slug: 'xuan-huong-pine-hills',
      nameEn: 'Xuan Huong & Pine Hills',
      nameVi: 'Hồ Xuân Hương & Đồi Thông',
      sumEn: 'Cool highland center with heritage roasteries and misty walking trails.',
      sumVi: 'Trung tâm cao nguyên mát mẻ với các quán cà phê rang xay và đồi thông.',
      x: 58,
      y: 67,
    },
    {
      id: 'b2000000-0000-4000-8000-000000000006',
      destId: '20000000-0000-4000-8000-000000000006',
      slug: 'duong-dong-sunset-coast',
      nameEn: 'Duong Dong & Sunset Coast',
      nameVi: 'Dương Đông & Bờ Tây Hoàng Hôn',
      sumEn: 'Island beach strip with fresh seafood markets and calm ocean sunset cafés.',
      sumVi: 'Dải biển trung tâm đảo Ngọc gần chợ đêm, hải sản và quán cà phê ngắm hoàng hôn.',
      x: 34,
      y: 85,
    },
  ];
  for (const n of neighborhoods) {
    await dbQuery(
      `INSERT INTO neighborhoods (
        id, destination_id, slug, name_en, name_vi, summary_en, summary_vi, map_x, map_y
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO NOTHING`,
      [n.id, n.destId, n.slug, n.nameEn, n.nameVi, n.sumEn, n.sumVi, n.x, n.y]
    );
  }

  const extraPlaces = [
    {
      id: 'b4000000-0000-4000-8000-000000000008',
      destId: '20000000-0000-4000-8000-000000000001',
      nbId: 'b2000000-0000-4000-8000-000000000001',
      cat: 'attraction',
      slug: 'my-khe-beach-promenade-da-nang',
      name: 'My Khe Beach Promenade',
      address: 'Vo Nguyen Giap, Phuoc My, Son Tra, Da Nang',
      lat: 16.0598,
      lng: 108.2469,
      imageUrl: '/images/places/beach-attraction.jpg',
      descEn: 'Sweeping white-sand crescent ideal for sunrise swims, oceanfront walks, and paddleboarding.',
      descVi: 'Bãi biển cát trắng mịn lý tưởng để bơi sáng, chạy bộ dọc bờ biển và chèo SUP.',
      price: 'Free',
      hours: 'Open 24h',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000009',
      destId: '20000000-0000-4000-8000-000000000001',
      nbId: 'b2000000-0000-4000-8000-000000000001',
      cat: 'shopping',
      slug: 'an-thuong-craft-ceramics',
      name: 'Non Nuoc Craft & Linen Studio',
      address: '44 Nguyen Van Thoai, Ngu Hanh Son, Da Nang',
      lat: 16.0531,
      lng: 108.2452,
      imageUrl: '/images/places/shopping-boutique.jpg',
      descEn: 'Locally thrown stoneware, coastal linen shirts, and handmade incense sourced from central artisans.',
      descVi: 'Gốm thủ công, áo linen thoáng mát và đồ mỹ nghệ của nghệ nhân miền Trung.',
      price: '$$',
      hours: '09:00 - 21:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000010',
      destId: '20000000-0000-4000-8000-000000000001',
      nbId: 'b2000000-0000-4000-8000-000000000001',
      cat: 'entertainment',
      slug: 'an-thuong-acoustic-bistro',
      name: 'Bistro & Acoustic Bar An Thuong',
      address: '18 Hoang Ke Viem, Ngu Hanh Son, Da Nang',
      lat: 16.0512,
      lng: 108.2464,
      imageUrl: '/images/places/nightlife-entertainment.jpg',
      descEn: 'Intimate courtyard acoustic sets, botanical cocktails, and warm evening conversations.',
      descVi: 'Không gian acoustic sân vườn ấm cúng với cocktail thảo mộc nhẹ nhàng mỗi tối.',
      price: '$$',
      hours: '17:30 - 23:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000011',
      destId: '20000000-0000-4000-8000-000000000003',
      nbId: 'b2000000-0000-4000-8000-000000000004',
      cat: 'attraction',
      slug: 'hoi-an-ancient-town-riverfront',
      name: 'Hoi An Ancient Town & Thu Bon River',
      address: 'Nguyen Thai Hoc, Minh An, Hoi An',
      lat: 15.8771,
      lng: 108.3282,
      imageUrl: '/images/places/heritage-lantern.jpg',
      descEn: 'UNESCO lantern-lit merchant streets, wooden Japanese bridge, and tranquil evening riverboats.',
      descVi: 'Phố cổ di sản rực rỡ ánh đèn lồng bên sông Thu Bồn, lý tưởng dạo bộ chiều tà.',
      price: '$',
      hours: 'Open 24h',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000012',
      destId: '20000000-0000-4000-8000-000000000003',
      nbId: 'b2000000-0000-4000-8000-000000000004',
      cat: 'experience',
      slug: 'tra-que-garden-cooking-class',
      name: 'Tra Que Herb Garden Cooking Class',
      address: 'Tra Que Vegetable Village, Cam Ha, Hoi An',
      lat: 15.9023,
      lng: 108.3389,
      imageUrl: '/images/places/experience-cooking.jpg',
      descEn: 'Morning organic market visit and hands-on Cao Lau & rice-paper cooking in a garden pavilion.',
      descVi: 'Đi chợ sớm và tự tay nấu món Cao Lầu cùng rau thơm hữu cơ giữa vườn xanh.',
      price: '$$',
      hours: '08:30 - 16:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000013',
      destId: '20000000-0000-4000-8000-000000000003',
      nbId: 'b2000000-0000-4000-8000-000000000004',
      cat: 'restaurant',
      slug: 'cam-chau-rice-paddy-bistro',
      name: 'Field Kitchen Cam Chau',
      address: '112 Nguyen Duy Hieu, Cam Chau, Hoi An',
      lat: 15.8794,
      lng: 108.3471,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Farm-to-table central Vietnamese dining overlooking lotus ponds and breezy emerald paddies.',
      descVi: 'Nhà hàng ẩm thực bản địa nhìn thẳng ra đồng lúa và đầm sen yên ả.',
      price: '$$',
      hours: '10:30 - 21:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000014',
      destId: '20000000-0000-4000-8000-000000000003',
      nbId: 'b2000000-0000-4000-8000-000000000004',
      cat: 'cafe',
      slug: 'cam-chau-roastery-garden',
      name: 'Roving Chillhouse Garden Café',
      address: 'Nguyen Trai Extension, Thanh Dong, Hoi An',
      lat: 15.8842,
      lng: 108.3526,
      imageUrl: '/images/places/cafe-roastery.jpg',
      descEn: 'Open-air wooden pavilion café surrounded by rice fields with cold brew and quiet morning breeze.',
      descVi: 'Quán cà phê nhà gỗ thoáng mát giữa cánh đồng lúa, thích hợp đọc sách sáng.',
      price: '$',
      hours: '07:00 - 20:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000015',
      destId: '20000000-0000-4000-8000-000000000002',
      nbId: 'b2000000-0000-4000-8000-000000000002',
      cat: 'cafe',
      slug: 'quang-an-lakeside-coffee',
      name: 'West Lake Roastery & Courtyard',
      address: '19 Quang Khanh, Quang An, Tay Ho, Hanoi',
      lat: 21.0642,
      lng: 105.8211,
      imageUrl: '/images/places/cafe-roastery.jpg',
      descEn: 'Quiet lakeside heritage courtyard serving egg coffee, single-origin pour-overs, and warm pastries.',
      descVi: 'Quán cà phê sân vườn ven Hồ Tây phục vụ cà phê trứng và bánh nướng mỗi sáng.',
      price: '$$',
      hours: '07:00 - 22:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000016',
      destId: '20000000-0000-4000-8000-000000000002',
      nbId: 'b2000000-0000-4000-8000-000000000002',
      cat: 'restaurant',
      slug: 'tay-ho-lotus-dining',
      name: 'Sen Tay Ho Heritage Kitchen',
      address: '614 Lac Long Quan, Tay Ho, Hanoi',
      lat: 21.0731,
      lng: 105.8147,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Refined Hanoi seasonal dishes, pho, and lotus-steamed specialties in leafy garden pavilions.',
      descVi: 'Ẩm thực Hà Nội truyền thống trong không gian vườn xanh mát gần Hồ Tây.',
      price: '$$',
      hours: '11:00 - 22:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000017',
      destId: '20000000-0000-4000-8000-000000000002',
      nbId: 'b2000000-0000-4000-8000-000000000002',
      cat: 'essential',
      slug: 'tay-ho-organic-market',
      name: 'Quang An Weekend & Organic Grocer',
      address: '236 Au Co, Quang An, Tay Ho, Hanoi',
      lat: 21.0674,
      lng: 105.8266,
      imageUrl: '/images/places/market-essentials.jpg',
      descEn: 'Fresh organic produce, artisan sourdough, and neighborhood pharmacy staples.',
      descVi: 'Cửa hàng thực phẩm hữu cơ, bánh mì tươi và nhu yếu phẩm cho khách ở dài ngày.',
      price: '$$',
      hours: '07:00 - 21:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000018',
      destId: '20000000-0000-4000-8000-000000000004',
      nbId: 'b2000000-0000-4000-8000-000000000003',
      cat: 'restaurant',
      slug: 'thao-dien-river-bistro',
      name: 'Saigon River Garden Bistro',
      address: '42 Xuan Thuy, Thao Dien, Thu Duc City, HCMC',
      lat: 10.8035,
      lng: 106.7336,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Modern southern Vietnamese cuisine and organic salads under shaded banyan trees.',
      descVi: 'Ẩm thực Nam Bộ hiện đại và thực đơn lành mạnh dưới tán cây xanh Thảo Điền.',
      price: '$$',
      hours: '10:30 - 22:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000019',
      destId: '20000000-0000-4000-8000-000000000004',
      nbId: 'b2000000-0000-4000-8000-000000000003',
      cat: 'shopping',
      slug: 'thao-dien-artisan-concept',
      name: 'Song Ceramics & Lifestyle Concept',
      address: '63 Xuan Thuy, Thao Dien, Thu Duc City, HCMC',
      lat: 10.8041,
      lng: 106.7348,
      imageUrl: '/images/places/shopping-boutique.jpg',
      descEn: 'Curated Vietnamese ceramics, hand-dyed textiles, and independent design objects.',
      descVi: 'Gốm thủ công, dệt nhuộm tự nhiên và đồ thiết kế nội địa tuyển chọn.',
      price: '$$',
      hours: '09:30 - 21:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000020',
      destId: '20000000-0000-4000-8000-000000000004',
      nbId: 'b2000000-0000-4000-8000-000000000003',
      cat: 'entertainment',
      slug: 'thao-dien-evening-lounge',
      name: 'Thao Dien Vinyl & Cocktail Terrace',
      address: '12 Quoc Huong, Thao Dien, Thu Duc City, HCMC',
      lat: 10.8018,
      lng: 106.7311,
      imageUrl: '/images/places/nightlife-entertainment.jpg',
      descEn: 'Relaxed neighborhood vinyl lounge with craft cocktails and Saigon river breezes.',
      descVi: 'Quán nghe nhạc đĩa than và cocktail thư giãn cuối tuần giữa Thảo Điền.',
      price: '$$$',
      hours: '18:00 - 00:00',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000021',
      destId: '20000000-0000-4000-8000-000000000005',
      nbId: 'b2000000-0000-4000-8000-000000000005',
      cat: 'attraction',
      slug: 'xuan-huong-lake-trail',
      name: 'Xuan Huong Lake & Pine Walk',
      address: 'Tran Quoc Toan, Ward 1, Da Lat',
      lat: 11.9412,
      lng: 108.4451,
      imageUrl: '/images/stays/dalat-pine-sanctuary.jpg',
      descEn: 'Scenic 5 km lakeside loop framed by weeping willows, cool highland mist, and flower gardens.',
      descVi: 'Cung đường dạo bộ 5 km quanh Hồ Xuân Hương giữa sương sớm và rừng thông.',
      price: 'Free',
      hours: 'Open 24h',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000022',
      destId: '20000000-0000-4000-8000-000000000005',
      nbId: 'b2000000-0000-4000-8000-000000000005',
      cat: 'restaurant',
      slug: 'da-lat-highland-hearth',
      name: 'Highland Harvest Kitchen',
      address: '18 Ba Trieu, Ward 4, Da Lat',
      lat: 11.9378,
      lng: 108.4352,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Warm farm-fresh highland hotpots, roasted artichoke tea, and local vegetables.',
      descVi: 'Lẩu rau cao nguyên ấm áp, trà atiso và nguyên liệu tươi từ nông trại Đà Lạt.',
      price: '$$',
      hours: '11:00 - 21:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000023',
      destId: '20000000-0000-4000-8000-000000000006',
      nbId: 'b2000000-0000-4000-8000-000000000006',
      cat: 'attraction',
      slug: 'phu-quoc-long-beach-sunset',
      name: 'Long Beach Sunset Promenade',
      address: 'Tran Hung Dao, Duong Dong, Phu Quoc',
      lat: 10.1932,
      lng: 103.9635,
      imageUrl: '/images/places/beach-attraction.jpg',
      descEn: 'Golden western coastline famous for calm evening swims and uninterrupted island sunsets.',
      descVi: 'Bờ biển phía Tây nổi tiếng với làn nước êm và hoàng hôn rực rỡ trên đảo Ngọc.',
      price: 'Free',
      hours: 'Open 24h',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000024',
      destId: '20000000-0000-4000-8000-000000000006',
      nbId: 'b2000000-0000-4000-8000-000000000006',
      cat: 'restaurant',
      slug: 'duong-dong-coastal-grill',
      name: 'Duong Dong Coastal Seafood Grill',
      address: '86 Tran Hung Dao, Duong Dong, Phu Quoc',
      lat: 10.2054,
      lng: 103.9612,
      imageUrl: '/images/places/local-dining.jpg',
      descEn: 'Fresh daily catch, sea urchin, and Phu Quoc black-pepper specialties served ocean-side.',
      descVi: 'Hải sản tươi trong ngày và đặc sản tiêu Phú Quốc chế biến ngay sát bờ biển.',
      price: '$$',
      hours: '11:00 - 22:30',
    },
    {
      id: 'b4000000-0000-4000-8000-000000000025',
      destId: '20000000-0000-4000-8000-000000000006',
      nbId: 'b2000000-0000-4000-8000-000000000006',
      cat: 'cafe',
      slug: 'sunset-cliff-roasters-phu-quoc',
      name: 'Island Horizon Coffee Terrace',
      address: '118 Tran Hung Dao, Duong Dong, Phu Quoc',
      lat: 10.1897,
      lng: 103.9648,
      imageUrl: '/images/places/cafe-roastery.jpg',
      descEn: 'Breezy ocean-view espresso bar serving cold brew tonics and coconut pastries.',
      descVi: 'Quán cà phê hướng biển thoáng gió với cold brew và bánh ngọt thủ công.',
      price: '$$',
      hours: '07:00 - 21:30',
    },
  ];

  for (const pl of extraPlaces) {
    await dbQuery(
      `INSERT INTO places (
        id, destination_id, neighborhood_id, partner_id, category, slug, name, address,
        lat, lng, image_url, description_en, description_vi, price_range, opening_hours,
        data_source, verification_status, is_featured
      ) VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'curated_team','verified',TRUE)
      ON CONFLICT (id) DO NOTHING`,
      [
        pl.id,
        pl.destId,
        pl.nbId,
        pl.cat,
        pl.slug,
        pl.name,
        pl.address,
        pl.lat,
        pl.lng,
        pl.imageUrl,
        pl.descEn,
        pl.descVi,
        pl.price,
        pl.hours,
      ]
    );
  }

  const stayRow = await dbQuery<{ id: string }>(
    `SELECT s.id FROM stays s
     JOIN destinations d ON d.id = s.destination_id
     WHERE d.slug = 'da-nang' AND s.status = 'live'
     ORDER BY s.featured_rank ASC
     LIMIT 1`
  );
  const primaryDaNangStayId = stayRow.rows[0]?.id;
  if (primaryDaNangStayId) {
    await dbQuery(
      `INSERT INTO stay_nearby_places (stay_id, place_id, distance_label)
       VALUES
         ($1, 'b4000000-0000-4000-8000-000000000001', '4 min walk'),
         ($1, 'b4000000-0000-4000-8000-000000000002', '6 min scooter'),
         ($1, 'b4000000-0000-4000-8000-000000000008', '3 min walk'),
         ($1, 'b4000000-0000-4000-8000-000000000003', '4 min walk'),
         ($1, 'b4000000-0000-4000-8000-000000000004', '5 min walk'),
         ($1, 'b4000000-0000-4000-8000-000000000009', '6 min walk'),
         ($1, 'b4000000-0000-4000-8000-000000000010', '5 min walk')
       ON CONFLICT (stay_id, place_id) DO NOTHING`,
      [primaryDaNangStayId]
    );
  }
}

