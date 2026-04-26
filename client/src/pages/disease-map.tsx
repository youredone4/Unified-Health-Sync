import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { DiseaseCase } from "@shared/schema";
import { useBarangay } from "@/contexts/barangay-context";
import { isOutbreakCondition, TODAY_STR } from "@/lib/healthLogic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, ChevronRight, ChevronDown } from "lucide-react";
import { MapContainer, TileLayer, Circle, Popup, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DashboardShell, FilterBar, type AlertSpec } from "@/components/dashboard-shell";

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
  const [expandedBarangay, setExpandedBarangay] = useState<string | null>(null);
  const [expandedCondition, setExpandedCondition] = useState<string | null>(null);

  const outbreak = isOutbreakCondition(cases);

  const activeCases = cases.filter(c => c.status !== 'Closed');

  const barangayCaseCounts = activeCases.reduce((acc, c) => {
    acc[c.barangay] = (acc[c.barangay] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const conditionCounts = activeCases.reduce((acc, c) => {
    acc[c.condition] = (acc[c.condition] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Two pivot tables for the drilldowns:
  //   - conditionsByBarangay: for each barangay, a count per condition
  //   - barangaysByCondition: for each condition, a count per barangay
  const conditionsByBarangay = activeCases.reduce((acc, c) => {
    if (!acc[c.barangay]) acc[c.barangay] = {};
    acc[c.barangay][c.condition] = (acc[c.barangay][c.condition] || 0) + 1;
    return acc;
  }, {} as Record<string, Record<string, number>>);

  const barangaysByCondition = activeCases.reduce((acc, c) => {
    if (!acc[c.condition]) acc[c.condition] = {};
    acc[c.condition][c.barangay] = (acc[c.condition][c.barangay] || 0) + 1;
    return acc;
  }, {} as Record<string, Record<string, number>>);

  const maxCases = Math.max(...Object.values(barangayCaseCounts), 1);

  const heatPoints = Object.entries(BARANGAY_COORDS).map(([barangay, coords]) => {
    const count = barangayCaseCounts[barangay] || 0;
    const intensity = Math.min(count / maxCases, 1);
    return { barangay, coords, count, intensity };
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading map...</p></div>;
  }

  // Compute bounds that snug around all 20 barangays so the map shows
  // every catchment without manual zoom. Locked-zoom + locked-pan below
  // turns the map into a fixed reference view (page scroll no longer
  // hijacks zoom, and operators can't accidentally lose their place).
  const mapBounds: [[number, number], [number, number]] = (() => {
    const coords = Object.values(BARANGAY_COORDS);
    const lats = coords.map(([lat]) => lat);
    const lngs = coords.map(([, lng]) => lng);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
  })();

  const alerts: AlertSpec[] = [];
  if (outbreak.isOutbreak) {
    alerts.push({
      severity: "critical",
      message: `Outbreak alert — ${outbreak.condition}: ${outbreak.count} cases in the last 14 days.`,
      cta: { label: "Open Disease", path: "/disease" },
      testId: "alert-outbreak",
    });
  }

  return (
    <DashboardShell
      title="Disease Heat Index Map"
      subtitle="Heat intensity shows disease case concentration across all 20 barangays"
      filterBar={<FilterBar dataAsOf={TODAY_STR} />}
      alerts={alerts}
      diagnostic={
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
                bounds={mapBounds}
                boundsOptions={{ padding: [30, 30] }}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                touchZoom={false}
                boxZoom={false}
                keyboard={false}
                dragging={false}
                zoomControl={false}
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
                        <Popup minWidth={240} maxWidth={320}>
                          <div className="p-2 min-w-[240px]">
                            <p className="font-semibold text-base flex items-center gap-1.5">
                              <MapPin className="w-4 h-4" />
                              {barangay}
                            </p>
                            <p className="text-sm mt-2">Active cases: <strong>{count}</strong></p>
                            <p className="text-sm">
                              Risk level:{" "}
                              <span style={{ color: heatColor(intensity), fontWeight: 600 }}>
                                {risk.label}
                              </span>
                            </p>
                            {count > 0 && conditionsByBarangay[barangay] && (
                              <div className="mt-3 pt-2 border-t border-gray-200">
                                <p className="text-sm font-medium text-gray-700 mb-1">Conditions</p>
                                <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                  {Object.entries(conditionsByBarangay[barangay])
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([condition, n]) => (
                                      <div key={condition} className="flex items-center justify-between text-sm gap-3">
                                        <span className="truncate">{condition}</span>
                                        <strong className="flex-shrink-0">{n}</strong>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                            {count > 0 && (
                              <button
                                type="button"
                                onClick={() => navigate(`/disease/registry?barangay=${encodeURIComponent(barangay)}`)}
                                className="mt-3 text-sm text-blue-600 hover:underline font-medium"
                              >
                                View all cases →
                              </button>
                            )}
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
                    const isExpanded = expandedBarangay === barangay;
                    const conds = conditionsByBarangay[barangay] || {};
                    return (
                      <div key={barangay}>
                        <button
                          type="button"
                          onClick={() => setExpandedBarangay(isExpanded ? null : barangay)}
                          disabled={count === 0}
                          className="w-full flex items-center justify-between text-sm gap-2 px-2 py-1.5 rounded-md hover:bg-muted focus:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors group disabled:opacity-60 disabled:cursor-default disabled:hover:bg-transparent"
                          data-testid={`heat-index-row-${barangay}`}
                          aria-expanded={isExpanded}
                          title={count === 0 ? "No active cases" : isExpanded ? "Hide breakdown" : "Show condition breakdown"}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ background: heatColor(intensity) }}
                            />
                            <span className="truncate">{barangay}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Badge variant={risk.variant} className="text-xs">{count}</Badge>
                            {count > 0 && (
                              isExpanded
                                ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                : <ChevronRight className="w-3 h-3 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </button>
                        {isExpanded && count > 0 && (
                          <div className="ml-5 mt-1 mb-2 border-l-2 pl-3 space-y-1" data-testid={`heat-index-breakdown-${barangay}`}>
                            {Object.entries(conds)
                              .sort(([, a], [, b]) => b - a)
                              .map(([condition, n]) => (
                                <div key={condition} className="flex items-center justify-between text-xs gap-2">
                                  <span className="truncate text-muted-foreground">{condition}</span>
                                  <Badge variant="outline" className="text-[10px] h-4 flex-shrink-0">{n}</Badge>
                                </div>
                              ))}
                            <button
                              type="button"
                              onClick={() => navigate(`/disease/registry?barangay=${encodeURIComponent(barangay)}`)}
                              className="text-xs text-blue-600 hover:underline font-medium mt-1"
                              data-testid={`heat-index-view-cases-${barangay}`}
                            >
                              View all cases →
                            </button>
                          </div>
                        )}
                      </div>
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
              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {Object.entries(conditionCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([condition, count]) => {
                    const isExpanded = expandedCondition === condition;
                    const brgys = barangaysByCondition[condition] || {};
                    return (
                      <div key={condition}>
                        <button
                          type="button"
                          onClick={() => setExpandedCondition(isExpanded ? null : condition)}
                          className="w-full flex items-center justify-between text-sm gap-2 px-2 py-1.5 rounded-md hover:bg-muted focus:bg-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors group"
                          data-testid={`condition-row-${condition}`}
                          aria-expanded={isExpanded}
                          title={isExpanded ? "Hide barangay breakdown" : "Show barangay breakdown"}
                        >
                          <span className="truncate">{condition}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Badge variant="outline">{count}</Badge>
                            {isExpanded
                              ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                              : <ChevronRight className="w-3 h-3 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity" />}
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="ml-3 mt-1 mb-2 border-l-2 pl-3 space-y-1" data-testid={`condition-breakdown-${condition}`}>
                            {Object.entries(brgys)
                              .sort(([, a], [, b]) => b - a)
                              .map(([brgy, n]) => (
                                <button
                                  key={brgy}
                                  type="button"
                                  onClick={() => navigate(`/disease/registry?barangay=${encodeURIComponent(brgy)}&condition=${encodeURIComponent(condition)}`)}
                                  className="w-full flex items-center justify-between text-xs gap-2 px-1 py-1 rounded hover:bg-muted transition-colors"
                                  data-testid={`condition-brgy-${condition}-${brgy}`}
                                  title={`View ${condition} cases in ${brgy}`}
                                >
                                  <span className="truncate text-muted-foreground">{brgy}</span>
                                  <Badge variant="secondary" className="text-[10px] h-4 flex-shrink-0">{n}</Badge>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
      }
    />
  );
}
