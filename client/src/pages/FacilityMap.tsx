import { Layout } from "@/components/Layout";
import { useHealthStations } from "@/hooks/use-health-stations";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { divIcon } from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Activity } from "lucide-react";

export default function FacilityMap() {
  const { data: stations, isLoading } = useHealthStations();

  // Create custom marker icon
  const createIcon = () => {
    const iconMarkup = renderToStaticMarkup(
      <div className="bg-primary text-primary-foreground p-2 rounded-full border-2 border-white shadow-xl">
        <Activity className="w-5 h-5" />
      </div>
    );
    return divIcon({
      html: iconMarkup,
      className: 'bg-transparent',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -20]
    });
  };

  // Default center if no data (Manila approx)
  const defaultCenter: [number, number] = [14.6, 121.0];

  return (
    <Layout title="Facility Map" subtitle="Health Station Locations & Hotspots">
      <div className="h-[600px] w-full rounded-xl overflow-hidden border border-border shadow-lg bg-card relative">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">Loading Map...</div>
        ) : (
          <MapContainer 
            center={stations && stations.length > 0 ? [parseFloat(stations[0].latitude), parseFloat(stations[0].longitude)] : defaultCenter} 
            zoom={13} 
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {stations?.map((station) => (
              <Marker 
                key={station.id} 
                position={[parseFloat(station.latitude), parseFloat(station.longitude)]}
                icon={createIcon()}
              >
                <Popup className="custom-popup">
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-bold text-lg mb-1">{station.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">Brgy. {station.barangay}</p>
                    <div className="text-xs space-y-1 border-t pt-2">
                      <div className="flex justify-between text-red-600 font-semibold">
                        <span>Overdue Vaccines:</span>
                        <span>3</span>
                      </div>
                      <div className="flex justify-between text-orange-600 font-semibold">
                        <span>Prenatal Due:</span>
                        <span>5</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </Layout>
  );
}
