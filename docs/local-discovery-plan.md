# Phương án triển khai — Local Discovery Phase1 (2026-11-28)

> **STATUS: IMPLEMENTED** (2026-11-28, branch `arena/5db5efca-staynearby`).
> Migration `0013_local_discovery.sql` applied to **dev** (du_lich Supabase +
> local PGlite); prod pending approval. Q2 decision: keep existing
> `data_source='curated_team'` rows untouched — only new-row defaults changed.
> Regression: tsc0 · lint0 · 156/156 · build0 · `tests/local-discovery.test.ts`
> (11 cases) covers host → moderation → guest lifecycle with RBAC checks.

> Phạm vi: xây dữ liệu địa điểm · đóng góp của chủ nhà · kiểm duyệt của VietNomad ·
> trải nghiệm khám phá của khách. **Không** nghiệp vụ thương mại, mã giới thiệu, hoa
> hồng, chia sẻ doanh thu, Google Places API trả phí, khách tự đăng địa điểm.
>
> Branch: `arena/5db5efca-staynearby` (base `7195322`). Code + migration file only;
> **không apply migration prod, không merge, không deploy khi chưa phê duyệt.**

---

## A. Audit hiện trạng (đã đọc code)

### A1. Tái sử dụng được ngay

| Thành phần | Vị trí | Ghi chú |
|---|---|---|
| `places` | `0006_admin_bos.sql:406` + `0009:29-63` | category 11 giá trị, `rating/review_count` nullable, `data_source`, `verification_status` (unverified/verified/outdated), `last_verified_at`, `partner_id`, `is_featured` |
| `stay_nearby_places` | `0006:431` | PK(stay_id, place_id) + `distance_label` — **chưa có** nguồn/host/thời điểm |
| `local_partners` | `0006:372` | giữ nguyên, không mở rộng nghiệp vụ thương mại |
| `stays.nearby_coworking` | JSONB, schema `listing-form-schema.ts:85` (max 8) | API PATCH có nhận (`host.ts:924`) nhưng **chưa có UI input** |
| `stays.lat/lng` | thêm ở `0009:14-15` | cột tồn tại nhưng **chưa từng được ghi** — bán kính chưa tính được |
| Admin Discovery | `/admin/growth/discovery` + `/api/admin/growth?scope=places` | RBAC `discovery/view` ✓, filters dest/category/q, `createAdminPlace/updateAdminPlace/deleteAdminPlace` + `logAdminAudit` |
| Host ownership pattern | `host.ts:877` (`host_id` check + FOR UPDATE) | nhân cho API mới |
| Guest queries | `catalog.ts:785` (stay detail), `catalog.ts:1058` (destination) | cùng nguồn `places`, filter `verified` |
| Guest UI | `StayNeighborhoodExplore` → `LocalPlaceCard` → `LocalPlaceDetailModal` | whole-card click, Escape/focus/scroll-lock, giữ state đặt phòng |
| Taxonomy | `i18n.ts:179 normalizePlaceExploreGroup` | 10 nhóm tab — tái dùng, không tạo phân loại mới |
| CMS | place block (`VietNomadBlockViews:253`), link check `content-service:486` | tự bỏ place `outdated` |
| Tracking | `/api/track` + `attribution_events` (CHECK event mở rộng ở `0008:265`, có `dedupe_key`, `is_internal`) + `trackClientEvent` (`lib/attribution.ts:122`) | mở rộng thêm event là được |
| Config | `platform_settings` qua `getPlatformFeeConfig` pattern | đặt radii bán kính tại đây |
| Rate limit | `lib/rate-limit.ts` + `tests/rate-limit.test.ts` | thêm rule cho endpoint suggestion |

### A2. Vấn đề phát hiện (bug/lỗ hổng chất lượng dữ liệu)

1. **`api/admin/growth` place category enum cũ** (`route.ts:78-88`) chỉ có 9 giá trị —
   thiếu `shopping`, `experience` mà 0009 đã thêm → tạo place 2 nhóm này qua API sẽ fail validation.
2. **Giờ mở cửa/giá mặc định giả**: SQL `DEFAULT '08:00 - 22:00'` / `'$$'` **và**
   `createAdminPlace` (`growth.ts:~285`) cũng `?? '08:00 - 22:00'` → dữ liệu không thật.
