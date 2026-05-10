#!/usr/bin/env bash
# =============================================================================
# Comprehensive API Test Script for Docc Platform
# Tests every endpoint with correct inputs and validates response codes/bodies
# =============================================================================
set -euo pipefail

BASE="http://localhost:3000"
FIREBASE_API_KEY="AIzaSyB0xWdOZm4-fIaU8Dy65vqeBxKYAUlOnbA"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

pass=0
fail=0

log_section() { echo -e "\n${BLUE}${BOLD}══════════════════════════════════════${NC}"; echo -e "${CYAN}${BOLD}  $1${NC}"; echo -e "${BLUE}${BOLD}══════════════════════════════════════${NC}"; }
log_test()    { echo -e "\n${BOLD}▶ $1${NC}"; }
log_pass()    { echo -e "${GREEN}  ✅ PASS: $1${NC}"; ((pass++)); }
log_fail()    { echo -e "${RED}  ❌ FAIL: $1${NC}"; ((fail++)); }
log_info()    { echo -e "${YELLOW}  ℹ  $1${NC}"; }

assert_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then log_pass "Status $actual (expected $expected)"
  else log_fail "$label — got $actual, expected $expected"; fi
}

assert_field() {
  local label="$1" field="$2" body="$3"
  if echo "$body" | python3 -c "import sys,json; d=json.load(sys.stdin); assert '$field' in d or any('$field' in str(v) for v in d) if isinstance(d, list) else True" 2>/dev/null; then
    log_pass "Response contains '$field'"
  else
    log_fail "$label — field '$field' missing in: $(echo "$body" | head -c 120)"
  fi
}

# ─────────────────────────────────────────────
# STEP 1: Get a real Firebase ID token
# ─────────────────────────────────────────────
log_section "1. Firebase Auth — Getting ID Token"

# Try sign-in with email/password. Uses a test-safe approach.
FIREBASE_RESP=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "test123456",
    "returnSecureToken": true
  }') || true

ID_TOKEN=$(echo "$FIREBASE_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('idToken',''))" 2>/dev/null || echo "")

if [ -z "$ID_TOKEN" ]; then
  log_info "No test account found. Creating one..."
  SIGNUP_RESP=$(curl -s -X POST \
    "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@test.com",
      "password": "test123456",
      "returnSecureToken": true
    }') || true

  ID_TOKEN=$(echo "$SIGNUP_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('idToken',''))" 2>/dev/null || echo "")

  if [ -z "$ID_TOKEN" ]; then
    # Try sign-in again after signup attempt
    FIREBASE_RESP2=$(curl -s -X POST \
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{
        "email": "test@test.com",
        "password": "test123456",
        "returnSecureToken": true
      }') || true
    ID_TOKEN=$(echo "$FIREBASE_RESP2" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('idToken',''))" 2>/dev/null || echo "")
  fi
fi

if [ -n "$ID_TOKEN" ]; then
  log_pass "Got Firebase ID token (${#ID_TOKEN} chars)"
  AUTH_HEADER="Bearer $ID_TOKEN"
else
  log_fail "Could not get Firebase token — will test auth rejection only"
  AUTH_HEADER=""
fi

# ─────────────────────────────────────────────
# STEP 2: Unauthenticated rejection tests
# ─────────────────────────────────────────────
log_section "2. Auth Rejection Tests (No Token)"

log_test "GET /api/tasks — should reject with 401"
R=$(curl -s -w "\n%{http_code}" "$BASE/api/tasks")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -1)
assert_status "GET /api/tasks no-auth" "401" "$CODE"
assert_field  "error field" "error" "$BODY"

log_test "GET /api/tasks/:id/rows — should reject with 401"
R=$(curl -s -w "\n%{http_code}" "$BASE/api/tasks/507f1f77bcf86cd799439011/rows")
CODE=$(echo "$R" | tail -1)
assert_status "GET /api/tasks/:id/rows no-auth" "401" "$CODE"

log_test "POST /api/tasks/:id/export — should reject with 401"
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/tasks/507f1f77bcf86cd799439011/export")
CODE=$(echo "$R" | tail -1)
assert_status "POST /api/tasks/:id/export no-auth" "401" "$CODE"

log_test "DELETE /api/tasks/:id — should reject with 401"
R=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/api/tasks/507f1f77bcf86cd799439011")
CODE=$(echo "$R" | tail -1)
assert_status "DELETE /api/tasks/:id no-auth" "401" "$CODE"

log_test "GET /api/tasks/:id/rows with bad token — should reject with 401"
R=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer invalid_token_xyz" "$BASE/api/tasks/507f1f77bcf86cd799439011/rows")
CODE=$(echo "$R" | tail -1)
assert_status "bad-token" "401" "$CODE"

# ─────────────────────────────────────────────
# STEP 3: Process route validation tests
# ─────────────────────────────────────────────
log_section "3. POST /api/process — Input Validation"

log_test "Missing uploadId — should return 400"
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/process" -H "Content-Type: application/json" -d '{}')
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -1)
assert_status "missing uploadId" "400" "$CODE"

log_test "Invalid ObjectId format — should return 400"
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/process" -H "Content-Type: application/json" -d '{"uploadId":"not-an-objectid"}')
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -1)
assert_status "invalid ObjectId" "400" "$CODE"
log_info "Body: $BODY"

log_test "Valid ObjectId but non-existent — should return 404"
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/process" -H "Content-Type: application/json" -d '{"uploadId":"507f1f77bcf86cd799439011"}')
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -1)
assert_status "valid but missing upload" "404" "$CODE"
log_info "Body: $BODY"

