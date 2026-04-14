import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useBarangay } from "@/contexts/barangay-context";
import type { Mother, Child, Senior } from "@shared/schema";
import { getTTStatus, formatDate, getPrenatalCheckStatus, getChildVisitStatus, getSeniorPickupStatus } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import StatusBadge from "@/components/status-badge";
import { Calendar as CalendarIcon, Heart, Baby, Pill, Stethoscope, ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, getDay } from "date-fns";

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'prenatal' | 'tt' | 'vaccine' | 'senior';
  status: string;
  link: string;
  barangay: string;
}

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
  senior: Pill
};

const typeColorClasses = {
  prenatal: 'bg-pink-500 dark:bg-pink-600',
  tt: 'bg-red-500 dark:bg-red-600',
  vaccine: 'bg-blue-500 dark:bg-blue-600',
  senior: 'bg-green-500 dark:bg-green-600'
};

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const { isTL } = useAuth();
  const { scopedPath } = useBarangay();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [barangayFilter, setBarangayFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

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
          barangay: m.barangay ?? ''
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
          barangay: m.barangay ?? ''
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
          barangay: c.barangay ?? ''
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
          barangay: s.barangay ?? ''
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

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (barangayFilter !== 'all' && e.barangay !== barangayFilter) return false;
      if (statusFilter === 'overdue' && e.status !== 'overdue') return false;
      if (statusFilter === 'due_soon' && e.status !== 'due_soon') return false;
      if (statusFilter === 'upcoming' && (e.status === 'overdue' || e.status === 'due_soon')) return false;
      return true;
    });
  }, [events, typeFilter, barangayFilter, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { overdue: 0, dueSoon: 0, upcoming: 0 };
    filteredEvents.forEach(e => {
      if (e.status === 'overdue') counts.overdue++;
      else if (e.status === 'due_soon') counts.dueSoon++;
      else counts.upcoming++;
    });
    return counts;
  }, [filteredEvents]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsOnDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return filteredEvents.filter(e => e.date === dateStr);
  };

  const selectedDateEvents = selectedDate ? eventsOnDate(selectedDate) : [];

  const agendaEvents = useMemo(() => {
    if (selectedDate) {
      return selectedDateEvents;
    }
    return filteredEvents;
  }, [selectedDate, selectedDateEvents, filteredEvents]);

  const startDayOfWeek = getDay(startOfMonth(currentMonth));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <CalendarIcon className="w-6 h-6" />
            Health Calendar
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">View and manage all scheduled health events</p>
        </div>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-month-calendar">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} data-testid="button-prev-month">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <CardTitle className="text-lg" data-testid="text-current-month">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} data-testid="button-next-month">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 mb-2" data-testid="calendar-weekday-headers">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2" data-testid={`weekday-${day.toLowerCase()}`}>
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1" data-testid="calendar-days-grid">
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-12" />
              ))}
              {daysInMonth.map(day => {
                const dayEvents = eventsOnDate(day);
                const hasOverdue = dayEvents.some(e => e.status === 'overdue');
                const hasDueSoon = dayEvents.some(e => e.status === 'due_soon');
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(isSelected ? null : day)}
                    className={`
                      h-12 rounded-md flex flex-col items-center justify-center relative
                      hover-elevate active-elevate-2 cursor-pointer transition-colors
                      ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                      ${isTodayDate && !isSelected ? 'bg-accent ring-2 ring-primary' : ''}
                    `}
                    data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <span className={`text-sm font-medium ${isTodayDate && !isSelected ? 'text-primary' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-destructive" data-testid={`dot-overdue-${format(day, 'yyyy-MM-dd')}`} />}
                        {hasDueSoon && !hasOverdue && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 dark:bg-yellow-400" data-testid={`dot-duesoon-${format(day, 'yyyy-MM-dd')}`} />}
                        {!hasOverdue && !hasDueSoon && <span className="w-1.5 h-1.5 rounded-full bg-green-500 dark:bg-green-400" data-testid={`dot-upcoming-${format(day, 'yyyy-MM-dd')}`} />}
                        {dayEvents.length > 1 && (
                          <span className="text-[10px] text-muted-foreground ml-0.5" data-testid={`event-count-${format(day, 'yyyy-MM-dd')}`}>+{dayEvents.length - 1}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
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
          </CardContent>
        </Card>

        <Card data-testid="card-agenda">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base" data-testid="text-agenda-title">
              {selectedDate ? `Events on ${format(selectedDate, 'MMM d, yyyy')}` : 'All Scheduled Events'}
            </CardTitle>
            {selectedDate && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)} data-testid="button-clear-date">
                Clear
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
            {agendaEvents.length === 0 && (
              <p className="text-muted-foreground text-center py-8" data-testid="text-no-events">
                {selectedDate ? 'No events on this date' : 'No upcoming events'}
              </p>
            )}
            {agendaEvents.map(event => {
              const Icon = iconMap[event.type];
              return (
                <div
                  key={event.id}
                  onClick={() => navigate(event.link)}
                  className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate"
                  data-testid={`event-${event.id}`}
                >
                  <div className={`p-1.5 rounded-md ${typeColorClasses[event.type]}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" data-testid={`event-title-${event.id}`}>{event.title}</p>
                    <p className="text-xs text-muted-foreground" data-testid={`event-details-${event.id}`}>
                      {formatDate(event.date)} · {event.barangay}
                    </p>
                  </div>
                  <StatusBadge status={event.status as any} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
