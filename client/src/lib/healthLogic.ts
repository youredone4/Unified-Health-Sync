import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import type { Mother, Child, Senior, InventoryItem, DiseaseCase, TBPatient } from '@shared/schema';

export const TODAY = new Date('2025-12-22');
export const TODAY_STR = '2025-12-22';

export type StatusType = 'overdue' | 'due_soon' | 'upcoming' | 'completed' | 'available';

export interface TTStatus {
  nextShot: 'TT1' | 'TT2' | 'TT3' | 'TT4' | 'TT5' | null;
  nextShotLabel: string;
  dueDate: string | null;
  status: StatusType;
  completedShots: number;
}

// TT Vaccination Schedule per DOH guidelines:
// TT1: Anytime during pregnancy (or first contact)
// TT2: 4 weeks (28 days) after TT1
// TT3: 6 months (180 days) after TT2
// TT4: 1 year (365 days) after TT3
// TT5: 1 year (365 days) after TT4
export const TT_SCHEDULE = [
  { shot: 'TT1' as const, label: 'Tetanus Toxoid 1 (TT1)', daysAfterPrevious: 0 },
  { shot: 'TT2' as const, label: 'Tetanus Toxoid 2 (TT2)', daysAfterPrevious: 28 },
  { shot: 'TT3' as const, label: 'Tetanus Toxoid 3 (TT3)', daysAfterPrevious: 180 },
  { shot: 'TT4' as const, label: 'Tetanus Toxoid 4 (TT4)', daysAfterPrevious: 365 },
  { shot: 'TT5' as const, label: 'Tetanus Toxoid 5 (TT5)', daysAfterPrevious: 365 },
] as const;

export function getTTStatus(mother: Mother): TTStatus {
  const ttDates = [
    mother.tt1Date,
    mother.tt2Date,
    mother.tt3Date,
    mother.tt4Date,
    mother.tt5Date,
  ];

  // Count completed shots
  const completedShots = ttDates.filter(d => d).length;

  // If all shots complete
  if (completedShots >= 5) {
    return {
      nextShot: null,
      nextShotLabel: 'All TT shots complete (TT5)',
      dueDate: null,
      status: 'completed',
      completedShots: 5
    };
  }

  // Find next shot
  const nextShotIndex = completedShots;
  const nextShotInfo = TT_SCHEDULE[nextShotIndex];

  // TT1 has no previous date requirement
  if (nextShotIndex === 0) {
    return {
      nextShot: 'TT1',
      nextShotLabel: nextShotInfo.label,
      dueDate: null,
      status: 'overdue',
      completedShots: 0
    };
  }

  // Calculate due date based on previous shot
  const previousShotDate = ttDates[nextShotIndex - 1];
  if (!previousShotDate) {
    return {
      nextShot: nextShotInfo.shot,
      nextShotLabel: nextShotInfo.label,
      dueDate: null,
      status: 'overdue',
      completedShots
    };
  }

  const dueDate = addDays(parseISO(previousShotDate), nextShotInfo.daysAfterPrevious);
  const daysUntil = differenceInDays(dueDate, TODAY);

  return {
    nextShot: nextShotInfo.shot,
    nextShotLabel: nextShotInfo.label,
    dueDate: format(dueDate, 'yyyy-MM-dd'),
    status: daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming',
    completedShots
  };
}

// Pregnancy status based on expected delivery date
export interface PregnancyStatus {
  isOverdue: boolean;
  daysOverdue: number;
  weeksPregnant: number;
  expectedDeliveryDate: string | null;
  status: 'normal' | 'term' | 'overdue' | 'delivered' | 'closed';
}

export function getPregnancyStatus(mother: Mother): PregnancyStatus {
  // If outcome is set, pregnancy is closed
  if (mother.outcome) {
    return {
      isOverdue: false,
      daysOverdue: 0,
      weeksPregnant: 0,
      expectedDeliveryDate: mother.expectedDeliveryDate || null,
      status: 'closed'
    };
  }

  if (mother.status === 'delivered') {
    return {
      isOverdue: false,
      daysOverdue: 0,
      weeksPregnant: 40,
      expectedDeliveryDate: mother.expectedDeliveryDate || null,
      status: 'delivered'
    };
  }

  // Calculate current weeks pregnant based on registration GA and time elapsed
  const regDate = parseISO(mother.registrationDate);
  const daysElapsed = differenceInDays(TODAY, regDate);
  const weeksElapsed = Math.floor(daysElapsed / 7);
  const currentGaWeeks = mother.gaWeeks + weeksElapsed;

  // Calculate EDD if not set
  let eddStr = mother.expectedDeliveryDate;
  if (!eddStr) {
    const weeksToDelivery = 40 - mother.gaWeeks;
    const edd = addDays(regDate, weeksToDelivery * 7);
    eddStr = format(edd, 'yyyy-MM-dd');
  }

  const edd = parseISO(eddStr);
  const daysOverdue = differenceInDays(TODAY, edd);

  return {
    isOverdue: daysOverdue > 0,
    daysOverdue: Math.max(0, daysOverdue),
    weeksPregnant: currentGaWeeks,
    expectedDeliveryDate: eddStr,
    status: daysOverdue > 7 ? 'overdue' : currentGaWeeks >= 37 ? 'term' : 'normal'
  };
}

