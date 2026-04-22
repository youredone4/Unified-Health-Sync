import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { DiseaseCase } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { isOutbreakCondition } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, AlertTriangle, Thermometer, ChevronRight } from "lucide-react";
import { MapContainer, TileLayer, Circle, Popup, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const BARANGAY_COORDS: Record<string, [number, number]> = {
  "Amoslog":            [9.6392, 125.5980],
  "Anislagan":          [9.6220, 125.5489],
  "Bad-as":             [9.6328, 125.5672],
  "Badas":              [9.6469, 125.6073],
  "Banga":              [9.6752, 125.6284],
  "Central (Poblacion)":[9.6564, 125.6023],
  "Ellaperal":          [9.6968, 125.6507],
  "Ipil":               [9.6530, 125.6041],
  "Lakandula":          [9.6715, 125.6525],
  "Mabini":             [9.6249, 125.5663],
  "Magsaysay":          [9.6608, 125.5906],
  "Mahaba":             [9.6845, 125.6420],
  "Masapelid":          [9.6951, 125.6296],
  "Pananay-an":         [9.6175, 125.6125],
  "Panhutongan":        [9.6317, 125.6166],
  "San Isidro":         [9.6463, 125.5483],
  "Santa Cruz":         [9.6336, 125.5613],
  "Suyoc":              [9.6636, 125.5751],
  "Tagbongabong":       [9.6488, 125.6209],
  "Tinago":             [9.6704, 125.6397],
};

function heatColor(intensity: number): string {
  if (intensity <= 0) return "#22c55e";
  if (intensity < 0.25) {
    const t = intensity / 0.25;
    const r = Math.round(34 + t * (234 - 34));
    const g = Math.round(197 + t * (179 - 197));
    const b = Math.round(94 + t * (8 - 94));
    return `rgb(${r},${g},${b})`;
  }
  if (intensity < 0.5) {
    const t = (intensity - 0.25) / 0.25;
    const r = Math.round(234 + t * (249 - 234));
    const g = Math.round(179 + t * (115 - 179));
    const b = Math.round(8 + t * (22 - 8));
    return `rgb(${r},${g},${b})`;
  }
  if (intensity < 0.75) {
    const t = (intensity - 0.5) / 0.25;
    const r = Math.round(249 + t * (239 - 249));
    const g = Math.round(115 + t * (68 - 115));
    const b = Math.round(22 + t * (68 - 22));
    return `rgb(${r},${g},${b})`;
  }
  const t = (intensity - 0.75) / 0.25;
  const r = Math.round(239 + t * (185 - 239));
  const g = Math.round(68 + t * (28 - 68));
  const b = Math.round(68 + t * (28 - 68));
  return `rgb(${r},${g},${b})`;
}

function riskLabel(intensity: number): { label: string; variant: "destructive" | "secondary" | "outline" } {
  if (intensity >= 0.75) return { label: "Critical", variant: "destructive" };
  if (intensity >= 0.5) return { label: "High", variant: "destructive" };
  if (intensity >= 0.25) return { label: "Moderate", variant: "secondary" };
  if (intensity > 0) return { label: "Low", variant: "outline" };
  return { label: "None", variant: "outline" };
}

const centerIcon = L.divIcon({
  className: "custom-center",
  html: `<div style="width:8px;height:8px;background:rgba(0,0,0,0.5);border-radius:50%;border:1px solid white;margin:auto;"></div>`,
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

export default function DiseaseMap() {
  const [, navigate] = useLocation();
  const { scopedPath } = useBarangay();
  const { data: cases = [], isLoading } = useQuery<DiseaseCase[]>({ queryKey: [scopedPath('/api/disease-cases')] });

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

  const maxCases = Math.max(...Object.values(barangayCaseCounts), 1);

  const heatPoints = Object.entries(BARANGAY_COORDS).map(([barangay, coords]) => {
    const count = barangayCaseCounts[barangay] || 0;
    const intensity = Math.min(count / maxCases, 1);
    return { barangay, coords, count, intensity };
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading map...</p></div>;
  }

  const mapCenter: [number, number] = [9.6564, 125.6023];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Thermometer className="w-6 h-6 text-orange-500" />
          Disease Heat Index Map
        </h1>
        <p className="text-muted-foreground">Heat intensity shows disease case concentration across all 20 barangays</p>
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

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Placer, Surigao del Norte — 20 Barangays</CardTitle>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span> None
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-yellow-500"></span> Low
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span> Moderate
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <span className="inline-block w-3 h-3 rounded-full bg-red-600"></span> High/Critical
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[600px] rounded-b-md overflow-hidden">
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
                {heatPoints.map(({ barangay, coords, count, intensity }) => {
                  const color = heatColor(intensity);
                  const risk = riskLabel(intensity);
                  return (
                    <div key={barangay}>
                      <Circle
                        center={coords}
                        radius={900}
                        pathOptions={{ color: "transparent", fillColor: color, fillOpacity: 0.12 }}
                      />
                      <Circle
                        center={coords}
                        radius={600}
                        pathOptions={{ color: "transparent", fillColor: color, fillOpacity: 0.20 }}
                      />
                      <Circle
                        center={coords}
                        radius={380}
                        pathOptions={{ color: "transparent", fillColor: color, fillOpacity: 0.32 }}
                      />
                      <Circle
                        center={coords}
                        radius={200}
                        pathOptions={{ color: color, fillColor: color, fillOpacity: 0.55, weight: 1 }}
                      >
                        <Popup>
                          <div className="p-1 min-w-[140px]">
                            <p className="font-semibold flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {barangay}
                            </p>
                            <p className="text-sm mt-1">Active cases: <strong>{count}</strong></p>
                            <p className="text-sm">
                              Risk level:{" "}
                              <span style={{ color: heatColor(intensity), fontWeight: 600 }}>
                                {risk.label}
                              </span>
                            </p>
                          </div>
                        </Popup>
                      </Circle>
                      <Marker
                        position={coords}
                        icon={L.divIcon({
                          className: "",
                          html: `<div style="font-size:9px;color:#1e293b;background:rgba(255,255,255,0.75);padding:1px 3px;border-radius:3px;white-space:nowrap;font-weight:600;line-height:1.3;box-shadow:0 1px 3px rgba(0,0,0,0.2)">${barangay}</div>`,
                          iconSize: [80, 16],
                          iconAnchor: [40, -6],
                        })}
                      />
                    </div>
                  );
                })}
              </MapContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Heat Index by Barangay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {heatPoints
                  .sort((a, b) => b.count - a.count)
                  .map(({ barangay, count, intensity }) => {
                    const risk = riskLabel(intensity);
                    return (
                      <button
                        key={barangay}
                        type="button"
                        onClick={() => navigate(`/disease/registry?barangay=${encodeURIComponent(barangay)}`)}
                        className="w-full flex items-center justify-between text-sm gap-2 px-2 py-1.5 rounded-md hover:bg-muted focus:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors group"
                        data-testid={`heat-index-row-${barangay}`}
                        title={`View disease cases for ${barangay}`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: heatColor(intensity) }}
                          />
                          <span className="truncate group-hover:underline">{barangay}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge variant={risk.variant} className="text-xs">{count}</Badge>
                          <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cases by Condition</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {Object.entries(conditionCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([condition, count]) => (
                    <div key={condition} className="flex items-center justify-between text-sm">
                      <span className="truncate">{condition}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                {Object.keys(conditionCounts).length === 0 && (
                  <p className="text-sm text-muted-foreground">No active cases</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs">
                {[
                  { color: "#22c55e", label: "None — 0 cases" },
                  { color: "#eab308", label: "Low — 1–2 cases" },
                  { color: "#f97316", label: "Moderate — 3–4 cases" },
                  { color: "#ef4444", label: "High — 5–7 cases" },
                  { color: "#b91c1c", label: "Critical — 8+ cases" },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-sm flex-shrink-0" style={{ background: color, opacity: 0.8 }} />
                    <span>{label}</span>
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
