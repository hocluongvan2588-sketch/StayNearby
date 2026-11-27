-- Phase A — Wi-Fi data integrity (approved plan).
-- Applied to dev/staging first, then to production (du_lich,
-- pcsyxwccylfpbgvmmifp) on 2026-11-27 after explicit approval.
-- Fully idempotent (IF NOT EXISTS / guarded backfills / ON CONFLICT).
--
-- Principles:
--   * NULL  = "chưa cập nhật" — no defaults, no assumed/formula values.
--   * Ping and Jitter are separate columns (wifi_jitter_ms no longer doubles).
--   * wifi_status is the lifecycle source of truth:
--       not_updated -> host_declared | platform_measured -> verified
--       (change after verified -> reverify_pending -> verified)
--   * wifi_measurements is append-only history (host manual, platform
--     measured, and later guest-measured runs during actual stays).

-- ── 1. stay Wi-Fi columns: nullable, no defaults ─────────────────────────────
ALTER TABLE stays
  ALTER COLUMN wifi_download_mbps DROP NOT NULL,
  ALTER COLUMN wifi_download_mbps DROP DEFAULT,
  ALTER COLUMN wifi_upload_mbps DROP NOT NULL,
  ALTER COLUMN wifi_upload_mbps DROP DEFAULT,
  ALTER COLUMN wifi_jitter_ms DROP NOT NULL,
  ALTER COLUMN wifi_jitter_ms DROP DEFAULT,
  ALTER COLUMN wifi_tested_at DROP NOT NULL,
  ALTER COLUMN wifi_tested_at DROP DEFAULT,
  ALTER COLUMN wifi_tester_note DROP NOT NULL,
  ALTER COLUMN wifi_tester_note DROP DEFAULT;

-- ── 2. Measurement history table (created before the stays FK) ───────────────
CREATE TABLE IF NOT EXISTS wifi_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stay_id uuid NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  booking_id uuid,
  actor_user_id uuid,
  actor_role text NOT NULL CHECK (actor_role IN ('host', 'guest', 'admin')),
  source text NOT NULL CHECK (source IN ('host_manual', 'platform_measured')),
  download_mbps integer CHECK (download_mbps IS NULL OR download_mbps >= 0),
  upload_mbps integer CHECK (upload_mbps IS NULL OR upload_mbps >= 0),
  ping_ms integer CHECK (ping_ms IS NULL OR ping_ms >= 0),
  jitter_ms integer CHECK (jitter_ms IS NULL OR jitter_ms >= 0),
  tested_at timestamptz NOT NULL DEFAULT now(),
  geo_accuracy_m integer,
  distance_to_stay_m integer,
  geo_check text CHECK (
    geo_check IS NULL OR geo_check IN ('near', 'review', 'out_of_range', 'insufficient')
  ),
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wifi_measurements_stay
  ON wifi_measurements (stay_id, tested_at DESC);

-- Deny-by-default RLS, same convention as 0010 (app queries via server pool).
ALTER TABLE wifi_measurements ENABLE ROW LEVEL SECURITY;

-- ── 3. stays: ping, has-service tri-state, lifecycle status, verified link ───
ALTER TABLE stays ADD COLUMN IF NOT EXISTS wifi_ping_ms integer;
ALTER TABLE stays ADD COLUMN IF NOT EXISTS wifi_has_service boolean;
ALTER TABLE stays ADD COLUMN IF NOT EXISTS wifi_status text
  NOT NULL DEFAULT 'not_updated'
  CONSTRAINT wifi_status_check CHECK (
    wifi_status IN ('not_updated', 'host_declared', 'platform_measured', 'reverify_pending', 'verified')
  );
ALTER TABLE stays ADD COLUMN IF NOT EXISTS wifi_verified_measurement_id uuid
  REFERENCES wifi_measurements(id);

-- ── 4. Backfill (idempotent) ─────────────────────────────────────────────────
-- 4a. Existing numeric data is treated as host-declared (never auto-verified).
UPDATE stays SET wifi_status = 'host_declared'
 WHERE wifi_download_mbps IS NOT NULL;

-- 4b. Demo/seed data is NOT real verification: nothing stays verified without
--     a platform measurement backing it. Values/notes/dates are preserved.
UPDATE stays
   SET is_wifi_verified = false,
       wifi_verified_measurement_id = NULL
 WHERE is_wifi_verified = true
    OR wifi_verified_measurement_id IS NOT NULL;

-- 4c. Auto-generated draft values (createDraftStay defaults on converted
--     drafts) -> NULL + not_updated. Only the known generated rows.
UPDATE stays
   SET wifi_download_mbps = NULL,
       wifi_upload_mbps = NULL,
       wifi_jitter_ms = NULL,
       wifi_ping_ms = NULL,
       wifi_tested_at = NULL,
       wifi_tester_note = NULL,
       wifi_has_service = NULL,
       wifi_status = 'not_updated'
 WHERE slug IN ('hgjgj-conv-001', 'jhhjkh-conv-001')
   AND wifi_download_mbps = 100
   AND wifi_upload_mbps = 75;