export function getPrenatalCheckStatus(mother: Mother): { status: StatusType; daysUntil: number | null } {
  if (!mother.nextPrenatalCheckDate) return { status: 'upcoming', daysUntil: null };
  const checkDate = parseISO(mother.nextPrenatalCheckDate);
  const daysUntil = differenceInDays(checkDate, TODAY);
  return {
    status: daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming',
    daysUntil
  };
}

export const VACCINE_SCHEDULE = [
  { key: 'bcg', label: 'BCG', daysFromBirth: 0 },
  { key: 'hepB', label: 'Hepatitis B', daysFromBirth: 0 },
  { key: 'penta1', label: 'Pentavalent 1', daysFromBirth: 42 },
  { key: 'opv1', label: 'OPV 1', daysFromBirth: 42 },
  { key: 'penta2', label: 'Pentavalent 2', daysFromBirth: 70 },
  { key: 'opv2', label: 'OPV 2', daysFromBirth: 70 },
  { key: 'penta3', label: 'Pentavalent 3', daysFromBirth: 98 },
  { key: 'opv3', label: 'OPV 3', daysFromBirth: 98 },
  { key: 'mr1', label: 'Measles-Rubella 1', daysFromBirth: 270 },
] as const;

export interface VaccineStatus {
  nextVaccine: string | null;
  nextVaccineLabel: string;
  dueDate: string | null;
  status: StatusType;
}

export function getNextVaccineStatus(child: Child): VaccineStatus {
  const dob = parseISO(child.dob);
  const vaccines = child.vaccines || {};

  for (const vax of VACCINE_SCHEDULE) {
    const key = vax.key as keyof typeof vaccines;
    if (!vaccines[key]) {
      const dueDate = addDays(dob, vax.daysFromBirth);
      const daysUntil = differenceInDays(dueDate, TODAY);
      return {
        nextVaccine: vax.key,
        nextVaccineLabel: vax.label,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        status: daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming'
      };
    }
  }

  return {
    nextVaccine: null,
    nextVaccineLabel: 'All vaccines complete',
    dueDate: null,
    status: 'completed'
  };
}

export function getChildVisitStatus(child: Child): { status: StatusType; daysUntil: number | null } {
  if (!child.nextVisitDate) return { status: 'upcoming', daysUntil: null };
  const visitDate = parseISO(child.nextVisitDate);
  const daysUntil = differenceInDays(visitDate, TODAY);
  return {
    status: daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming',
    daysUntil
  };
}

export function getAgeInMonths(dob: string): number {
  const birthDate = parseISO(dob);
  const days = differenceInDays(TODAY, birthDate);
  return Math.floor(days / 30);
}

// WHO 2006 Child Growth Standards — Weight-for-Age reference cutoffs (kg)
// Indexed by age in months (0–60). Source: WHO MGRS, published LMS tables.
const WHO_WFA = {
  boys: {
    sd3neg: [2.1,2.9,3.8,4.4,4.8,5.3,5.7,6.0,6.3,6.6,6.8,7.1,7.3,7.5,7.7,7.9,8.1,8.2,8.4,8.6,8.7,8.9,9.0,9.2,9.3,9.5,9.6,9.8,9.9,10.1,10.2,10.4,10.5,10.7,10.8,10.9,11.1,11.2,11.3,11.5,11.6,11.7,11.9,12.0,12.1,12.3,12.4,12.5,12.7,12.8,12.9,13.1,13.2,13.3,13.5,13.6,13.7,13.9,14.0,14.1,14.3],
    sd2neg: [2.5,3.4,4.3,5.0,5.6,6.0,6.4,6.8,7.1,7.4,7.7,8.0,8.2,8.4,8.6,8.8,9.1,9.2,9.4,9.6,9.7,9.9,10.1,10.2,10.4,10.6,10.7,10.9,11.1,11.2,11.4,11.6,11.7,11.9,12.0,12.2,12.3,12.5,12.6,12.8,12.9,13.1,13.2,13.4,13.5,13.7,13.8,14.0,14.1,14.3,14.4,14.6,14.7,14.9,15.0,15.2,15.3,15.5,15.6,15.8,15.9],
  },
  girls: {
    sd3neg: [2.0,2.7,3.4,4.0,4.4,4.8,5.1,5.4,5.6,5.8,6.1,6.3,6.5,6.7,6.9,7.0,7.2,7.4,7.5,7.7,7.8,8.0,8.1,8.3,8.4,8.6,8.7,8.9,9.0,9.2,9.3,9.5,9.6,9.7,9.9,10.0,10.2,10.3,10.4,10.6,10.7,10.9,11.0,11.1,11.3,11.4,11.5,11.7,11.8,12.0,12.1,12.2,12.4,12.5,12.6,12.8,12.9,13.0,13.2,13.3,13.4],
    sd2neg: [2.4,3.2,3.9,4.5,5.0,5.4,5.7,6.0,6.3,6.5,6.8,7.0,7.2,7.4,7.6,7.8,8.0,8.2,8.4,8.6,8.7,8.9,9.1,9.3,9.4,9.6,9.8,10.0,10.1,10.3,10.5,10.7,10.8,11.0,11.1,11.3,11.5,11.6,11.8,12.0,12.1,12.3,12.5,12.6,12.8,13.0,13.1,13.3,13.5,13.6,13.8,14.0,14.1,14.3,14.5,14.6,14.8,15.0,15.1,15.3,15.5],
  },
};

