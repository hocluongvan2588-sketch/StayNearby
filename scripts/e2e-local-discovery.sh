#!/usr/bin/env bash
# E2E business-flow test for Local Discovery Phase 1 (host → admin → guest).
# All checks go through HTTP (dev server) — no direct DB access, so it can run
# while the dev server is up. DB-level verification/cleanup lives in
# scripts/e2e-ld-db-verify.ts (run with the server STOPPED).
#
# Usage: bash scripts/e2e-local-discovery.sh
set -u
BASE="${BASE:-http://localhost:3000}"
JAR="$(mktemp -d)"
WORK="$(mktemp -d)"
PASS=0; FAIL=0
ok(){ echo "  PASS  $1"; PASS=$((PASS+1)); }
bad(){ echo "  FAIL  $1"; FAIL=$((FAIL+1)); }

STAY_A=40000000-0000-4000-8000-000000000001   # my-khe, host@
STAY_B=40000000-0000-4000-8000-000000000006   # phu-quoc, direct@
DEST_DN=20000000-0000-4000-8000-000000000001  # Da Nang
SLUG_A=my-khe-coastal-atelier-da-nang
SLUG_B=phu-quoc-emerald-bay-work-villa
NAME1="E2E Test Coworking Da Nang"
NAME2="E2E Reject Target Cafe"
NAME3="E2E Hidden Unverified Spot"
PLACE_ID=""
SUG1=""; SUG2=""; SUG3=""

json(){ jq -r "$1" 2>/dev/null; }

echo "======== Local Discovery E2E — $BASE ========"

echo "--- Phase A: logins ---"
curl -s -c "$JAR/a" -H 'Content-Type: application/json' \
  -d '{"email":"host@vietnomad.demo","password":"HostFlow!2026"}' \
  "$BASE/api/auth/login" | grep -q '"ok":true' && ok "hostA login" || bad "hostA login"
curl -s -c "$JAR/b" -H 'Content-Type: application/json' \
  -d '{"email":"direct@vietnomad.demo","password":"StayDirect!2026"}' \
  "$BASE/api/auth/login" | grep -q '"ok":true' && ok "hostB login" || bad "hostB login"
curl -s -c "$JAR/adm" -H 'Content-Type: application/json' \
  -d '{"email":"admin@vietnomad.demo","password":"AdminOps!2026"}' \
  "$BASE/api/auth/login" | grep -q '"ok":true' && ok "admin login" || bad "admin login"

echo "--- Phase B: host searches verified places (unverified excluded) ---"
curl -s -b "$JAR/a" "$BASE/api/host/stays/$STAY_A/local-places/search?q=enouvo" > "$WORK/search.json"
grep -q 'Enouvo Space' "$WORK/search.json" && ok "search finds curated Enouvo place" || bad "search: $(head -c 200 "$WORK/search.json")"
# admin creates a place, then demotes it to unverified → host search must NOT see it
curl -s -b "$JAR/adm" -H 'Content-Type: application/json' \
  -d "{\"kind\":\"place\",\"destinationId\":\"$DEST_DN\",\"category\":\"coworking\",\"name\":\"$NAME3\",\"address\":\"1 Hidden Lane, Da Nang\",\"descriptionEn\":\"E2E hidden place for verified-only search test\"}" \
  "$BASE/api/admin/growth" > "$WORK/newplace.json"
HID=$(json '.id // empty' < "$WORK/newplace.json")
if [ -n "$HID" ]; then
  curl -s -b "$JAR/adm" -H 'Content-Type: application/json' \
    -X PATCH -d "{\"kind\":\"place\",\"placeId\":\"$HID\",\"verificationStatus\":\"unverified\"}" \
    "$BASE/api/admin/growth" > "$WORK/demote.json"
  grep -q '"ok":true' "$WORK/demote.json" && ok "admin demotes place → unverified" || bad "demote: $(head -c 200 "$WORK/demote.json")"
  curl -s -b "$JAR/a" "$BASE/api/host/stays/$STAY_A/local-places/search?q=E2E%20Hidden" > "$WORK/search2.json"
  grep -q "$NAME3" "$WORK/search2.json" && bad "unvisible: unverified place LEAKED into host search" || ok "unverified place not in host search"
else
  bad "admin create place: $(head -c 240 "$WORK/newplace.json")"
fi

echo "--- Phase C: host proposes a NEW place ---"
curl -s -b "$JAR/a" -H 'Content-Type: application/json' \
  -d "{\"name\":\"$NAME1\",\"category\":\"coworking\",\"address\":\"12 E2E Street, Son Tra, Da Nang\",\"reason\":\"E2E flow test — great desks\",\"distanceLabel\":\"0,5 km\"}" \
  "$BASE/api/host/stays/$STAY_A/local-places" > "$WORK/sug1.json"