3. **Seed = `verified` + `data_source='curated_team'`** → không phân biệt demo/đã xác minh.
4. **Không có bảng đề xuất/kiểm duyệt** nào cho đóng góp của host.
5. **`stay_nearby_places` không ghi nguồn, chủ nhà đề xuất, host_note, thời điểm.**
6. **Khử trùng theo tên** trong `combinedPlaces` (chỉ áp cho merge legacy coworking —
   rủi ro nếu mở rộng sai) — spec cấm khử trùng theo tên giữa các place.
7. **Không có tọa độ stay/neighborhood/destination** (chỉ `map_x/map_y` pixel) →
   thuật toán bán kính (spec §7) chưa thể tính haversine hôm nay.
8. Growth GET/POST các scope khác đã check quyền; scope `places` fall-through
   `requireAdminPermission('discovery','view')` ✓ — giữ nguyên pattern này cho scope mới.

---

## B. Thiết kế đề xuất

### B1. Migration `0013_local_discovery.sql` (file + apply DEV; prod chờ phê duyệt)

```sql
-- 1) Bảng đề xuất địa điểm của chủ nhà
CREATE TABLE place_suggestions (
  id UUID PRIMARY KEY,
  stay_id UUID NOT NULL REFERENCES stays(id) ON DELETE CASCADE,
  suggested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id) ON DELETE SET NULL,   -- chọn nơi có sẵn
  category TEXT NOT NULL CHECK (category IN (...11 giá trị 0009...)),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  google_maps_url TEXT NOT NULL DEFAULT '',
  lat NUMERIC(9,6), lng NUMERIC(9,6),                       -- parse từ link Maps nếu có
  reason TEXT NOT NULL DEFAULT '',                          -- lý do giới thiệu (1 field, host tự viết)
  distance_label TEXT NOT NULL DEFAULT '',                  -- "4 phút đi bộ" nếu host tự biết — KHÔNG bịa
  image_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','needs_info','approved','rejected')),
  review_note TEXT NOT NULL DEFAULT '',                    -- staff phản hồi
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_place_sug_stay ON place_suggestions(stay_id, status);
CREATE INDEX idx_place_sug_place ON place_suggestions(place_id) WHERE place_id IS NOT NULL;
CREATE INDEX idx_place_sug_status ON place_suggestions(status, created_at);

-- 2) Nâng cấp liên kết stay ↔ place
ALTER TABLE stay_nearby_places
  ADD COLUMN source TEXT NOT NULL DEFAULT 'curated'
    CHECK (source IN ('curated','host_suggested')),
  ADD COLUMN suggested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN host_note TEXT NOT NULL DEFAULT '',            -- lý do host giới thiệu khi hiển thị
  ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3) places: bổ sung trường + bỏ默认 giả
ALTER TABLE places
  ADD COLUMN website TEXT NOT NULL DEFAULT '',
  ADD COLUMN google_maps_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN external_place_id TEXT,                        --预留 Google place id (không gọi API)
  ADD COLUMN is_onsite BOOLEAN NOT NULL DEFAULT FALSE,      -- tier1 "ngay tại chỗ ở/nội khu"
  ADD COLUMN reviewed_by UUID REFERENCES users(id),
  ADD COLUMN created_by TEXT NOT NULL DEFAULT '';           -- 'admin' | 'host_suggestion' | 'seed'
ALTER TABLE places ALTER COLUMN opening_hours SET DEFAULT '';
ALTER TABLE places ALTER COLUMN price_range  SET DEFAULT '';
UPDATE places SET opening_hours = '' WHERE opening_hours = '08:00 - 22:00' AND data_source <> 'curated_team';
-- (phần UPDATE dữ liệu seed → xem Q2)

-- 4) Tracking cơ bản
ALTER TABLE attribution_events ADD COLUMN place_id UUID REFERENCES places(id) ON DELETE SET NULL;
ALTER TABLE attribution_events DROP CONSTRAINT attribution_events_event_name_check;
ALTER TABLE attribution_events ADD CONSTRAINT attribution_events_event_name_check
  CHECK (event_name IN ('page_view','article_view','destination_view','search','stay_view',
                        'checkout_start','booking_completed',
                        'place_detail_view','place_map_click','place_website_click'));
CREATE INDEX idx_attr_events_place ON attribution_events(place_id, event_name, created_at DESC)
  WHERE place_id IS NOT NULL;
```

- **Không** drop cột `nearby_coworking`; **không** xóa bản ghi cũ.
- Category CHECK giữ 11 giá trị sẵn có (0009) — form host chỉ chọn các nhóm map vào
  taxonomy hiện tại (xem B2), **không** thêm giá trị mới.
