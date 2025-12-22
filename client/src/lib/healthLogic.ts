import { differenceInDays, parseISO, addDays, format } from 'date-fns';
import type { Mother, Child, Senior, InventoryItem } from '@shared/schema';

export const TODAY = new Date('2025-12-22');
export const TODAY_STR = '2025-12-22';

export type StatusType = 'overdue' | 'due_soon' | 'upcoming' | 'completed' | 'available';

export interface TTStatus {
  nextShot: 'TT1' | 'TT2' | 'TT3' | null;
  nextShotLabel: string;
  dueDate: string | null;
  status: StatusType;
}

export function getTTStatus(mother: Mother): TTStatus {
  if (!mother.tt1Date) {
    return {
      nextShot: 'TT1',
      nextShotLabel: 'Tetanus Shot 1 (TT1)',
      dueDate: null,
      status: 'overdue'
    };
  }

  if (!mother.tt2Date) {
    const tt2Due = addDays(parseISO(mother.tt1Date), 28);
    const daysUntil = differenceInDays(tt2Due, TODAY);
    return {
      nextShot: 'TT2',
      nextShotLabel: 'Tetanus Shot 2 (TT2)',
      dueDate: format(tt2Due, 'yyyy-MM-dd'),
      status: daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming'
    };
  }

  if (!mother.tt3Date) {
    const tt3Due = addDays(parseISO(mother.tt2Date), 180);
    const daysUntil = differenceInDays(tt3Due, TODAY);
    return {
      nextShot: 'TT3',
      nextShotLabel: 'Tetanus Shot 3 (TT3)',
      dueDate: format(tt3Due, 'yyyy-MM-dd'),
      status: daysUntil < 0 ? 'overdue' : daysUntil <= 7 ? 'due_soon' : 'upcoming'
    };
  }

  return {
    nextShot: null,
    nextShotLabel: 'All TT shots complete',
    dueDate: null,
    status: 'completed'
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
