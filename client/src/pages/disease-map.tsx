import { useQuery } from "@tanstack/react-query";
import type { DiseaseCase, HealthStation } from "@shared/schema";
import { isOutbreakCondition } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, AlertTriangle } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const createIcon = (color: string) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const stationIcon = createIcon('#22c55e');
const outbreakIcon = createIcon('#ef4444');

export default function DiseaseMap() {
  const { data: cases = [], isLoading: casesLoading } = useQuery<DiseaseCase[]>({ queryKey: ['/api/disease-cases'] });
  const { data: stations = [], isLoading: stationsLoading } = useQuery<HealthStation[]>({ queryKey: ['/api/health-stations'] });

  const outbreak = isOutbreakCondition(cases);

  const barangayCaseCounts = cases.reduce((acc, c) => {
    if (c.status !== 'Closed') {
      acc[c.barangay] = (acc[c.barangay] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const conditionCounts = cases.reduce((acc, c) => {
    if (c.status !== 'Closed') {
      acc[c.condition] = (acc[c.condition] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  if (casesLoading || stationsLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading map...</p></div>;
  }

  const center: [number, number] = stations.length > 0 
    ? [parseFloat(stations[0].latitude), parseFloat(stations[0].longitude)]
    : [9.66, 125.68];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <MapPin className="w-6 h-6 text-orange-500" />
          Disease Surveillance Map
        </h1>
        <p className="text-muted-foreground">Geographic distribution of disease cases</p>
      </div>

      {outbreak.isOutbreak && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">Outbreak Alert: {outbreak.condition}</p>
                <p className="text-sm text-muted-foreground">{outbreak.count} cases in the last 14 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="md:col-span-3">
          <CardContent className="p-0">
            <div className="h-[500px] rounded-md overflow-hidden">
              <MapContainer 
                center={center} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                {stations.map(station => {
                  const count = barangayCaseCounts[station.barangay] || 0;
                  const isHotspot = count >= 3;
                  return (
                    <Marker 
                      key={station.id}
                      position={[parseFloat(station.latitude), parseFloat(station.longitude)]}
                      icon={isHotspot ? outbreakIcon : stationIcon}
                    >
                      <Popup>
                        <div className="p-1">
                          <p className="font-semibold">{station.facilityName}</p>
                          <p className="text-sm text-muted-foreground">{station.barangay}</p>
                          <p className="text-sm mt-1">Active cases: {count}</p>
                          {isHotspot && (
                            <p className="text-sm text-destructive font-medium mt-1">Potential hotspot</p>
                          )}
                        </div>
                      </Popup>
                      {isHotspot && (
                        <Circle
                          center={[parseFloat(station.latitude), parseFloat(station.longitude)]}
                          radius={500}
                          pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.1 }}
                        />
                      )}
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cases by Barangay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(barangayCaseCounts)
                  .sort(([,a], [,b]) => b - a)
                  .map(([barangay, count]) => (
                    <div key={barangay} className="flex items-center justify-between text-sm">
                      <span>{barangay}</span>
                      <Badge variant={count >= 3 ? 'destructive' : 'secondary'}>{count}</Badge>
                    </div>
                  ))}
                {Object.keys(barangayCaseCounts).length === 0 && (
                  <p className="text-sm text-muted-foreground">No active cases</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cases by Condition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(conditionCounts)
                  .sort(([,a], [,b]) => b - a)
                  .map(([condition, count]) => (
                    <div key={condition} className="flex items-center justify-between text-sm">
                      <span className="truncate">{condition}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