- Radii bán kính: `platform_settings` key `local_discovery`
  `{ "radiiMeters": { "essential":500, "cafe":1000, "restaurant":2000, "coworking":3000,
     "gym_yoga":3000, "shopping":5000, "entertainment":5000, "event_venue":5000,
     "transport":2000, "attraction":30000, "experience":30000 } }`
  — đọc qua `getLocalDiscoveryConfig()` (pattern `getPlatformFeeConfig`), **không hardcode trong component**.

### B2. Đóng góp của chủ nhà (Host Console)

**API mới** (mọi route: `requireRole(['host'])` + check `stay.host_id === user.id` —
pattern `host.ts:877`; rate-limit rule riêng cho POST):

| Method | Path | Việc |
|---|---|---|
| GET | `/api/host/stays/[id]/local-places` | danh sách link + suggestion của listing này (kèm status) |
| GET | `/api/host/stays/[id]/local-places/search?q=` | tìm place đã tồn tại (verified, boost cùng destination) |
| POST | `/api/host/stays/[id]/local-places` | gửi đề xuất (chọn place có sẵn → place_id; hoặc form mới) |
| PATCH | `/api/host/stays/[id]/local-places/suggestions/[sid]` | sửa đề xuất của mình khi `pending/rejected` (resubmit) |
| PATCH | `/api/host/stays/[id]/local-places/links/[placeId]` | sửa `host_note` trên link của mình |
| DELETE | `/api/host/stays/[id]/local-places/links/[placeId]` | gỡ liên kết (chỉ xóa quan hệ, KHÔNG xóa place) |

Module mới `src/modules/host-local-places.ts` — tái dùng `dbQuery`, `AppError`,
ownership pattern; **không** đụng `updateHostStayConfiguration`.

**Form đề xuất** (đúng spec §3 — đơn giản, không hỏi quan hệ thương mại):
tên · danh mục (11 category hiện tại, label theo nhóm spec: Nhà hàng/Quà café/Coworking/
Siêu thị tiện lợi(`essential`)/Gym-Yoga/Spa-Wellness(`gym_yoga`)/Giải trí(`entertainment`)/
Tham quan(`attraction`+`experience`)/Thuê xe(`transport`)/Giặt là(`essential`)/Khác(`essential`))
· địa chỉ **hoặc** link Google Maps (parse `@lat,lng` — không cần API trả phí) ·
lý do giới thiệu · khoảng cách/thời gian nếu biết (text) · ảnh optional.
Không hỏi giờ mở cửa, giá, rating, mô tả dài.

**UI**: section mới trong `SECTION_DEFS` của `HostListingEditorClient`
(chèn sau `location`, renumber các mục sau — tests không assert label):
`6. Local Recommendations / Giới thiệu khu vực`. Nội dung: bảng link + suggestion
của listing (tên, nhóm, trạng thái dạng **nhãn chữ**, note của host, thao tác
sửa/gỡ/Thêm địa điểm). Trạng thái: `Chờ duyệt / Đã duyệt / Cần bổ sung thông tin /
Không được duyệt`. Optional — không bắt buộc publish listing.
**Wizard tạo listing không đổi** (11 bước giữ nguyên) theo đúng "mục riêng trong Editor".

### B3. Kiểm duyệt — Admin BOS (`/admin/growth/discovery`)

- `admin-bos/growth.ts` thêm:
  - `listPlaceSuggestions({status, stayId, q})` — join stay title + host display name
    (`formatHostDisplayName`, không lộ email/username thô);
  - `reviewPlaceSuggestion(actor, id, {action, note})` — `approve`:
    nếu chưa có place → tạo place (`data_source='host_suggested'`, `verification_status='unverified'`
    tới khi staff bổ sung → `verified` + `reviewed_by`) rồi INSERT link
    (`source='host_suggested'`, `suggested_by`, `host_note=reason`, `distance_label`);
    `needs_info` / `reject` + `review_note`; mọi action → `logAdminAudit`.
  - `listAdminPlaces` mở rộng: filter theo tab, đếm `linked_stays`, `host_suggesters`,
    trả `website/google_maps_url/is_onsite/data_source/last_verified_at/reviewed_by`;
  - `updateAdminPlace` nhận thêm field mô tả/website/maps/onsite/verify/hide;
  - sửa enum category thiếu `shopping`,`experience` (bug A2.1).
- `/api/admin/growth`: GET `scope=suggestions` (fall-through `discovery/view`),
  POST `kind=suggestion_review` + `kind:'place'` mở rộng field (permission `discovery/edit`).