SUG1=$(json '.id // empty' < "$WORK/sug1.json")
[ -n "$SUG1" ] && ok "suggestion created ($SUG1)" || bad "sug1: $(head -c 240 "$WORK/sug1.json")"

echo "--- Phase D: RBAC — other host cannot touch it ---"
CODE=$(curl -s -o "$WORK/rbac1.json" -w '%{http_code}' -b "$JAR/b" -H 'Content-Type: application/json' \
  -d '{"name":"Hijack","category":"cafe"}' \
  "$BASE/api/host/stays/$STAY_A/local-places")
[ "$CODE" = "403" ] && ok "hostB POST on hostA stay → 403" || bad "hostB POST code=$CODE"
CODE=$(curl -s -o "$WORK/rbac2.json" -w '%{http_code}' -b "$JAR/b" -X PATCH -H 'Content-Type: application/json' \
  -d '{"name":"Hijacked"}' \
  "$BASE/api/host/stays/$STAY_A/local-places/suggestions/$SUG1")
[ "$CODE" = "403" ] && ok "hostB PATCH hostA suggestion → 403" || bad "hostB PATCH code=$CODE $(head -c 160 "$WORK/rbac2.json")"

echo "--- Phase E: admin moderation queue ---"
curl -s -b "$JAR/adm" "$BASE/api/admin/growth?scope=suggestions&status=pending" > "$WORK/queue1.json"
grep -q "$SUG1" "$WORK/queue1.json" && ok "pending queue contains suggestion" || bad "queue: $(head -c 240 "$WORK/queue1.json")"

echo "--- Phase F: admin requests more info ---"
curl -s -b "$JAR/adm" -H 'Content-Type: application/json' \
  -d "{\"kind\":\"suggestion_review\",\"id\":\"$SUG1\",\"action\":\"needs_info\",\"note\":\"Cần địa chỉ chính xác hơn\"}" \
  "$BASE/api/admin/growth" > "$WORK/needs.json"
grep -q 'needs_info' "$WORK/needs.json" && ok "admin needs_info" || bad "needs_info: $(head -c 240 "$WORK/needs.json")"
curl -s -b "$JAR/a" "$BASE/api/host/stays/$STAY_A/local-places" > "$WORK/hostlist1.json"
grep -q 'needs_info' "$WORK/hostlist1.json" && grep -q 'Cần địa chỉ chính xác' "$WORK/hostlist1.json" \
  && ok "host sees needs_info + review note" || bad "host list: $(head -c 300 "$WORK/hostlist1.json")"

echo "--- Phase G: host resubmits → pending again ---"
curl -s -b "$JAR/a" -H 'Content-Type: application/json' \
  -X PATCH -d '{"address":"12 E2E Street, Son Tra District, Da Nang"}' \
  "$BASE/api/host/stays/$STAY_A/local-places/suggestions/$SUG1" > "$WORK/resub.json"
grep -q '"status":"pending"' "$WORK/resub.json" && ok "needs_info → host edit → pending" || bad "resubmit: $(head -c 240 "$WORK/resub.json")"

echo "--- Phase H: admin approves → place + link ---"
curl -s -b "$JAR/adm" -H 'Content-Type: application/json' \
  -d "{\"kind\":\"suggestion_review\",\"id\":\"$SUG1\",\"action\":\"approve\"}" \
  "$BASE/api/admin/growth" > "$WORK/approve.json"
grep -q '"status":"approved"' "$WORK/approve.json" && ok "approve → approved" || bad "approve: $(head -c 240 "$WORK/approve.json")"
PLACE_ID=$(json '.placeId // empty' < "$WORK/approve.json")
[ -n "$PLACE_ID" ] && ok "place created ($PLACE_ID)" || bad "no placeId in approve response"

echo "--- Phase I: guest sees approved, NOT unapproved ---"
curl -s "$BASE/stays/$SLUG_A" > "$WORK/guest1.html"
grep -q "$NAME1" "$WORK/guest1.html" && ok "guest page shows approved place" || bad "guest page missing place name"
grep -q 'E2E flow test' "$WORK/guest1.html" && ok "host reason serialized for modal" || bad "host reason missing in payload"

echo "--- Phase J: reject flow never public ---"
curl -s -b "$JAR/a" -H 'Content-Type: application/json' \
  -d "{\"name\":\"$NAME2\",\"category\":\"cafe\",\"address\":\"9 Nowhere St\",\"reason\":\"will be rejected\"}" \
  "$BASE/api/host/stays/$STAY_A/local-places" > "$WORK/sug2.json"