export type ZScoreCategory = 'sam' | 'mam' | 'normal';

export interface WeightZScoreResult {
  category: ZScoreCategory;
  zScore: number;
}

/**
 * Classifies a child's nutritional status using WHO 2006 Weight-for-Age Z-score.
 * Returns null if insufficient data (no growth records, unknown age, or age > 60 months).
 * - SAM: Z < -3 (Severe Acute Malnutrition)
 * - MAM: -3 ≤ Z < -2 (Moderate Acute Malnutrition)
 * - Normal: Z ≥ -2
 */
export function getWeightZScore(child: Child): WeightZScoreResult | null {
  const growth = child.growth || [];
  if (growth.length === 0) return null;

  const lastEntry = growth[growth.length - 1];
  const weightKg = lastEntry.weightKg;
  const ageMonths = getAgeInMonths(child.dob);

  if (ageMonths < 0 || ageMonths > 60) return null;

  const sex = child.sex?.toLowerCase();
  const table = sex === 'female' ? WHO_WFA.girls : WHO_WFA.boys;
  const idx = Math.min(Math.round(ageMonths), 60);
  const sd3 = table.sd3neg[idx];
  const sd2 = table.sd2neg[idx];

  if (weightKg < sd3) {
    const approxZ = -3 - Math.max(0, (sd3 - weightKg) / Math.max(sd3 * 0.1, 0.1));
    return { category: 'sam', zScore: Math.round(approxZ * 10) / 10 };
  }
  if (weightKg < sd2) {
    const approxZ = -3 + ((weightKg - sd3) / (sd2 - sd3));
    return { category: 'mam', zScore: Math.round(approxZ * 10) / 10 };
  }
  const approxZ = -2 + ((weightKg - sd2) / Math.max(sd2 * 0.15, 0.5));
  return { category: 'normal', zScore: Math.round(Math.min(approxZ, 3) * 10) / 10 };
}

export function isUnderweightRisk(child: Child): boolean {
  const result = getWeightZScore(child);
  return result !== null && (result.category === 'sam' || result.category === 'mam');
}

export function hasMissingGrowthCheck(child: Child): boolean {
  const growth = child.growth || [];
  if (growth.length === 0) return true;
  
  const lastGrowth = growth[growth.length - 1];
  const lastDate = parseISO(lastGrowth.date);
  return differenceInDays(TODAY, lastDate) > 60;
}

export function getSeniorPickupStatus(senior: Senior): { status: StatusType; daysUntil: number | null } {
  if (!senior.nextPickupDate) return { status: 'upcoming', daysUntil: null };
  const pickupDate = parseISO(senior.nextPickupDate);
  const daysUntil = differenceInDays(pickupDate, TODAY);
  return {
    status: daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming',
    daysUntil
  };
}

export function isMedsReadyForPickup(senior: Senior): boolean {
  return senior.htnMedsReady === true && senior.pickedUp === false;
}

export type StockStatus = 'out' | 'low' | 'available' | 'surplus';

export function getStockStatus(qty: number, lowThreshold: number, surplusThreshold: number): StockStatus {
  if (qty <= 0) return 'out';
  if (qty <= lowThreshold) return 'low';
  if (qty >= surplusThreshold) return 'surplus';
  return 'available';
}

export function getStatusBadgeClass(status: StatusType | StockStatus): string {
  switch (status) {
    case 'overdue':
    case 'out':
      return 'status-overdue';
    case 'due_soon':
    case 'low':
      return 'status-due-soon';
    case 'completed':
    case 'available':
    case 'surplus':
      return 'status-completed';
    case 'upcoming':
      return 'status-upcoming';
    default:
      return '';
  }
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'N/A';
  return format(parseISO(dateStr), 'MMM d, yyyy');
}

