import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import type { Mother, Child, Senior, InventoryItem, DiseaseCase, TBPatient } from '@shared/schema';

export const TODAY = new Date();
export const TODAY_STR = TODAY.toISOString().split('T')[0];

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

/**
 * Age in completed months between dob and a specific reference date.
 * Used to place growth measurements on the WHO age-in-months X-axis.
 */
export function getAgeInMonthsAt(dob: string, referenceDate: string): number {
  const birth = parseISO(dob);
  const ref   = parseISO(referenceDate);
  const days  = differenceInDays(ref, birth);
  return Math.max(0, Math.floor(days / 30));
}

// WHO 2006 Child Growth Standards — Weight-for-Age LMS parameters.
// Source: WHO MGRS (2006) Acta Paediatrica Supplement; WHO technical tables.
// Indexed by age in completed months (0–60).
// L = Box-Cox power (skewness), M = median (kg), S = coefficient of variation.
const WHO_WFA_LMS = {
  boys: {
    L: [0.3487,0.2297,0.1970,0.1738,0.1553,0.1395,0.1257,0.1134,0.1021,0.0917,0.0820,0.0730,0.0646,0.0568,0.0494,0.0425,0.0359,0.0297,0.0239,0.0184,0.0132,0.0083,0.0037,-0.0005,-0.0040,-0.0066,-0.0083,-0.0092,-0.0094,-0.0091,-0.0083,-0.0070,-0.0055,-0.0038,-0.0018,0.0004,0.0027,0.0051,0.0075,0.0100,0.0124,0.0148,0.0172,0.0196,0.0219,0.0242,0.0265,0.0287,0.0309,0.0330,0.0351,0.0372,0.0392,0.0411,0.0430,0.0449,0.0467,0.0485,0.0502,0.0519,0.0536],
    M: [3.3464,4.4709,5.5675,6.3762,7.0023,7.5105,7.9340,8.2970,8.6151,8.9014,9.1649,9.4122,9.6479,9.8749,10.0952,10.3108,10.5228,10.7319,10.9385,11.1430,11.3462,11.5486,11.7504,11.9521,12.1441,12.3340,12.5205,12.7031,12.8818,13.0570,13.2293,13.3994,13.5679,13.7353,13.9020,14.0682,14.2341,14.3998,14.5653,14.7307,14.8962,15.0618,15.2275,15.3933,15.5591,15.7249,15.8907,16.0565,16.2224,16.3883,16.5543,16.7203,16.8864,17.0526,17.2190,17.3856,17.5524,17.7195,17.8869,18.0548,18.2231],
    S: [0.14602,0.13395,0.12385,0.11727,0.11316,0.10963,0.10680,0.10441,0.10239,0.10064,0.09910,0.09770,0.09641,0.09524,0.09416,0.09317,0.09225,0.09141,0.09063,0.08991,0.08924,0.08862,0.08804,0.08749,0.08688,0.08620,0.08546,0.08467,0.08382,0.08293,0.08201,0.08106,0.08008,0.07910,0.07810,0.07710,0.07609,0.07508,0.07407,0.07306,0.07205,0.07104,0.07004,0.06905,0.06806,0.06708,0.06611,0.06514,0.06419,0.06325,0.06232,0.06140,0.06050,0.05961,0.05873,0.05787,0.05702,0.05619,0.05537,0.05457,0.05378],
  },
  girls: {
    L: [0.3809,0.1714,0.0962,0.0402,-0.0050,-0.0430,-0.0756,-0.1038,-0.1282,-0.1495,-0.1681,-0.1845,-0.1990,-0.2120,-0.2235,-0.2339,-0.2431,-0.2515,-0.2590,-0.2657,-0.2719,-0.2774,-0.2823,-0.2867,-0.2902,-0.2926,-0.2938,-0.2939,-0.2930,-0.2912,-0.2887,-0.2855,-0.2817,-0.2773,-0.2725,-0.2673,-0.2617,-0.2559,-0.2498,-0.2436,-0.2371,-0.2306,-0.2239,-0.2172,-0.2104,-0.2035,-0.1966,-0.1897,-0.1828,-0.1759,-0.1691,-0.1622,-0.1554,-0.1487,-0.1420,-0.1354,-0.1289,-0.1225,-0.1162,-0.1100,-0.1039],
    M: [3.2322,4.1873,5.1282,5.8458,6.4237,6.8985,7.2970,7.6422,7.9487,8.2254,8.4800,8.7192,8.9481,9.1699,9.3876,9.6029,9.8170,10.0305,10.2441,10.4579,10.6718,10.8856,11.0986,11.3101,11.5149,11.7128,11.9070,12.0985,12.2884,12.4773,12.6653,12.8524,13.0385,13.2236,13.4076,13.5903,13.7716,13.9514,14.1295,14.3058,14.4802,14.6527,14.8234,14.9925,15.1602,15.3265,15.4918,15.6561,15.8197,15.9827,16.1452,16.3073,16.4690,16.6301,16.7905,16.9501,17.1089,17.2670,17.4245,17.5815,17.7385],
    S: [0.14171,0.13724,0.13000,0.12619,0.12332,0.12094,0.11900,0.11729,0.11582,0.11452,0.11336,0.11231,0.11135,0.11045,0.10963,0.10884,0.10812,0.10743,0.10680,0.10619,0.10561,0.10508,0.10458,0.10412,0.10366,0.10317,0.10263,0.10205,0.10142,0.10074,0.10001,0.09924,0.09843,0.09758,0.09669,0.09577,0.09481,0.09382,0.09280,0.09176,0.09070,0.08962,0.08852,0.08740,0.08628,0.08514,0.08400,0.08284,0.08169,0.08053,0.07937,0.07821,0.07705,0.07590,0.07475,0.07361,0.07248,0.07135,0.07024,0.06914,0.06806],
  },
};

