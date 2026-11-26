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
      descEn: 'Iconic Da Lat Arabica roastery in a sunlit industrial hall with plenty of power outlets.',
      descVi: 'Xưởng rang xay Arabica nổi tiếng Đà Lạt, không gian rộng rãi nhiều ổ cắm làm việc.',
      price: '$',
      hours: '07:00 - 22:00',
    },
  ];
  for (const pl of places) {
    await dbQuery(
      `INSERT INTO places (
        id, destination_id, neighborhood_id, partner_id, category, slug, name, address,
        description_en, description_vi, price_range, opening_hours, data_source,
        verification_status, is_featured
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'curated_team','verified',TRUE)
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
         ($1, 'b4000000-0000-4000-8000-000000000002', '6 min scooter')
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

  // CMS Content, Marketing Campaigns, Promotions & Operating Expenses
  await dbQuery(
    `INSERT INTO cms_contents (
      id, content_type, category, slug, title_en, title_vi, body_en, body_vi,
      destination_id, seo_title, seo_description, status, author_id, published_at
    ) VALUES (
      'b8000000-0000-4000-8000-000000000001',
      'destination_guide',
      'living_guide',
      'an-thuong-da-nang-30-day-living-guide',
      'Living & Working 30 Days in An Thuong, Da Nang',
      'Cẩm nang sống & làm việc 30 ngày tại An Thượng, Đà Nẵng',
      'Complete breakdown of fiber internet reliability, local seafood markets, scooter rentals, and coastal neighborhoods.',
      'Hướng dẫn chi tiết chi phí sinh hoạt, hạ tầng internet, đi lại và nhịp sống tại khu phố biển An Thượng.',
      '20000000-0000-4000-8000-000000000001',
      'An Thuong Da Nang 30-Day Living Guide | VietNomad Stays',
      'Monthly apartments, coworking spaces, and practical living costs in An Thuong, Da Nang.',
      'published',
      $1,
      NOW()
    ) ON CONFLICT (id) DO NOTHING`,
    [adminId]
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
