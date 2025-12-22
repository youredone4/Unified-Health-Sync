import { useQuery } from "@tanstack/react-query";
import type { HealthStation } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Hospital, Phone, Clock } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

export default function MapPage() {
  const { data: stations = [], isLoading } = useQuery<HealthStation[]>({ queryKey: ['/api/health-stations'] });

  const center = { lat: 9.6573, lng: 125.68 };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <MapPin className="w-6 h-6 text-green-400" />
          Health Facilities Map
        </h1>
        <p className="text-muted-foreground">Placer Municipality Health Stations</p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="h-[400px] w-full">
            <MapContainer
              center={[center.lat, center.lng]}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {stations.map(station => (
                <Marker key={station.id} position={[parseFloat(station.latitude), parseFloat(station.longitude)]}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold">{station.facilityName}</p>
                      <p>{station.barangay}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stations.map(station => (
          <Card key={station.id} data-testid={`station-${station.id}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Hospital className="w-4 h-4 text-green-400" />
                {station.facilityName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{station.barangay}</p>
              <div className="flex items-start gap-2">
                <MapPin className="w-3 h-3 mt-1 text-muted-foreground" />
                <span>Lat: {station.latitude}, Lng: {station.longitude}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