- `GrowthClient` → tab: **Tất cả · Chờ duyệt · Đã công khai · Cần bổ sung · Cần cập nhật
  (outdated)** + bảng dữ liệu, tìm kiếm, drawer chi tiết (form chuyên nghiệp, ít badge/icon).
  Thao tác: duyệt/từ chối, edit, verify, tạm ẩn (`outdated` — guest query đã loại),
  cảnh báo trùng (cùng tên + cùng destination → warning cho staff, **không** auto-merge),
  xem danh sách host đã đề xuất + listing đang liên kết.

### B4. Thuật toán đề xuất địa điểm (guest — `catalog.ts`)

Xếp hạng (CTE, LIMIT 12, chỉ `verified`):

| Tier | Tín hiệu | Nguồn dữ liệu |
|---|---|---|
| 1 | `is_onsite = TRUE` | place flag (admin) |
| 2 | link `source='host_suggested'` đã duyệt | `stay_nearby_places` |
| 3 | link `source='curated'` (VietNomad gắn thẳng cho listing) | `stay_nearby_places` |
| 4 | trong bán kính (chỉ khi **cả stay và place có toạ độ**) | haversine + config radii |
| 5 | `is_featured` cùng destination (lọc thêm nếu cùng neighborhood) | fallback lấp chỗ |

- **Không** khử trùng theo tên giữa 2 place row (brand nhiều chi nhánh = 2 row).
  Merge legacy `nearby_coworking` JSONB: chỉ khử trùng **bên legacy** với place đã
  liên kết (normalized name) để tránh 1 thẻ đôi — ghi chú rõ trong code.
- **Khoảng cách hiển thị**: ưu tiên `distance_label` (người thật nhập) → nếu cả 2 có
  toạ độ thì `≈800 m` / `≈1,2 km` (làm tròn, **không** tự tạo "N phút đi bộ") →
  nếu không có dữ liệu thì **không hiển thị**.
- **Privacy**: không render toạ độ/khoảng cách tuyệt đối từ stay; chỉ nêu khoảng
  cách tương đối làm tròn; không lộ `stays.lat/lng` trong bất kỳ payload guest nào.
- **Fallback khi stay chưa có toạ độ** (trạng thái hiện tại): bỏ tier 4, dùng
  tier 1-3-5 — không bịa tọa độ.
- Nguồn cấp toạ độ stay (mở khoá tier4): thêm field optional
  `stays.google_maps_url`... **không** — dùng luôn cột `stays.lat/lng` đã có:
  location step + editor thêm ô "Dán link Google Maps của chỗ ở" (optional),
  parse `@lat,lng` ghi `stays.lat/lng` (pattern giống form host, không API trả phí).

### B5. Guest Platform UI (không redesign)

- **Card**: giữ nguyên bố cục hiện tại; thêm dòng "Được chủ nhà giới thiệu" là
  **nhãn chữ trong modal** (không badge mới trên thẻ).
- **Modal** (`LocalPlaceDetailModal`): thêm hàng **Website** (nếu có) + nút Maps/
  chỉ đường (đã có) + **lý do host giới thiệu** (`host_note`, nếu có) + nguồn dữ liệu
  (nhãn chữ: "Chủ nhà giới thiệu" / "VietNomad xác minh"). Chỉ render hàng có dữ liệu.
  Đóng modal không mất ngày/khách/lựa chọn đặt phòng (đã đảm bảo — giữ nguyên).
- **Reuse**: destination page (`DestinationPlacesExplorer`), CMS place block,
  stay detail cùng đọc `places` — không API/module mới; `getDestinationLocalPlaces`
  áp cùng filter `verified` + bỏ `outdated` (đã có).

### B6. Tracking cơ bản (§11)

- `lib/attribution.ts trackClientEvent` + `/api/track`: thêm `place_detail_view`
  (mở modal), `place_map_click`, `place_website_click`; truyền `placeId`,
  nguồn suy từ `landingPath` (`/stays/…` vs destination) — tái dùng field có sẵn.
- Số chủ nhà đề xuất / số listing liên kết: aggregate SQL trong admin list
  (`COUNT(DISTINCT suggested_by)`, `COUNT(DISTINCT stay_id)`) — **không** dashboard mới.
- Không tính lượt tương tác = giao dịch thương mại.

### B7. Chất lượng dữ liệu (§9)

1. Migration đổi DEFAULT `opening_hours/price_range` → `''`; sửa luôn
   `createAdminPlace` bỏ `?? '08:00 - 22:00'`; zod API không default giá trị giờ/giá.
