/**
 * The 20 barangays of Placer, Surigao del Norte, with an approximate centre
 * point for each. One list for the whole system: the server seeds the
 * barangays table from it and the dashboards and the disease map read it.
 *
 * Names are the ones stored in the database (and so on every patient
 * record); do not rename one here without migrating the records.
 *
 * Coordinates are the barangay points published by PhilAtlas (checked
 * 2026-11-22), which agree with the OpenStreetMap village points to within
 * a few hundred metres. They mark where the barangay is, not its boundary.
 * Ellaperal, Lakandula and Sani-sani are on Masapelid Island.
 */
export const PLACER_BARANGAY_POINTS: Record<string, [lat: number, lng: number]> = {
  "Amoslog": [9.6392, 125.598],
  "Anislagan": [9.622, 125.5489],
  "Bad-as": [9.6328, 125.5672],
  "Boyongan": [9.609, 125.5675],
  "Bugas-bugas": [9.6526, 125.575],
  "Central (Poblacion)": [9.6564, 125.6023],
  "Ellaperal (Nonok)": [9.6968, 125.6507],
  "Ipil (Poblacion)": [9.653, 125.6041],
  "Lakandula": [9.6715, 125.6525],
  "Mabini": [9.6249, 125.5663],
  "Macalaya": [9.617, 125.5636],
  "Magsaysay (Poblacion)": [9.6572, 125.5997],
  "Magupange": [9.6526, 125.5579],
  "Pananay-an": [9.6175, 125.6125],
  "Panhutongan": [9.6317, 125.6166],
  "San Isidro": [9.6463, 125.5483],
  "Sani-sani": [9.6908, 125.6435],
  "Santa Cruz": [9.6336, 125.5613],
  "Suyoc": [9.6636, 125.5751],
  "Tagbongabong": [9.6254, 125.6028],
};

export const PLACER_BARANGAYS: string[] = Object.keys(PLACER_BARANGAY_POINTS);

/** The box around all 20 points: what the disease map shows. */
export const PLACER_MAP_BOUNDS: [[number, number], [number, number]] = (() => {
  const points = Object.values(PLACER_BARANGAY_POINTS);
  const lats = points.map(([lat]) => lat);
  const lngs = points.map(([, lng]) => lng);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
})();
