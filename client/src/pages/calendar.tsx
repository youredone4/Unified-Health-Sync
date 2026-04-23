import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import type { Mother, Child, Senior } from "@shared/schema";
import { getTTStatus, formatDate, getPrenatalCheckStatus, getChildVisitStatus, getSeniorPickupStatus } from "@/lib/healthLogic";
import { usePagination } from "@/hooks/use-pagination";
import TablePagination from "@/components/table-pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import StatusBadge from "@/components/status-badge";
import {
  Calendar as CalendarIcon, Heart, Baby, Pill, Stethoscope,
  ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle, Search,
} from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  startOfWeek, endOfWeek, isToday, getDay, isSameMonth,
} from "date-fns";

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'prenatal' | 'tt' | 'vaccine' | 'senior';
  status: string;
  link: string;
  barangay: string;
}

type CalendarView = 'day' | 'week' | 'month';

const EVENT_TYPES = [
  { key: 'all', label: 'All Events', icon: CalendarIcon },
  { key: 'prenatal', label: 'Prenatal', icon: Stethoscope },
  { key: 'tt', label: 'TT Vaccine', icon: Heart },
  { key: 'vaccine', label: 'Child Health', icon: Baby },
  { key: 'senior', label: 'Senior Care', icon: Pill },
] as const;

const iconMap = {
  prenatal: Stethoscope,
  tt: Heart,
  vaccine: Baby,
  senior: Pill,
};

const typeColorClasses = {
  prenatal: 'bg-pink-500 dark:bg-pink-600',
  tt: 'bg-red-500 dark:bg-red-600',
  vaccine: 'bg-blue-500 dark:bg-blue-600',
  senior: 'bg-green-500 dark:bg-green-600',
};

// Pill used inside calendar cells to preview an event by type + title.
const typePillClasses = {
  prenatal: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
  tt:       'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  vaccine:  'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  senior:   'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30',
};

