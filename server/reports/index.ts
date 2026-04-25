/**
 * Reports Hub registry.
 * Imports each report definition and registers it. New reports drop into
 * this list — no other wiring needed.
 */

import { registerReport } from "./types";
import { m2Morbidity } from "./m2-morbidity";
import { fpForm1 } from "./fp-form-1";
import { epiCoverage } from "./epi-coverage";
import { philpenRisk } from "./philpen-risk";
import { ncdTreatment } from "./ncd-treatment";
import { mortality } from "./mortality";
import { coldChain } from "./cold-chain";
import { oralHealth } from "./oral-health";
import { pidsrCat2 } from "./pidsr-cat2";

let registered = false;

export function ensureReportsRegistered() {
  if (registered) return;
  registerReport(m2Morbidity);
  registerReport(fpForm1);
  registerReport(epiCoverage);
  registerReport(philpenRisk);
  registerReport(ncdTreatment);
  registerReport(mortality);
  registerReport(coldChain);
  registerReport(oralHealth);
  registerReport(pidsrCat2);
  registered = true;
}

export { listReports, getReport } from "./types";
export type { ReportDefinition, ReportParams, ReportResult, ReportColumn, ReportRow, ReportCadence, ReportCategory } from "./types";