// === DISEASE SURVEILLANCE ===
export type DiseaseStatusType = 'new' | 'monitoring' | 'referred' | 'closed';

export function getDiseaseStatus(diseaseCase: DiseaseCase): DiseaseStatusType {
  const status = (diseaseCase.status || 'New').toLowerCase();
  if (status === 'new') return 'new';
  if (status === 'monitoring') return 'monitoring';
  if (status === 'referred') return 'referred';
  return 'closed';
}

export function getDaysSinceReported(diseaseCase: DiseaseCase): number {
  if (!diseaseCase.dateReported) return 0;
  const reportedDate = parseISO(diseaseCase.dateReported);
  return differenceInDays(TODAY, reportedDate);
}

export function isOutbreakCondition(cases: DiseaseCase[]): { isOutbreak: boolean; condition: string | null; count: number } {
  const conditionCounts: Record<string, number> = {};
  const recentCases = cases.filter(c => {
    const daysSince = getDaysSinceReported(c);
    return daysSince <= 14 && c.status !== 'Closed';
  });
  
  for (const c of recentCases) {
    conditionCounts[c.condition] = (conditionCounts[c.condition] || 0) + 1;
  }
  
  for (const [condition, count] of Object.entries(conditionCounts)) {
    if (count >= 3) {
      return { isOutbreak: true, condition, count };
    }
  }
  
  return { isOutbreak: false, condition: null, count: 0 };
}

export function getDiseaseStatusBadgeClass(status: DiseaseStatusType): string {
  switch (status) {
    case 'new':
      return 'status-overdue';
    case 'monitoring':
      return 'status-due-soon';
    case 'referred':
      return 'status-upcoming';
    case 'closed':
      return 'status-completed';
    default:
      return '';
  }
}

// === TB DOTS ===
export type TBStatusType = 'overdue' | 'due_today' | 'due_soon' | 'on_track' | 'at_risk' | 'completed';

export function getTBDotsVisitStatus(patient: TBPatient): { status: TBStatusType; daysUntil: number | null } {
  if (!patient.nextDotsVisitDate) return { status: 'on_track', daysUntil: null };
  
  const visitDate = parseISO(patient.nextDotsVisitDate);
  const daysUntil = differenceInDays(visitDate, TODAY);
  
  if (daysUntil < 0) return { status: 'overdue', daysUntil };
  if (daysUntil === 0) return { status: 'due_today', daysUntil: 0 };
  if (daysUntil <= 3) return { status: 'due_soon', daysUntil };
  return { status: 'on_track', daysUntil };
}

export function getTBMissedDoseRisk(patient: TBPatient): boolean {
  return (patient.missedDosesCount || 0) >= 3;
}

export function getTBSputumCheckStatus(patient: TBPatient): { status: StatusType; daysUntil: number | null } {
  if (!patient.nextSputumCheckDate) return { status: 'upcoming', daysUntil: null };
  
  const checkDate = parseISO(patient.nextSputumCheckDate);
  const daysUntil = differenceInDays(checkDate, TODAY);
  
  return {
    status: daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming',
    daysUntil
  };
}

export function getTBOverallStatus(patient: TBPatient): TBStatusType {
  if (patient.outcomeStatus === 'Completed') return 'completed';
  if (patient.referralToRHU) return 'at_risk';
  if ((patient.missedDosesCount || 0) >= 3) return 'at_risk';
  
  const visitStatus = getTBDotsVisitStatus(patient);
  return visitStatus.status;
}

export function getTBStatusBadgeClass(status: TBStatusType): string {
  switch (status) {
    case 'overdue':
    case 'at_risk':
      return 'status-overdue';
    case 'due_today':
    case 'due_soon':
      return 'status-due-soon';
    case 'on_track':
      return 'status-upcoming';
    case 'completed':
      return 'status-completed';
    default:
      return '';
  }
}

export function getTreatmentDaysRemaining(patient: TBPatient): number {
  const startDate = parseISO(patient.treatmentStartDate);
  const totalDays = patient.treatmentPhase === 'Intensive' ? 56 : 112;
  const daysSinceStart = differenceInDays(TODAY, startDate);
  return Math.max(0, totalDays - daysSinceStart);
}

export function getTreatmentProgress(patient: TBPatient): number {
  const startDate = parseISO(patient.treatmentStartDate);
  const totalDays = patient.treatmentPhase === 'Intensive' ? 56 : 112;
  const daysSinceStart = differenceInDays(TODAY, startDate);
  return Math.min(100, Math.max(0, (daysSinceStart / totalDays) * 100));
}