-- ── 5. Guest Wi-Fi review criteria (reuses stay_reviews — Phase A scope) ────
-- NULL = guest skipped Wi-Fi (did not use it during the stay).
ALTER TABLE stay_reviews
  ADD COLUMN IF NOT EXISTS wifi_speed_rating integer
    CHECK (wifi_speed_rating IS NULL OR wifi_speed_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS wifi_stability_rating integer
    CHECK (wifi_stability_rating IS NULL OR wifi_stability_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS wifi_work_rating integer
    CHECK (wifi_work_rating IS NULL OR wifi_work_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS wifi_comment text;

-- ── 6. CMS guide: "Hướng dẫn kiểm tra tốc độ Wi-Fi" (vi + en, one bilingual
--      row — same pattern as seeded guides). Idempotent; editor links to
--      /guides/wifi-speed-test-guide.
INSERT INTO cms_contents (
  id, content_type, category, locale, translation_group_id, slug,
  title_en, title_vi, excerpt_en, excerpt_vi,
  body_en, body_vi, body_doc_en, body_doc_vi, published_doc_en, published_doc_vi,
  seo_title, seo_description, focus_keyword, seo_score, word_count, reading_time_minutes,
  status, author_id, published_at, schema_type
) VALUES (
  'b8000000-0000-4000-8000-0000000000f1',
  'article',
  'living_guide',
  'en',
  'b8000000-0000-4000-8000-0000000000f1',
  'wifi-speed-test-guide',
  'How to test your Wi-Fi speed',
  'Hướng dẫn kiểm tra tốc độ Wi-Fi',
  'Connect to the property Wi-Fi and run a speed test before declaring download, upload and ping for your listing.',
  'Kết nối Wi-Fi tại chỗ ở và kiểm tra tốc độ trước khi khai báo download, upload, ping cho listing.',
  '',
  '',
  $doc${"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"How to test your Wi-Fi speed"}]},{"type":"paragraph","content":[{"type":"text","text":"To give guests accurate information, connect to the Wi-Fi network at the property and run an Internet speed test before entering your results."}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Steps"}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Connect your phone or computer to the property Wi-Fi (not mobile data)."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Open a browser and visit a speed-test site such as speedtest.net or fast.com."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Start the test and wait for it to finish — note the "},{"type":"text","text":"Download","marks":[{"type":"bold"}]},{"type":"text","text":" and "},{"type":"text","text":"Upload","marks":[{"type":"bold"}]},{"type":"text","text":" figures."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Note the "},{"type":"text","text":"Ping (ms)","marks":[{"type":"bold"}]},{"type":"text","text":" shown in the results — lower is better."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Screenshot the results or copy the result link if the site provides one."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Open your listing, go to "},{"type":"text","text":"4.1 Internet & Wi-Fi","marks":[{"type":"bold"}]},{"type":"text","text":", enter the figures and test date, then paste the link (or image URL) of the result — entirely optional."}]}]}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Good to know"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Test at a few different times of day to pick the most stable result."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Only enter figures you actually measured — never estimated values."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Declaring Wi-Fi is optional and never blocks publishing."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Internet quality rated by past guests is shown separately from your declared figures."}]}]}]}]}$doc$,
  $doc${"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Hướng dẫn kiểm tra tốc độ Wi-Fi"}]},{"type":"paragraph","content":[{"type":"text","text":"Để cung cấp thông tin chính xác cho khách, hãy kết nối với mạng Wi-Fi tại chỗ ở và kiểm tra tốc độ Internet trước khi nhập kết quả."}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Các bước thực hiện"}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kết nối điện thoại hoặc máy tính với mạng Wi-Fi tại chỗ ở (không dùng dữ liệu di động)."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Mở trình duyệt và truy cập một trang kiểm tra tốc độ như speedtest.net hoặc fast.com."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bấm nút kiểm tra và chờ hoàn tất — ghi lại chỉ số "},{"type":"text","text":"Tải xuống (Download)","marks":[{"type":"bold"}]},{"type":"text","text":" và "},{"type":"text","text":"Tải lên (Upload)","marks":[{"type":"bold"}]},{"type":"text","text":"."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ghi lại "},{"type":"text","text":"Ping (ms)","marks":[{"type":"bold"}]},{"type":"text","text":" trên kết quả — càng thấp càng tốt."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Chụp ảnh màn hình kết quả hoặc sao chép đường dẫn kết quả nếu trang cung cấp."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Mở listing của bạn, vào mục "},{"type":"text","text":"4.1 Internet & Wi-Fi","marks":[{"type":"bold"}]},{"type":"text","text":", nhập các chỉ số và ngày kiểm tra, rồi dán đường dẫn (hoặc URL ảnh) kết quả — hoàn toàn không bắt buộc."}]}]}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Lưu ý"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Nên kiểm tra vào vài thời điểm khác nhau trong ngày để chọn kết quả ổn định nhất."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Chỉ khai báo chỉ số bạn thực sự đo được — không điền giá trị ước lượng."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Khai báo Wi-Fi không bắt buộc và không ảnh hưởng tới việc đăng listing."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Chất lượng Internet do khách lưu trú đánh giá sẽ được hiển thị riêng, tách biệt với thông số bạn khai báo."}]}]}]}]}$doc$,
  $doc${"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"How to test your Wi-Fi speed"}]},{"type":"paragraph","content":[{"type":"text","text":"To give guests accurate information, connect to the Wi-Fi network at the property and run an Internet speed test before entering your results."}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Steps"}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Connect your phone or computer to the property Wi-Fi (not mobile data)."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Open a browser and visit a speed-test site such as speedtest.net or fast.com."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Start the test and wait for it to finish — note the "},{"type":"text","text":"Download","marks":[{"type":"bold"}]},{"type":"text","text":" and "},{"type":"text","text":"Upload","marks":[{"type":"bold"}]},{"type":"text","text":" figures."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Note the "},{"type":"text","text":"Ping (ms)","marks":[{"type":"bold"}]},{"type":"text","text":" shown in the results — lower is better."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Screenshot the results or copy the result link if the site provides one."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Open your listing, go to "},{"type":"text","text":"4.1 Internet & Wi-Fi","marks":[{"type":"bold"}]},{"type":"text","text":", enter the figures and test date, then paste the link (or image URL) of the result — entirely optional."}]}]}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Good to know"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Test at a few different times of day to pick the most stable result."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Only enter figures you actually measured — never estimated values."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Declaring Wi-Fi is optional and never blocks publishing."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Internet quality rated by past guests is shown separately from your declared figures."}]}]}]}]}$doc$,
  $doc${"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Hướng dẫn kiểm tra tốc độ Wi-Fi"}]},{"type":"paragraph","content":[{"type":"text","text":"Để cung cấp thông tin chính xác cho khách, hãy kết nối với mạng Wi-Fi tại chỗ ở và kiểm tra tốc độ Internet trước khi nhập kết quả."}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Các bước thực hiện"}]},{"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Kết nối điện thoại hoặc máy tính với mạng Wi-Fi tại chỗ ở (không dùng dữ liệu di động)."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Mở trình duyệt và truy cập một trang kiểm tra tốc độ như speedtest.net hoặc fast.com."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Bấm nút kiểm tra và chờ hoàn tất — ghi lại chỉ số "},{"type":"text","text":"Tải xuống (Download)","marks":[{"type":"bold"}]},{"type":"text","text":" và "},{"type":"text","text":"Tải lên (Upload)","marks":[{"type":"bold"}]},{"type":"text","text":"."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Ghi lại "},{"type":"text","text":"Ping (ms)","marks":[{"type":"bold"}]},{"type":"text","text":" trên kết quả — càng thấp càng tốt."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Chụp ảnh màn hình kết quả hoặc sao chép đường dẫn kết quả nếu trang cung cấp."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Mở listing của bạn, vào mục "},{"type":"text","text":"4.1 Internet & Wi-Fi","marks":[{"type":"bold"}]},{"type":"text","text":", nhập các chỉ số và ngày kiểm tra, rồi dán đường dẫn (hoặc URL ảnh) kết quả — hoàn toàn không bắt buộc."}]}]}]},{"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"Lưu ý"}]},{"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Nên kiểm tra vào vài thời điểm khác nhau trong ngày để chọn kết quả ổn định nhất."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Chỉ khai báo chỉ số bạn thực sự đo được — không điền giá trị ước lượng."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Khai báo Wi-Fi không bắt buộc và không ảnh hưởng tới việc đăng listing."}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Chất lượng Internet do khách lưu trú đánh giá sẽ được hiển thị riêng, tách biệt với thông số bạn khai báo."}]}]}]}]}$doc$,
  'Wi-Fi Speed Test Guide | VietNomad Stays',
  'How hosts measure and declare accurate Wi-Fi speed: connect to the property network, run a speed test, and record download, upload, ping and test date.',
  'Wi-Fi speed test',
  80,
  340,
  4,
  'published',
  -- Seeds may run AFTER migrations on a fresh DB: only stamp the editorial
  -- author when that user already exists (prod does; test env backfills later
  -- and simply shows no author on this row).
  CASE WHEN EXISTS (SELECT 1 FROM users WHERE id = '10000000-0000-4000-8000-000000000005')
    THEN '10000000-0000-4000-8000-000000000005'::uuid
    ELSE NULL
  END,
  NOW(),
  'Article'
) ON CONFLICT (id) DO NOTHING;