export type ZScoreCategory = 'sam' | 'mam' | 'normal';

export interface WeightZScoreResult {
  category: ZScoreCategory;
  /** True WHO 2006 Box-Cox Z-score, rounded to one decimal place. */
  zScore: number;
}

export interface WHOReferencePoint {
  month: number;
  neg3: number;
  neg2: number;
  median: number;
  plus2: number;
}

/**
 * Returns WHO 2006 Weight-for-Age reference curve values for months 0–60.
 * Each point has -3 SD, -2 SD, Median (0 SD), and +2 SD weight values in kg.
 *
 * Returns null when sex is not explicitly "male" or "female" to prevent
 * rendering a clinically incorrect standard for records with missing sex.
 * Callers must guard on null before rendering reference curves.
 *
 * Box-Cox inverse formula:
 *   weight(Z) = M * (1 + L * S * Z)^(1/L)   when |L| >= 0.01
 *   weight(Z) = M * exp(S * Z)               when |L| < 0.01
 */
export function getWHOReferenceData(sex: string | null | undefined): WHOReferencePoint[] | null {
  const sexNorm = sex?.toLowerCase();
  if (sexNorm !== 'male' && sexNorm !== 'female') return null;
  const lms = sexNorm === 'female' ? WHO_WFA_LMS.girls : WHO_WFA_LMS.boys;

  const weightAtZ = (L: number, M: number, S: number, z: number): number => {
    const raw = Math.abs(L) < 0.01 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
    return Math.round(raw * 100) / 100;
  };

  return lms.M.map((M, month) => {
    const L = lms.L[month];
    const S = lms.S[month];
    return {
      month,
      neg3:   weightAtZ(L, M, S, -3),
      neg2:   weightAtZ(L, M, S, -2),
      median: Math.round(M * 100) / 100,
      plus2:  weightAtZ(L, M, S, 2),
    };
  });
}

/**
 * Computes a child's WHO 2006 weight-for-age Z-score using the Box-Cox LMS method.
 *
 * Formula:  Z = [(X / M)^L − 1] / (L × S)
 * When |L| < 0.01 (L ≈ 0):  Z = ln(X / M) / S  (limiting case)
 *
 * Classification:
 *   SAM  (Severe Acute Malnutrition):   Z < −3
 *   MAM  (Moderate Acute Malnutrition): −3 ≤ Z < −2
 *   Normal:                              Z ≥ −2
 *
 * Returns null when: no growth records, weight ≤ 0, or age outside 0–60 months.
 */
export function getWeightZScore(child: Child): WeightZScoreResult | null {
  const growth = child.growth || [];
  if (growth.length === 0) return null;

  const lastEntry = growth[growth.length - 1];
  const weightKg = lastEntry.weightKg;
  if (!weightKg || weightKg <= 0) return null;

  const ageMonths = getAgeInMonths(child.dob);
  if (ageMonths < 0 || ageMonths > 60) return null;

  const isFemale = child.sex?.toLowerCase() === 'female';
  const lms = isFemale ? WHO_WFA_LMS.girls : WHO_WFA_LMS.boys;
  const idx = Math.min(Math.round(ageMonths), 60);

  const L = lms.L[idx];
  const M = lms.M[idx];
  const S = lms.S[idx];

  let z: number;
  if (Math.abs(L) < 0.01) {
    z = Math.log(weightKg / M) / S;
  } else {
    z = (Math.pow(weightKg / M, L) - 1) / (L * S);
  }

  const zScore = Math.round(z * 10) / 10;

  let category: ZScoreCategory;
  if (z < -3) {
    category = 'sam';
  } else if (z < -2) {
    category = 'mam';
  } else {
    category = 'normal';
  }

  return { category, zScore };
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