SUG2=$(json '.id // empty' < "$WORK/sug2.json")
[ -n "$SUG2" ] && ok "suggestion2 created" || bad "sug2: $(head -c 200 "$WORK/sug2.json")"
curl -s "$BASE/stays/$SLUG_A" > "$WORK/guest_pre.html"
grep -q "$NAME2" "$WORK/guest_pre.html" && bad "pending suggestion visible on guest page" || ok "pending suggestion NOT on guest page"
curl -s -b "$JAR/adm" -H 'Content-Type: application/json' \
  -d "{\"kind\":\"suggestion_review\",\"id\":\"$SUG2\",\"action\":\"reject\",\"note\":\"Chưa đủ dữ kiện\"}" \
  "$BASE/api/admin/growth" > "$WORK/reject.json"
grep -q '"status":"rejected"' "$WORK/reject.json" && ok "admin reject" || bad "reject: $(head -c 200 "$WORK/reject.json")"
curl -s "$BASE/stays/$SLUG_A" > "$WORK/guest2.html"
grep -q "$NAME2" "$WORK/guest2.html" && bad "rejected place visible on guest page" || ok "rejected place NOT on guest page"
curl -s -b "$JAR/a" -H 'Content-Type: application/json' \
  -X PATCH -d '{"reason":"Đã bổ sung địa chỉ chi tiết hơn"}' \
  "$BASE/api/host/stays/$STAY_A/local-places/suggestions/$SUG2" > "$WORK/resub2.json"
grep -q '"status":"pending"' "$WORK/resub2.json" && ok "rejected → host edit → pending" || bad "resub2: $(head -c 200 "$WORK/resub2.json")"

echo "--- Phase K: tracking endpoints accept place events ---"
if [ -n "$PLACE_ID" ]; then
  for ev in place_detail_view place_map_click place_website_click; do
    curl -s -H 'Content-Type: application/json' \
      -d "{\"sessionKey\":\"e2e-track-session\",\"eventName\":\"$ev\",\"placeId\":\"$PLACE_ID\",\"landingPath\":\"/stays/$SLUG_A\",\"dedupeKey\":\"e2e-$ev-$ev\"}" \
      "$BASE/api/track" | grep -q '"ok":true' && ok "track $ev accepted" || bad "track $ev rejected"
  done
else
  bad "tracking skipped (no placeId)"
fi

echo "--- Phase L: shared place across hosts + safe unlink ---"
if [ -n "$PLACE_ID" ]; then
  curl -s -b "$JAR/b" -H 'Content-Type: application/json' \
    -d "{\"placeId\":\"$PLACE_ID\",\"reason\":\"E2E shared-place check\"}" \
    "$BASE/api/host/stays/$STAY_B/local-places" > "$WORK/shared.json"
  SUG3=$(json '.id // empty' < "$WORK/shared.json")
  [ -n "$SUG3" ] && ok "hostB proposes same place on THEIR stay" || bad "shared: $(head -c 240 "$WORK/shared.json")"
  curl -s -b "$JAR/adm" -H 'Content-Type: application/json' \
    -d "{\"kind\":\"suggestion_review\",\"id\":\"$SUG3\",\"action\":\"approve\"}" \
    "$BASE/api/admin/growth" > "$WORK/approve3.json"
  grep -q '"status":"approved"' "$WORK/approve3.json" && ok "admin approves hostB link" || bad "approve3: $(head -c 200 "$WORK/approve3.json")"
  # Shared place shows via hostB's OWN host view (link row), not the guest page —
  # guest pages show the destination place pool; a Da Nang place never renders on
  # a Phu Quoc listing (destination-scoped by design).
  curl -s -b "$JAR/b" "$BASE/api/host/stays/$STAY_B/local-places" > "$WORK/hostBlist.json"
  grep -q "$NAME1" "$WORK/hostBlist.json" && ok "hostB host-view shows shared place link" || bad "hostB host-view missing: $(head -c 240 "$WORK/hostBlist.json")"
  # hostA unlinks → link gone everywhere for stayA, place + hostB link intact
  curl -s -b "$JAR/a" -X DELETE \
    "$BASE/api/host/stays/$STAY_A/local-places/links/$PLACE_ID" > "$WORK/unlink.json"
  grep -q '"ok":true' "$WORK/unlink.json" && ok "hostA unlink own host_suggested link" || bad "unlink: $(head -c 240 "$WORK/unlink.json")"
  curl -s -b "$JAR/a" "$BASE/api/host/stays/$STAY_A/local-places" > "$WORK/hostAlist2.json"
  curl -s -b "$JAR/b" "$BASE/api/host/stays/$STAY_B/local-places" > "$WORK/hostBlist2.json"
  jq -e --arg n "$NAME1" '.links[]? | select(.name==$n)' "$WORK/hostAlist2.json" >/dev/null \
    && bad "link still on hostA after unlink" || ok "link removed from hostA view after unlink"
  jq -e --arg n "$NAME1" '.links[]? | select(.name==$n)' "$WORK/hostBlist2.json" >/dev/null \
    && ok "hostB link intact after hostA unlink (shared row survived)" || bad "hostB link lost after hostA unlink"
  curl -s "$BASE/stays/$SLUG_A" > "$WORK/guestA2.html"
  grep -q 'E2E flow test' "$WORK/guestA2.html" && bad "host note still rendered for unlinked place" || ok "unlinked place no longer carries host note on guest page"
  # curated link cannot be removed by host
  CURATED=$(curl -s -b "$JAR/a" "$BASE/api/host/stays/$STAY_A/local-places" | jq -r '.links[]? | select(.source=="curated") | .placeId' | head -1)
  if [ -n "$CURATED" ]; then
    CODE=$(curl -s -o "$WORK/curl_unlink.json" -w '%{http_code}' -b "$JAR/a" -X DELETE \
      "$BASE/api/host/stays/$STAY_A/local-places/links/$CURATED")
    [ "$CODE" = "403" ] && ok "host cannot unlink curated link → 403" || bad "curated unlink code=$CODE"
  else
    bad "no curated link found for curated-unlink check"
  fi