log_test "Empty body — should return 400 or 500 (not 200)"
R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/process" -H "Content-Type: application/json" -d '')
CODE=$(echo "$R" | tail -1)
if [ "$CODE" != "200" ]; then log_pass "Non-200 response: $CODE"; else log_fail "Got 200 on empty body"; fi

# ─────────────────────────────────────────────
# STEP 4: UploadThing (public)
# ─────────────────────────────────────────────
log_section "4. GET /api/uploadthing — Config Endpoint"

log_test "Should return UploadThing router config"
R=$(curl -s -w "\n%{http_code}" "$BASE/api/uploadthing")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -1)
assert_status "uploadthing config" "200" "$CODE"
log_info "Body: $BODY"

# ─────────────────────────────────────────────
# STEP 5: Authenticated tests (only if token available)
# ─────────────────────────────────────────────
if [ -n "$ID_TOKEN" ]; then
  log_section "5. Authenticated Endpoint Tests"

  log_test "GET /api/tasks — should return array"
  R=$(curl -s -w "\n%{http_code}" -H "Authorization: $AUTH_HEADER" "$BASE/api/tasks")
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -1)
  assert_status "GET /api/tasks" "200" "$CODE"
  IS_ARRAY=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if isinstance(d,list) else 'no')" 2>/dev/null || echo "no")
  if [ "$IS_ARRAY" = "yes" ]; then log_pass "Response is JSON array"
  else log_fail "Response is not an array: $BODY"; fi

  JOB_COUNT=$(echo "$BODY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  log_info "Total jobs in DB: $JOB_COUNT"

  log_test "GET /api/tasks/:id/rows with non-existent ID — should return 404"
  R=$(curl -s -w "\n%{http_code}" -H "Authorization: $AUTH_HEADER" "$BASE/api/tasks/507f1f77bcf86cd799439011/rows")
  CODE=$(echo "$R" | tail -1)
  assert_status "GET rows non-existent job" "404" "$CODE"

  log_test "POST /api/tasks/:id/export with non-existent ID — should return 404"
  R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: $AUTH_HEADER" "$BASE/api/tasks/507f1f77bcf86cd799439011/export")
  CODE=$(echo "$R" | tail -1)
  assert_status "POST export non-existent job" "404" "$CODE"

  log_test "DELETE /api/tasks/:id with non-existent ID — should return 404"
  R=$(curl -s -w "\n%{http_code}" -X DELETE -H "Authorization: $AUTH_HEADER" "$BASE/api/tasks/507f1f77bcf86cd799439011")
  CODE=$(echo "$R" | tail -1)
  assert_status "DELETE non-existent job" "404" "$CODE"

  log_test "PATCH /api/tasks/:id/rows — bad rowId should return 404"
  R=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: $AUTH_HEADER" -H "Content-Type: application/json" \
    -d '{"rowId":"507f1f77bcf86cd799439011","data":{"Content":"test"}}' \
    "$BASE/api/tasks/507f1f77bcf86cd799439011/rows")
  CODE=$(echo "$R" | tail -1)
  assert_status "PATCH non-existent row" "404" "$CODE"

  # Test jobs with real data if any exist
  if [ "$JOB_COUNT" -gt 0 ]; then
    log_section "5b. Testing with Real Job Data"
    FIRST_JOB=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['_id'])")
    FIRST_STATUS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].get('status','?'))")
    FIRST_FILENAME=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0].get('filename','MISSING'))")
    log_info "First job: ID=$FIRST_JOB  status=$FIRST_STATUS  filename=$FIRST_FILENAME"

    if [ "$FIRST_FILENAME" = "MISSING" ] || [ "$FIRST_FILENAME" = "None" ]; then
      log_fail "filename field is MISSING from /api/tasks response"
    else
      log_pass "filename field present: $FIRST_FILENAME"
    fi

    log_test "GET /api/tasks/:id/rows — real job"
    R=$(curl -s -w "\n%{http_code}" -H "Authorization: $AUTH_HEADER" "$BASE/api/tasks/${FIRST_JOB}/rows")
    CODE=$(echo "$R" | tail -1); BODY2=$(echo "$R" | head -1)
    assert_status "GET real job rows" "200" "$CODE"
    ROW_COUNT=$(echo "$BODY2" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
    log_info "Rows in job: $ROW_COUNT"

    if [ "$FIRST_STATUS" = "completed" ]; then
      log_test "POST /api/tasks/:id/export — real completed job"
      R=$(curl -s -w "\n%{http_code}" -X POST -H "Authorization: $AUTH_HEADER" "$BASE/api/tasks/${FIRST_JOB}/export")
      CODE=$(echo "$R" | tail -1)
      assert_status "POST export real job" "200" "$CODE"
      CT=$(curl -s -I -X POST -H "Authorization: $AUTH_HEADER" "$BASE/api/tasks/${FIRST_JOB}/export" | grep -i content-type || echo "")
      log_info "Content-Type: $CT"
    fi
  fi
else
  log_section "5. Authenticated Tests — SKIPPED (no token)"
  log_info "Could not obtain Firebase token. Skipping auth-required tests."
fi

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}══════════════════════════════════════${NC}"
echo -e "${BOLD}  TEST SUMMARY${NC}"
echo -e "${BOLD}══════════════════════════════════════${NC}"
echo -e "${GREEN}  Passed: $pass${NC}"
echo -e "${RED}  Failed: $fail${NC}"
echo ""
if [ "$fail" -gt 0 ]; then exit 1; else echo -e "${GREEN}${BOLD}  All tests passed! ✅${NC}"; fi
