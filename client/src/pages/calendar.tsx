import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Mother, Child, Senior } from "@shared/schema";
import { getTTStatus, formatDate, getPrenatalCheckStatus, getChildVisitStatus, getSeniorPickupStatus } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatusBadge from "@/components/status-badge";
import { Calendar, Heart, Baby, Pill, Stethoscope } from "lucide-react";
import { parseISO, format, isAfter, isBefore, addDays } from "date-fns";

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: 'prenatal' | 'tt' | 'vaccine' | 'senior';
  status: string;
  link: string;
}

export default function CalendarPage() {
  const [, navigate] = useLocation();
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: ['/api/seniors'] });

  const events: CalendarEvent[] = [];

  mothers.forEach(m => {
    if (m.nextPrenatalCheckDate) {
      const pc = getPrenatalCheckStatus(m);
      events.push({
        id: `pc-${m.id}`,
        date: m.nextPrenatalCheckDate,
        title: `${m.firstName} ${m.lastName} - Prenatal Check`,
        type: 'prenatal',
        status: pc.status,
        link: `/mother/${m.id}`
      });
    }
    const tt = getTTStatus(m);
    if (tt.dueDate && tt.status !== 'completed') {
      events.push({
        id: `tt-${m.id}`,
        date: tt.dueDate,
        title: `${m.firstName} ${m.lastName} - ${tt.nextShotLabel}`,
        type: 'tt',
        status: tt.status,
        link: `/mother/${m.id}`
      });
    }
  });

  children.forEach(c => {
    if (c.nextVisitDate) {
      const visit = getChildVisitStatus(c);
      events.push({
        id: `cv-${c.id}`,
        date: c.nextVisitDate,
        title: `${c.name} - Next Visit`,
        type: 'vaccine',
        status: visit.status,
        link: `/child/${c.id}`
      });
    }
  });

  seniors.forEach(s => {
    if (s.nextPickupDate) {
      const pickup = getSeniorPickupStatus(s);
      events.push({
        id: `sp-${s.id}`,
        date: s.nextPickupDate,
        title: `${s.firstName} ${s.lastName} - Meds Pickup`,
        type: 'senior',
        status: pickup.status,
        link: `/senior/${s.id}`
      });
    }
  });

  events.sort((a, b) => a.date.localeCompare(b.date));

  const groupedByDate = events.reduce((acc, event) => {
    const dateKey = event.date;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const iconMap = {
    prenatal: Stethoscope,
    tt: Heart,
    vaccine: Baby,
    senior: Pill
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Calendar className="w-6 h-6" />
          Calendar - All Schedules
        </h1>
        <p className="text-muted-foreground">Upcoming events across all modules</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agenda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(groupedByDate).length === 0 && (
            <p className="text-muted-foreground text-center py-8">No upcoming events</p>
          )}
          {Object.entries(groupedByDate).map(([date, dayEvents]) => (
            <div key={date} className="border-b border-border pb-4 last:border-0">
              <h3 className="font-medium mb-2 text-sm text-muted-foreground">{formatDate(date)}</h3>
              <div className="space-y-2">
                {dayEvents.map(event => {
                  const Icon = iconMap[event.type];
                  return (
                    <div
                      key={event.id}
                      onClick={() => navigate(event.link)}
                      className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover-elevate"
                      data-testid={`event-${event.id}`}
                    >
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="flex-1">{event.title}</span>
                      <StatusBadge status={event.status as any} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