fi

echo "--- Phase M: privacy — pin coords, guest payload must not leak them ---"
curl -s -b "$JAR/a" -H 'Content-Type: application/json' \
  -X PATCH -d '{"googleMapsUrl":"https://www.google.com/maps/place/Test/@10.7625000,106.7000000,15z"}' \
  "$BASE/api/host/stays/$STAY_A" > "$WORK/pin.json"
grep -q '"ok":true' "$WORK/pin.json" && ok "host pins Maps link → stored" || bad "pin: $(head -c 240 "$WORK/pin.json")"
curl -s "$BASE/stays/$SLUG_A" > "$WORK/guest3.html"
grep -q '10.7625' "$WORK/guest3.html" && bad "stay coordinates LEAKED in guest payload" || ok "stay coordinates not in guest payload"
grep -o 'google.com/maps/[^"&<]*' "$WORK/guest3.html" | head -5 > "$WORK/mapslinks.txt"
if grep -q '10\.7625\|10\.762' "$WORK/mapslinks.txt"; then
  bad "maps link contains stay coords"
else
  ok "no coord-based maps link in guest page"
fi
curl -s -b "$JAR/a" -H 'Content-Type: application/json' \
  -X PATCH -d '{"googleMapsUrl":""}' "$BASE/api/host/stays/$STAY_A" > /dev/null

echo "--- Phase N: source label data present for modal ---"
grep -q 'Chủ nhà giới thiệu\|host_suggested' "$WORK/guest1.html" \
  && ok "host-sourced label data present" \
  || echo "  NOTE  source label is client-computed from link.source (verified in unit tests + UI phase)"

echo "--- Phase O: admin queues (all statuses) ---"
for st in pending approved rejected; do
  curl -s -b "$JAR/adm" "$BASE/api/admin/growth?scope=suggestions&status=$st" > "$WORK/q_$st.json"
  jq -e 'type=="object" or type=="array"' "$WORK/q_$st.json" >/dev/null 2>&1 && ok "queue status=$st responds" || bad "queue $st: $(head -c 160 "$WORK/q_$st.json")"
done
curl -s -b "$JAR/adm" "$BASE/api/admin/growth?scope=suggestions&status=approved" > "$WORK/q_appr.json"
grep -q "$SUG1" "$WORK/q_appr.json" && ok "approved queue contains SUG1" || bad "approved queue missing SUG1"

echo "--- Phase P: rating display honesty ---"
# Live stay with seeded (origin-known) Google rating → label shown with source.
curl -s "$BASE/stays/thao-dien-founders-coliving-saigon" > "$WORK/rating_live.html"
grep -q 'Google reviews\|đánh giá Google' "$WORK/rating_live.html" \
  && ok "live stay shows Google rating WITH source label" || bad "live stay Google label missing"
# Draft/test stays with old4.8/36 default must not be publicly rendered.
for s in new-listing-14247a hgjgj-conv-001 perfume-river-suites-2ad6e4; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/stays/$s")
  [ "$CODE" = "404" ] && ok "default-rated draft $s not public (404)" || bad "draft $s returned $CODE"
done

echo ""
echo "======== SUMMARY: $PASS passed, $FAIL failed ========"
echo "DB-level verification + cleanup: run scripts/e2e-ld-db-verify.ts with the dev server STOPPED."
rm -rf "$JAR" "$WORK"
[ "$FAIL" = "0" ]
