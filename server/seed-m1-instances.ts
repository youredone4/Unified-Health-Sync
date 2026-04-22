/**
 * Seed M1 Report Instances Script
 *
 * Creates M1 report instances (status=DRAFT, scopeType=BARANGAY) for every
 * barangay × month from 2025-01 through the current month, then runs the
 * compute pipeline against each new instance.
 *
 * Idempotent: skips any (barangay, month, year) tuple that already has an
 * instance.
 *
 * Usage:
 *   ALLOW_TEST_RESET=true tsx server/seed-m1-instances.ts --confirm
 */
import { storage } from "./storage";
import { pool } from "./db";

function monthsFromJan2025ToCurrent(): Array<{ year: number; month: number }> {
  const out: Array<{ year: number; month: number }> = [];
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  for (let y = 2025; y <= endYear; y++) {
    const endM = y === endYear ? endMonth : 12;
    for (let m = 1; m <= endM; m++) out.push({ year: y, month: m });
  }
  return out;
}

async function main() {
  const allowed = process.env.ALLOW_TEST_RESET === "true";
  const confirmed = process.argv.includes("--confirm");
  if (!allowed) {
    console.error("[seed-m1-instances] ERROR: ALLOW_TEST_RESET=true is required.");
    process.exit(1);
  }
  if (!confirmed) {
    console.error("[seed-m1-instances] ERROR: --confirm CLI flag is required.");
    process.exit(1);
  }

  const templates = await storage.getM1TemplateVersions();
  const activeTemplate = templates.find((t) => t.isActive) ?? templates[0];
  if (!activeTemplate) {
    console.error("[seed-m1-instances] ERROR: no M1 template version found.");
    process.exit(1);
  }

  const bgys = await storage.getBarangays();
  const months = monthsFromJan2025ToCurrent();
  console.log(
    `[seed-m1-instances] ${bgys.length} barangays × ${months.length} months = ${bgys.length * months.length} target instances (template v${activeTemplate.id}).`,
  );

  let created = 0;
  let skipped = 0;
  let computedTotal = 0;

  for (const bgy of bgys) {
    for (const { year, month } of months) {
      const existing = await storage.getM1ReportInstances({
        barangayId: bgy.id,
        month,
        year,
      });
      if (existing.length > 0) {
        skipped++;
        continue;
      }
      const instance = await storage.createM1ReportInstance({
        templateVersionId: activeTemplate.id,
        scopeType: "BARANGAY",
        barangayId: bgy.id,
        barangayName: bgy.name,
        month,
        year,
        createdByUserId: null,
      });
      const result = await storage.computeM1Values(instance.id);
      computedTotal += result.computed;
      created++;
      if (created % 50 === 0) {
        console.log(`  [seed-m1-instances] created ${created} so far (skipped ${skipped})...`);
      }
    }
  }

  console.log(
    `[seed-m1-instances] Done. created=${created} skipped=${skipped} totalComputedValues=${computedTotal}`,
  );
  await pool.end();
}

main().catch((err) => {
  console.error("[seed-m1-instances] Fatal:", err);
  process.exit(1);
});
