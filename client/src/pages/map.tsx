import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { HealthStation, Mother, Child, Senior, DiseaseCase, TBPatient } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Users, AlertTriangle, Clock, Hospital } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getTTStatus,
  getPrenatalCheckStatus,
  getNextVaccineStatus,
  getChildVisitStatus,
  getSeniorPickupStatus,
  getTBDotsVisitStatus,
  getTBMissedDoseRisk,
  getDiseaseStatus,
  formatDate,
  type StatusType,
  type TBStatusType,
} from "@/lib/healthLogic";

const createColoredIcon = (color: string) => {
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path fill="${color}" stroke="#333" stroke-width="1" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>
      <circle fill="white" cx="12" cy="12" r="5"/>
    </svg>
  `;
  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36],
  });
};

const redIcon = createColoredIcon('#dc2626');
const orangeIcon = createColoredIcon('#f97316');
const greenIcon = createColoredIcon('#22c55e');
const blueIcon = createColoredIcon('#3b82f6');

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

type LayerType = 'all' | 'prenatal' | 'child' | 'senior' | 'disease' | 'tb' | 'facilities';
type StatusFilter = 'all' | 'overdue' | 'due_soon';

interface MapMarker {
  id: string;
  type: LayerType;
  lat: number;
  lng: number;
  status: 'overdue' | 'due_soon' | 'normal';
  tooltipTitle: string;
  tooltipDetails: string;
  profileUrl: string;
}

function getMotherStatus(mother: Mother): 'overdue' | 'due_soon' | 'normal' {
  const ttStatus = getTTStatus(mother);
  const prenatalStatus = getPrenatalCheckStatus(mother);
  if (ttStatus.status === 'overdue' || prenatalStatus.status === 'overdue') return 'overdue';
  if (ttStatus.status === 'due_soon' || prenatalStatus.status === 'due_soon') return 'due_soon';
  return 'normal';
}

function getChildStatus(child: Child): 'overdue' | 'due_soon' | 'normal' {
  const vaxStatus = getNextVaccineStatus(child);
  const visitStatus = getChildVisitStatus(child);
  if (vaxStatus.status === 'overdue' || visitStatus.status === 'overdue') return 'overdue';
  if (vaxStatus.status === 'due_soon' || visitStatus.status === 'due_soon') return 'due_soon';
  return 'normal';
}

function getSeniorStatus(senior: Senior): 'overdue' | 'due_soon' | 'normal' {
  const pickupStatus = getSeniorPickupStatus(senior);
  if (pickupStatus.status === 'overdue') return 'overdue';
  if (pickupStatus.status === 'due_soon') return 'due_soon';
  return 'normal';
}

function getDiseaseMarkerStatus(diseaseCase: DiseaseCase): 'overdue' | 'due_soon' | 'normal' {
  const status = getDiseaseStatus(diseaseCase);
  if (status === 'new') return 'overdue';
  if (status === 'monitoring') return 'due_soon';
  return 'normal';
}

function getTBMarkerStatus(patient: TBPatient): 'overdue' | 'due_soon' | 'normal' {
  const visitStatus = getTBDotsVisitStatus(patient);
  const isAtRisk = getTBMissedDoseRisk(patient);
  if (visitStatus.status === 'overdue' || isAtRisk) return 'overdue';
  if (visitStatus.status === 'due_today' || visitStatus.status === 'due_soon') return 'due_soon';
  return 'normal';
}

function getMarkerIcon(status: 'overdue' | 'due_soon' | 'normal', isFacility: boolean = false) {
  if (isFacility) return blueIcon;
  if (status === 'overdue') return redIcon;
  if (status === 'due_soon') return orangeIcon;
  return greenIcon;
}

function getStatusLabel(status: 'overdue' | 'due_soon' | 'normal'): string {
  if (status === 'overdue') return 'OVERDUE';
  if (status === 'due_soon') return 'DUE SOON';
  return 'On Track';
}

export default function MapPage() {
  const [, setLocation] = useLocation();
  const [layerFilter, setLayerFilter] = useState<LayerType>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: stations = [] } = useQuery<HealthStation[]>({ queryKey: ['/api/health-stations'] });
  const { data: mothers = [] } = useQuery<Mother[]>({ queryKey: ['/api/mothers'] });
  const { data: children = [] } = useQuery<Child[]>({ queryKey: ['/api/children'] });
  const { data: seniors = [] } = useQuery<Senior[]>({ queryKey: ['/api/seniors'] });
  const { data: diseaseCases = [] } = useQuery<DiseaseCase[]>({ queryKey: ['/api/disease-cases'] });
  const { data: tbPatients = [] } = useQuery<TBPatient[]>({ queryKey: ['/api/tb-patients'] });

  const markers = useMemo(() => {
    const allMarkers: MapMarker[] = [];

    if (layerFilter === 'all' || layerFilter === 'prenatal') {
      mothers.forEach(m => {
        if (!m.latitude || !m.longitude) return;
        const status = getMotherStatus(m);
        const ttStatus = getTTStatus(m);
        allMarkers.push({
          id: `mother-${m.id}`,
          type: 'prenatal',
          lat: parseFloat(m.latitude),
          lng: parseFloat(m.longitude),
          status,
          tooltipTitle: `Mother: ${m.firstName} ${m.lastName}`,
          tooltipDetails: `Next: ${ttStatus.nextShotLabel || 'Prenatal check'} | Due: ${formatDate(m.nextPrenatalCheckDate)} | ${getStatusLabel(status)}`,
          profileUrl: `/mother/${m.id}`,
        });
      });
    }

    if (layerFilter === 'all' || layerFilter === 'child') {
      children.forEach(c => {
        if (!c.latitude || !c.longitude) return;
        const status = getChildStatus(c);
        const vaxStatus = getNextVaccineStatus(c);
        allMarkers.push({
          id: `child-${c.id}`,
          type: 'child',
          lat: parseFloat(c.latitude),
          lng: parseFloat(c.longitude),
          status,
          tooltipTitle: `Child: ${c.name}`,
          tooltipDetails: `Next Vaccine: ${vaxStatus.nextVaccineLabel} | Next Visit: ${formatDate(c.nextVisitDate)} | ${getStatusLabel(status)}`,
          profileUrl: `/child/${c.id}`,
        });
      });
    }

    if (layerFilter === 'all' || layerFilter === 'senior') {
      seniors.forEach(s => {
        if (!s.latitude || !s.longitude) return;
        const status = getSeniorStatus(s);
        allMarkers.push({
          id: `senior-${s.id}`,
          type: 'senior',
          lat: parseFloat(s.latitude),
          lng: parseFloat(s.longitude),
          status,
          tooltipTitle: `Senior: ${s.firstName} ${s.lastName}`,
          tooltipDetails: `Next Pickup: ${formatDate(s.nextPickupDate)} | Med: ${s.lastMedicationName || 'N/A'} ${s.lastMedicationDoseMg || ''}mg | ${getStatusLabel(status)}`,
          profileUrl: `/senior/${s.id}`,
        });
      });
    }

    if (layerFilter === 'all' || layerFilter === 'disease') {
      diseaseCases.forEach(d => {
        if (!d.latitude || !d.longitude) return;
        const status = getDiseaseMarkerStatus(d);
        allMarkers.push({
          id: `disease-${d.id}`,
          type: 'disease',
          lat: parseFloat(d.latitude),
          lng: parseFloat(d.longitude),
          status,
          tooltipTitle: `Case: ${d.condition}`,
          tooltipDetails: `Patient: ${d.patientName} | Reported: ${formatDate(d.dateReported)} | ${d.status}`,
          profileUrl: `/disease/${d.id}`,
        });
      });
    }

    if (layerFilter === 'all' || layerFilter === 'tb') {
      tbPatients.forEach(t => {
        if (!t.latitude || !t.longitude) return;
        const status = getTBMarkerStatus(t);
        const visitStatus = getTBDotsVisitStatus(t);
        allMarkers.push({
          id: `tb-${t.id}`,
          type: 'tb',
          lat: parseFloat(t.latitude),
          lng: parseFloat(t.longitude),
          status,
          tooltipTitle: `TB DOTS: ${t.firstName} ${t.lastName}`,
          tooltipDetails: `Next Visit: ${formatDate(t.nextDotsVisitDate)} | Missed Doses: ${t.missedDosesCount || 0} | ${getStatusLabel(status)}`,
          profileUrl: `/tb/${t.id}`,
        });
      });
    }

    let filtered = allMarkers;
    if (statusFilter === 'overdue') {
      filtered = allMarkers.filter(m => m.status === 'overdue');
    } else if (statusFilter === 'due_soon') {
      filtered = allMarkers.filter(m => m.status === 'due_soon');
    }

    return filtered;
  }, [layerFilter, statusFilter, mothers, children, seniors, diseaseCases, tbPatients]);

  const facilityMarkers = useMemo(() => {
    if (layerFilter !== 'all' && layerFilter !== 'facilities') return [];
    return stations.map(s => ({
      id: `facility-${s.id}`,
      lat: parseFloat(s.latitude),
      lng: parseFloat(s.longitude),
      name: s.facilityName,
      barangay: s.barangay,
    }));
  }, [layerFilter, stations]);

  const counts = useMemo(() => {
    const overdueCount = markers.filter(m => m.status === 'overdue').length;
    const dueSoonCount = markers.filter(m => m.status === 'due_soon').length;
    return {
      total: markers.length + facilityMarkers.length,
      overdue: overdueCount,
      dueSoon: dueSoonCount,
    };
  }, [markers, facilityMarkers]);

  const center = { lat: 9.6573, lng: 125.68 };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <MapPin className="w-6 h-6 text-green-500" />
          Patient Map
        </h1>
        <p className="text-muted-foreground">View all patients and facilities in Placer Municipality</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card data-testid="counter-total">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{counts.total}</p>
              <p className="text-xs text-muted-foreground">Pins Shown</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="counter-overdue">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-500">{counts.overdue}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="counter-due-soon">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold text-orange-500">{counts.dueSoon}</p>
              <p className="text-xs text-muted-foreground">Due Soon</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Show on Map:</span>
          <Select value={layerFilter} onValueChange={(v) => setLayerFilter(v as LayerType)}>
            <SelectTrigger className="w-[180px]" data-testid="select-layer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="prenatal">Prenatal (Mothers)</SelectItem>
              <SelectItem value="child">Child Health</SelectItem>
              <SelectItem value="senior">Senior Care</SelectItem>
              <SelectItem value="disease">Disease Cases</SelectItem>
              <SelectItem value="tb">TB DOTS</SelectItem>
              <SelectItem value="facilities">Facilities Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[160px]" data-testid="select-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="overdue">Overdue Only</SelectItem>
              <SelectItem value="due_soon">Due Soon Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span>Overdue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-orange-500"></div>
          <span>Due Soon</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span>On Track</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <span>Facility</span>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="h-[500px] w-full">
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {markers.map(marker => (
                <Marker
                  key={marker.id}
                  position={[marker.lat, marker.lng]}
                  icon={getMarkerIcon(marker.status)}
                  eventHandlers={{
                    click: () => setLocation(marker.profileUrl),
                  }}
                >
                  <Popup>
                    <div className="text-sm space-y-1">
                      <p className="font-bold">{marker.tooltipTitle}</p>
                      <p className="text-muted-foreground">{marker.tooltipDetails}</p>
                      <p className="text-xs text-blue-600 cursor-pointer">Click marker to view profile</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {facilityMarkers.map(f => (
                <Marker
                  key={f.id}
                  position={[f.lat, f.lng]}
                  icon={blueIcon}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold flex items-center gap-1">
                        <Hospital className="w-3 h-3" />
                        {f.name}
                      </p>
                      <p className="text-muted-foreground">Barangay: {f.barangay}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