function statusDotClass(status: string) {
  if (status === 'overdue') return 'bg-destructive';
  if (status === 'due_soon') return 'bg-yellow-500 dark:bg-yellow-400';
  return 'bg-green-500 dark:bg-green-400';
}

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const { isTL } = useAuth();
  const { scopedPath } = useBarangay();

  const [view, setView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [barangayFilter, setBarangayFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: [scopedPath('/api/mothers')] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: [scopedPath('/api/children')] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: [scopedPath('/api/seniors')] });

  const events: CalendarEvent[] = useMemo(() => {
    const allEvents: CalendarEvent[] = [];

    mothers.forEach(m => {
      if (m.nextPrenatalCheckDate) {
        const pc = getPrenatalCheckStatus(m);
        allEvents.push({
          id: `pc-${m.id}`,
          date: m.nextPrenatalCheckDate,
          title: `${m.firstName ?? 'Unknown'} ${m.lastName ?? ''} - Prenatal Check`.trim(),
          type: 'prenatal',
          status: pc.status,
          link: `/mother/${m.id}`,
          barangay: m.barangay ?? '',
        });
      }
      const tt = getTTStatus(m);
      if (tt.dueDate && tt.status !== 'completed') {
        allEvents.push({
          id: `tt-${m.id}`,
          date: tt.dueDate,
          title: `${m.firstName ?? 'Unknown'} ${m.lastName ?? ''} - ${tt.nextShotLabel}`.trim(),
          type: 'tt',
          status: tt.status,
          link: `/mother/${m.id}`,
          barangay: m.barangay ?? '',
        });
      }
    });

    children.forEach(c => {
      if (c.nextVisitDate) {
        const visit = getChildVisitStatus(c);
        allEvents.push({
          id: `cv-${c.id}`,
          date: c.nextVisitDate,
          title: `${c.name ?? 'Unknown Child'} - Next Visit`,
          type: 'vaccine',
          status: visit.status,
          link: `/child/${c.id}`,
          barangay: c.barangay ?? '',
        });
      }
    });

    seniors.forEach(s => {
      if (s.nextPickupDate) {
        const pickup = getSeniorPickupStatus(s);
        allEvents.push({
          id: `sp-${s.id}`,
          date: s.nextPickupDate,
          title: `${s.firstName ?? 'Unknown'} ${s.lastName ?? ''} - Meds Pickup`.trim(),
          type: 'senior',
          status: pickup.status,
          link: `/senior/${s.id}`,
          barangay: s.barangay ?? '',
        });
      }
    });

    return allEvents.sort((a, b) => a.date.localeCompare(b.date));
  }, [mothers, children, seniors]);

  const barangays = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => { if (e.barangay) set.add(e.barangay); });
    return Array.from(set).sort();
  }, [events]);

  // Filters shared by both the calendar grid and the scheduled-events list.
  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (barangayFilter !== 'all' && e.barangay !== barangayFilter) return false;
      if (statusFilter === 'overdue' && e.status !== 'overdue') return false;
      if (statusFilter === 'due_soon' && e.status !== 'due_soon') return false;
      if (statusFilter === 'upcoming' && (e.status === 'overdue' || e.status === 'due_soon')) return false;
      if (q && !e.title.toLowerCase().includes(q) && !e.barangay.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, typeFilter, barangayFilter, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const counts = { overdue: 0, dueSoon: 0, upcoming: 0 };
    filteredEvents.forEach(e => {
      if (e.status === 'overdue') counts.overdue++;
      else if (e.status === 'due_soon') counts.dueSoon++;
      else counts.upcoming++;
    });
    return counts;
  }, [filteredEvents]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach(e => {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    });
    return m;
  }, [filteredEvents]);

  const eventsOnDate = (date: Date) => eventsByDate.get(format(date, 'yyyy-MM-dd')) ?? [];

  // Title + navigation helpers depend on the active view.
  const periodLabel = useMemo(() => {
    if (view === 'month') return format(cursor, 'MMMM yyyy');
    if (view === 'week') {
      const s = startOfWeek(cursor);
      const e = endOfWeek(cursor);
      return isSameMonth(s, e)
        ? `${format(s, 'MMM d')} – ${format(e, 'd, yyyy')}`
        : `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
    }
    return format(cursor, 'EEEE, MMMM d, yyyy');
  }, [view, cursor]);

  const goPrev = () => {
    if (view === 'month') setCursor(subMonths(cursor, 1));
    else if (view === 'week') setCursor(subWeeks(cursor, 1));
    else setCursor(subDays(cursor, 1));
  };
  const goNext = () => {
    if (view === 'month') setCursor(addMonths(cursor, 1));
    else if (view === 'week') setCursor(addWeeks(cursor, 1));
    else setCursor(addDays(cursor, 1));
  };
  const goToday = () => { setCursor(new Date()); setSelectedDate(new Date()); };

  // "Scheduled Events" pagination (below the calendar).
  const pagination = usePagination(filteredEvents, 10);
  useEffect(() => { pagination.resetPage(); }, [typeFilter, barangayFilter, statusFilter, search]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <CalendarIcon className="w-6 h-6" />
            Health Calendar
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            View and manage all scheduled health events
          </p>
        </div>
      </div>

      {/* Status summary — stays on top so KPIs remain above the fold */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="status-summary-cards">
        <Card
          className={`border-destructive/50 bg-destructive/10 cursor-pointer transition-all hover:opacity-90 select-none ${statusFilter === 'overdue' ? 'ring-2 ring-destructive/70' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'overdue' ? null : 'overdue')}
          data-testid="card-overdue-count"
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/20">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive" data-testid="text-overdue-value">{statusCounts.overdue}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-overdue-label">Overdue</p>
                <p className="text-xs text-muted-foreground mt-0.5">{statusFilter === 'overdue' ? 'Tap to clear' : 'Tap to filter'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-yellow-500/50 dark:border-yellow-400/50 bg-yellow-500/10 dark:bg-yellow-400/10 cursor-pointer transition-all hover:opacity-90 select-none ${statusFilter === 'due_soon' ? 'ring-2 ring-yellow-500/70' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'due_soon' ? null : 'due_soon')}
          data-testid="card-duesoon-count"
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-500/20 dark:bg-yellow-400/20">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-duesoon-value">{statusCounts.dueSoon}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-duesoon-label">Due Soon</p>
                <p className="text-xs text-muted-foreground mt-0.5">{statusFilter === 'due_soon' ? 'Tap to clear' : 'Tap to filter'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`border-green-500/50 dark:border-green-400/50 bg-green-500/10 dark:bg-green-400/10 cursor-pointer transition-all hover:opacity-90 select-none ${statusFilter === 'upcoming' ? 'ring-2 ring-green-500/70' : ''}`}
          onClick={() => setStatusFilter(statusFilter === 'upcoming' ? null : 'upcoming')}
          data-testid="card-upcoming-count"
        >
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20 dark:bg-green-400/20">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-upcoming-value">{statusCounts.upcoming}</p>
                <p className="text-sm text-muted-foreground" data-testid="text-upcoming-label">Upcoming</p>
                <p className="text-xs text-muted-foreground mt-0.5">{statusFilter === 'upcoming' ? 'Tap to clear' : 'Tap to filter'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event-type + barangay filters (apply to calendar and the list below) */}
      <div className="flex flex-wrap gap-2 items-center" data-testid="filters-container">
        <div className="flex gap-1 flex-wrap" data-testid="type-filters">
          {EVENT_TYPES.map(et => {
            const Icon = et.icon;
            const isActive = typeFilter === et.key;
            return (
              <Button
                key={et.key}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(et.key)}
                className="gap-1"
                data-testid={`filter-type-${et.key}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{et.label}</span>
              </Button>
            );
          })}
        </div>
        {!isTL && (
          <div className="ml-auto">
            <Select value={barangayFilter} onValueChange={setBarangayFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-barangay-filter">
                <SelectValue placeholder="All Barangays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Barangays</SelectItem>
                {barangays.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ── CALENDAR (full width, bigger) ─────────────────────────── */}
      <Card data-testid="card-calendar">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={goPrev} data-testid="button-prev-period" aria-label="Previous">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <CardTitle className="text-lg min-w-[12rem] text-center" data-testid="text-current-period">
                {periodLabel}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={goNext} data-testid="button-next-period" aria-label="Next">
                <ChevronRight className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="sm" className="ml-2 h-8" onClick={goToday} data-testid="button-today">
                Today
              </Button>
            </div>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => { if (v) setView(v as CalendarView); }}
              className="bg-muted/50 rounded-md p-0.5"
              data-testid="calendar-view-switcher"
            >
              <ToggleGroupItem value="day" size="sm" className="h-7 px-3 text-xs" data-testid="view-day">
                Day
              </ToggleGroupItem>
              <ToggleGroupItem value="week" size="sm" className="h-7 px-3 text-xs" data-testid="view-week">
                Week
              </ToggleGroupItem>
              <ToggleGroupItem value="month" size="sm" className="h-7 px-3 text-xs" data-testid="view-month">
                Month
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {view === 'month' && (
            <MonthGrid
              cursor={cursor}
              eventsOnDate={eventsOnDate}
              selectedDate={selectedDate}
              onSelect={(d) => setSelectedDate(isSameDate(d, selectedDate) ? null : d)}
              onOpenDay={(d) => { setCursor(d); setView('day'); setSelectedDate(d); }}
              onOpenEvent={(link) => navigate(link)}
            />
          )}
          {view === 'week' && (
            <WeekGrid
              cursor={cursor}
              eventsOnDate={eventsOnDate}
              selectedDate={selectedDate}
              onSelect={(d) => setSelectedDate(isSameDate(d, selectedDate) ? null : d)}
              onOpenDay={(d) => { setCursor(d); setView('day'); setSelectedDate(d); }}
              onOpenEvent={(link) => navigate(link)}
            />
          )}
          {view === 'day' && (
            <DayAgenda
              cursor={cursor}
              events={eventsOnDate(cursor)}
              onOpenEvent={(link) => navigate(link)}
            />
          )}

          <CalendarLegend />
        </CardContent>
      </Card>

      {/* ── ALL SCHEDULED EVENTS (below the calendar) ─────────────── */}
      <Card data-testid="card-scheduled-events">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base" data-testid="text-scheduled-title">
              All Scheduled Events
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({pagination.totalItems})
              </span>
            </CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search patient or barangay..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
                data-testid="input-search-events"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pagination.totalItems === 0 ? (
            <p className="text-muted-foreground text-center py-10" data-testid="text-no-events">
              No events match the current filters.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {pagination.pagedItems.map(event => {
                const Icon = iconMap[event.type];
                return (
                  <div
                    key={event.id}
                    onClick={() => navigate(event.link)}
                    className="flex items-center gap-3 py-3 px-1 cursor-pointer hover-elevate rounded-md"
                    data-testid={`event-row-${event.id}`}
                  >
                    <div className={`p-1.5 rounded-md ${typeColorClasses[event.type]}`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" data-testid={`event-title-${event.id}`}>{event.title}</p>
                      <p className="text-xs text-muted-foreground" data-testid={`event-details-${event.id}`}>
                        {formatDate(event.date)} · {event.barangay || '—'}
                      </p>
                    </div>
                    <StatusBadge status={event.status as any} />
                  </div>
                );
              })}
            </div>
          )}
          <TablePagination pagination={pagination} pageSizeOptions={[10, 25, 50, 100]} />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-views ────────────────────────────────────────────────────

function isSameDate(a: Date, b: Date | null) {
  return !!b && isSameDay(a, b);
}

function CalendarLegend() {
  return (
    <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground" data-testid="calendar-legend">
      <div className="flex items-center gap-1" data-testid="legend-overdue">
        <span className="w-2 h-2 rounded-full bg-destructive" />
        Overdue
      </div>
      <div className="flex items-center gap-1" data-testid="legend-duesoon">
        <span className="w-2 h-2 rounded-full bg-yellow-500 dark:bg-yellow-400" />
        Due Soon
      </div>
      <div className="flex items-center gap-1" data-testid="legend-upcoming">
        <span className="w-2 h-2 rounded-full bg-green-500 dark:bg-green-400" />
        Upcoming
      </div>
      <div className="flex items-center gap-1" data-testid="legend-today">
        <span className="w-3 h-3 rounded-sm ring-2 ring-primary" />
        Today
      </div>
    </div>
  );
}

interface GridProps {
  cursor: Date;
  eventsOnDate: (date: Date) => CalendarEvent[];
  selectedDate: Date | null;
  onSelect: (d: Date) => void;
  onOpenDay: (d: Date) => void;
  onOpenEvent: (link: string) => void;
}

function MonthGrid({ cursor, eventsOnDate, selectedDate, onSelect, onOpenDay, onOpenEvent }: GridProps) {
  const days = useMemo(() => eachDayOfInterval({
    start: startOfMonth(cursor),
    end: endOfMonth(cursor),
  }), [cursor]);
  const startDayOfWeek = getDay(startOfMonth(cursor));

  return (
    <>
      <div className="grid grid-cols-7 gap-1 mb-2" data-testid="calendar-weekday-headers">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2" data-testid={`weekday-${day.toLowerCase()}`}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" data-testid="calendar-days-grid">
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[7rem] rounded-md bg-muted/20" />
        ))}
        {days.map(day => {
          const dayEvents = eventsOnDate(day);
          const hasOverdue = dayEvents.some(e => e.status === 'overdue');
          const hasDueSoon = dayEvents.some(e => e.status === 'due_soon');
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={`
                min-h-[7rem] p-1.5 rounded-md border flex flex-col gap-1
                transition-colors cursor-pointer hover-elevate
                ${isSelected ? 'border-primary bg-primary/5' : 'border-border/60'}
                ${isTodayDate && !isSelected ? 'bg-accent/40 border-primary/60' : ''}
              `}
              onClick={() => onSelect(day)}
              onDoubleClick={() => onOpenDay(day)}
              data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${isTodayDate ? 'text-primary' : ''}`}>
                  {format(day, 'd')}
                </span>
                <div className="flex items-center gap-0.5">
                  {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                  {hasDueSoon && !hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 dark:bg-yellow-400" />}
                  {!hasOverdue && !hasDueSoon && dayEvents.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400" />
                  )}
                </div>
              </div>

              {/* Show up to 3 event previews inline + "+N more" */}
              <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map(ev => (
                  <button
                    key={ev.id}
                    onClick={(e) => { e.stopPropagation(); onOpenEvent(ev.link); }}
                    className={`text-left text-[10px] leading-tight px-1.5 py-0.5 rounded border truncate ${typePillClasses[ev.type]}`}
                    data-testid={`cell-event-${ev.id}`}
                    title={ev.title}
                  >
                    {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-muted-foreground hover:text-foreground text-left px-1.5"
                        data-testid={`more-events-${format(day, 'yyyy-MM-dd')}`}
                      >
                        +{dayEvents.length - 3} more
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-2" align="start">
                      <p className="text-xs font-medium mb-2">{format(day, 'EEE, MMM d')}</p>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {dayEvents.map(ev => (
                          <button
                            key={ev.id}
                            onClick={() => onOpenEvent(ev.link)}
                            className={`w-full text-left text-xs px-2 py-1.5 rounded border ${typePillClasses[ev.type]}`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(ev.status)}`} />
                              <span className="truncate">{ev.title}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function WeekGrid({ cursor, eventsOnDate, selectedDate, onSelect, onOpenDay, onOpenEvent }: GridProps) {
  const weekStart = startOfWeek(cursor);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  return (
    <div className="grid grid-cols-7 gap-2" data-testid="week-grid">
      {days.map(day => {
        const dayEvents = eventsOnDate(day);
        const isSelected = selectedDate && isSameDay(day, selectedDate);
        const isTodayDate = isToday(day);
        return (
          <div
            key={day.toISOString()}
            className={`
              min-h-[22rem] rounded-md border flex flex-col
              ${isSelected ? 'border-primary bg-primary/5' : 'border-border/60'}
              ${isTodayDate && !isSelected ? 'bg-accent/40 border-primary/60' : ''}
            `}
            data-testid={`week-day-${format(day, 'yyyy-MM-dd')}`}
          >
            <button
              onClick={() => onSelect(day)}
              onDoubleClick={() => onOpenDay(day)}
              className="px-2 py-2 border-b border-border/60 flex items-center justify-between hover-elevate rounded-t-md"
            >
              <span className="text-[11px] font-medium text-muted-foreground uppercase">
                {format(day, 'EEE')}
              </span>
              <span className={`text-lg font-semibold ${isTodayDate ? 'text-primary' : ''}`}>
                {format(day, 'd')}
              </span>
            </button>
            <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
              {dayEvents.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center pt-6">No events</p>
              ) : (
                dayEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => onOpenEvent(ev.link)}
                    className={`w-full text-left text-[11px] leading-tight px-2 py-1.5 rounded border ${typePillClasses[ev.type]}`}
                    data-testid={`week-event-${ev.id}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDotClass(ev.status)}`} />
                      <span className="font-medium truncate">{ev.title}</span>
                    </div>
                    {ev.barangay && <p className="text-[10px] text-muted-foreground truncate">{ev.barangay}</p>}
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayAgenda({ cursor, events, onOpenEvent }: {
  cursor: Date;
  events: CalendarEvent[];
  onOpenEvent: (link: string) => void;
}) {
  const grouped = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = { prenatal: [], tt: [], vaccine: [], senior: [] };
    events.forEach(e => { m[e.type].push(e); });
    return m;
  }, [events]);

  return (
    <div className="space-y-4" data-testid="day-agenda">
      <div className="flex items-center gap-3 pb-2 border-b border-border/60">
        <div className="text-center">
          <p className="text-[11px] text-muted-foreground uppercase">{format(cursor, 'EEE')}</p>
          <p className="text-3xl font-bold leading-tight">{format(cursor, 'd')}</p>
          <p className="text-[11px] text-muted-foreground">{format(cursor, 'MMM yyyy')}</p>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">
            {events.length === 0 ? 'Nothing scheduled' : `${events.length} scheduled event${events.length === 1 ? '' : 's'}`}
          </p>
          <p className="text-xs text-muted-foreground">{format(cursor, 'EEEE, MMMM d, yyyy')}</p>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No events on this day.</p>
      ) : (
        EVENT_TYPES.filter(t => t.key !== 'all').map(t => {
          const list = grouped[t.key] ?? [];
          if (list.length === 0) return null;
          const Icon = t.icon;
          return (
            <div key={t.key} data-testid={`day-group-${t.key}`}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {t.label}
                <span className="text-[10px] font-normal">({list.length})</span>
              </p>
              <div className="space-y-1.5">
                {list.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => onOpenEvent(ev.link)}
                    className="w-full flex items-center gap-3 p-3 rounded-md bg-muted/40 hover-elevate text-left"
                    data-testid={`day-event-${ev.id}`}
                  >
                    <div className={`p-1.5 rounded-md ${typeColorClasses[ev.type]}`}>
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground">{ev.barangay || '—'}</p>
                    </div>
                    <StatusBadge status={ev.status as any} />
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
