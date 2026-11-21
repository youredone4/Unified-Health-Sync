# Map images for the disease map

These PNG files are the background of the Disease Heat Index Map. They are
ordinary OpenStreetMap tiles for the area of Placer, Surigao del Norte,
downloaded once (2026-11-22) with `script/fetch-map-tiles.mjs` and served by
HealthSync itself. The map therefore needs no API key and no outside
service, and it works on an office network without internet.

Only the tiles the fixed map view can ask for are here (115 files, zoom
11 to 14). To refresh them, delete this folder's `11`–`14` subfolders and
run `node script/fetch-map-tiles.mjs`.

## Licence

Map data © OpenStreetMap contributors, available under the Open Database
License (ODbL). The cartography of these tiles is licensed CC BY-SA 2.0.
See https://www.openstreetmap.org/copyright. The map shows the required
"© OpenStreetMap contributors" credit; keep it.