2. `seed-bos.ts`: `data_source='seed_demo'`; giờ mở cửa/giá để trống khi không có
   thật; ảnh chỉ dùng đúng place; perk chỉ hiện khi `partnership_status='active'` (đã đúng).
3. Đánh dấu dữ liệu hiện có (xem Q2) để admin phân biệt demo ↔ đã xác minh.
4. `rating/review_count` giữ `NULL` khi không có nguồn thật — không tự tạo.
5. Place `outdated` vào tab "Cần cập nhật", không auto-delete (giữ link CMS/SEO).

### B8. Bảo mật / RBAC / kiểm thử

- **Host**: mọi endpoint local-places check `stay.host_id` ở backend (403 pattern
  `host.ts:877`); host chỉ sửa được suggestion/link của chính mình; không đụng place
  đã verify.
- **Admin**: `requireAdminPermission('discovery','view'|'edit')` cho scope mới;
  mọi thao tác ghi `admin_audit_logs`.
- **Guest**: API chỉ trả place `verified` + link đã duyệt; không leak
  `place_suggestions` (pending) ra guest.
- **Rate limit**: rule cho `POST /api/host/stays/*/local-places`.
- **Tests** (mở rộng `tests/`):
  - unit: parse link Maps → lat/lng; haversine + radii config; thứ tự rank;
    suggestion zod; enum category đủ 11.
  - integration: lifecycle `pending → approve → link → guest thấy`;
    `reject/needs_info` không hiện; gỡ link không xóa place; ownership 403 host khác;
    track event insert; admin audit ghi.
  - regression: `tsc 0 · lint 0 · npm test · npm run build` toàn bộ.

### B9. Chuyển đổi `nearby_coworking` (rà soát — chưa chạy)

- **Giai đoạn này giữ nguyên JSONB** (vẫn hiển thị như nguồn legacy, merge cẩn thận B4).
- Viết sẵn phương án script (dev-only): mỗi dòng JSONB → `places`
  (`data_source='host_coworking_legacy'`, `unverified`) + link `source='host_suggested'`
  — **chỉ chạy sau** khi có test + admin duyệt; không drop cột, không xóa dữ liệu cũ.

---

## C. Thứ tự thực hiện (theo §13) & commit

1. **M1** — migration `0013` + data-quality fixes (defaults, enum bug, seed flags) + test.
2. **M2** — host module + API + editor section "Giới thiệu khu vực" + test RBAC.
3. **M3** — admin: suggestion review + tabs/filters/table + audit + test.
4. **M4** — ranking algorithm + config radii + guest UI (modal website/nhãn nguồn) + tracking.
5. **M5** — regression toàn bộ · docs (`AGENTS.md`, `docs/UI_PRINCIPLES.md` mục Local Discovery) · báo cáo.

Mỗi milestone tách commit; dự kiến **1 PR** vào cuối (hoặc tách M1+M2 / M3+M4 nếu bạn muốn review từng phần).

## D. Ngoài phạm vi (§12 — không đụng tới)

Quan hệ thương mại host↔địa điểm · mã giới thiệu/hoa hồng/chia sẻ doanh thu ·
tính hoa hồng · auto-lead CRM · Partner Portal · ví/chi trả · đặt & thanh toán dịch vụ
địa phương · hội viên trả phí · Google Places API trả phí · khách tự đăng địa điểm ·
bảng/API thương mại phục vụ trước. Giữ nguyên `local_partners` + perk đang hoạt động.

---

## E. Câu hỏi cần bạn xác nhận

- **Q1 — Migration**: tạo file `0013_local_discovery.sql` và **apply vào DB dev
  (du_lich)** ngay để test; prod chờ duyệt sau. (Khuyến nghị: apply dev.)
- **Q2 — Dữ liệu seed hiện có**: đánh dấu toàn bộ rows hiện tại
  `data_source='seed_demo'` (giữ hiển thị như hiện nay, admin phân biệt được demo ↔
  xác minh, không tự coi là verified thật). (Khuyến nghị: có — chạy trên dev; prod
  chạy cùng statement khi approve.)
- **Q3 — Toạ độ chỗ ở**: thêm ô optional "Dán link Google Maps" ở Location
  (editor + wizard) để ghi `stays.lat/lng`, unlock tier bán kính theo spec §7.
  (Khuyến nghị: làm — không tốn API trả phí.)
- **Q4 — Giao diện host**: thêm section mới trong Editor (không thêm bước wizard).
  (Khuyến nghị: đúng như spec.)
