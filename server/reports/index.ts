/**
 * Reports Hub registry.
 * Imports each report definition and registers it. New reports drop into
 * this list — no other wiring needed.
 */

import { registerReport, listReports } from "./types";
import { m2Morbidity } from "./m2-morbidity";
import { fpForm1 } from "./fp-form-1";
import { epiCoverage } from "./epi-coverage";
import { philpenRisk } from "./philpen-risk";
import { ncdTreatment } from "./ncd-treatment";
import { mortality } from "./mortality";
import { coldChain } from "./cold-chain";
import { oralHealth } from "./oral-health";
import { pidsrCat2 } from "./pidsr-cat2";
import { ntpTb3a } from "./ntp-tb-3a";
import { ntpTb5a } from "./ntp-tb-5a";
import { lguScorecard } from "./lgu-scorecard";
import { hrhRoster } from "./hrh-roster";
import { m1DateRangeExport } from "./m1-date-range";
import { registeredUsers } from "./registered-users";

export function ensureReportsRegistered() {
  // Always (re-)register. registerReport is idempotent — overwriting an
  // existing slug is fine. This keeps the registry in sync after a tsx
  // hot-reload of this file when types.ts (and its REGISTRY map) hasn't
  // re-evaluated.
  registerReport(m2Morbidity);
  registerReport(fpForm1);
  registerReport(epiCoverage);
  registerReport(philpenRisk);
  registerReport(ncdTreatment);
  registerReport(mortality);
  registerReport(coldChain);
  registerReport(oralHealth);
  registerReport(pidsrCat2);
  registerReport(ntpTb3a);
  registerReport(ntpTb5a);
  registerReport(lguScorecard);
  registerReport(hrhRoster);
  registerReport(m1DateRangeExport);
  registerReport(registeredUsers);
  const slugs = listReports().map((r) => r.slug);
  console.log(`[reports] ${slugs.length} reports registered: ${slugs.join(", ")}`);
}

export { listReports, getReport } from "./types";
export type { ReportDefinition, ReportParams, ReportResult, ReportColumn, ReportRow, ReportCadence, ReportCategory } from "./types";
