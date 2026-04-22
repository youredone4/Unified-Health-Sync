#!/bin/bash
# demo-reset.sh — Full demo database reset + seed pipeline for HealthSync.
#
# Order of operations:
#   1. reset-test-data.ts   — Truncates all transactional tables (preserves
#                             users, barangays, health_stations, seniors, etc.)
#   2. seed-patients.ts     — Generates realistic Mothers, Children, Disease
#                             Cases, and TB Patient profiles across all 20
#                             barangays.
#   3. seed-transactional-data.ts — Populates prenatal_visits, child_visits,
#                             consults, fp_service_records, inventory (vaccines
#                             + HTN meds), and medicine_inventory.
#
# Usage:
#   ALLOW_TEST_RESET=true bash scripts/demo-reset.sh
#
# Note: ALLOW_TEST_RESET=true is required by both the reset and the
# transactional seeder as a safety gate against accidental production runs.

set -euo pipefail

if [ "${ALLOW_TEST_RESET:-}" != "true" ]; then
  echo "ERROR: ALLOW_TEST_RESET=true must be set to run the demo reset pipeline."
  echo "  Example: ALLOW_TEST_RESET=true bash scripts/demo-reset.sh"
  exit 1
fi

echo "============================================================"
echo "HealthSync Demo Reset + Seed Pipeline"
echo "============================================================"
echo ""

# Step 1: Reset — truncate all transactional tables
echo "[1/3] Resetting transactional data..."
ALLOW_TEST_RESET=true npx tsx server/reset-test-data.ts --confirm
echo ""

# Step 2: Seed patient profiles (Mothers, Children, Disease Cases, TB)
echo "[2/3] Seeding patient data..."
npx tsx server/seed-patients.ts
echo ""

# Step 3: Seed transactional data + inventory (vaccines, HTN meds, medicine stock)
echo "[3/3] Seeding transactional data and inventory..."
ALLOW_TEST_RESET=true npx tsx server/seed-transactional-data.ts --confirm
echo ""

echo "============================================================"
echo "Demo reset complete. All tables seeded including inventory."
echo "============================================================"
