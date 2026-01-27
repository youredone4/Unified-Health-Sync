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

export function isUnderweightRisk(child: Child): boolean {
  const growth = child.growth || [];
  if (growth.length === 0) return false;
  
  const lastWeight = growth[growth.length - 1];
  const ageMonths = getAgeInMonths(child.dob);
  
  const expectedWeight = 3 + (ageMonths * 0.5);
  return lastWeight.weightKg < expectedWeight * 0.8;
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
