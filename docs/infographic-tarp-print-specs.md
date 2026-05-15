# Tarpaulin print specifications

For `docs/infographic-tarp.svg`.

## Final size

| Dimension | Value |
|---|---|
| Width | 2.5 ft / 30 inches / 76.2 cm |
| Height | 6 ft / 72 inches / 182.9 cm |
| Aspect ratio | 5 : 12 |
| Orientation | Portrait |

## Source file

`docs/infographic-tarp.svg`

- Format: SVG (Scalable Vector Graphics) — vector, scales to any size with no quality loss.
- viewBox: 1500 × 3600 (matches the 5:12 ratio exactly).
- Color profile: sRGB. Most tarp printers handle the sRGB → CMYK conversion automatically.
- Fonts: uses generic web-safe stack (Inter, system-ui, Segoe UI). The print shop may need to **convert text to outlines** before sending to the press — see "What to ask the printer" below.

## What to give the printer

Option A (easiest) — hand them the SVG and ask them to handle conversion:
- They open it in Illustrator or Inkscape, convert text to outlines, export to high-resolution PDF or TIFF.

Option B (your end) — convert it yourself first:
- Open the SVG in Inkscape (free, https://inkscape.org).
- Menu: **File → Export → As → PDF**. Choose "Convert text to paths" in the export dialog.
- Send the resulting PDF to the printer.

Option C — raster export at 150 DPI:
- 150 DPI × 30 inches = 4500 px wide
- 150 DPI × 72 inches = 10800 px tall
- File size will be large (~50-100 MB PNG). Most printers accept this if PDF is not workable.

## Bleed and safe zones

- Bleed: **0.5 inch (1.27 cm) all around**. The dashed gray border in the SVG marks the safe zone — content inside it will survive trimming. The artwork already fills out to the edge with a flat color band, which is correct for bleed.
- No important text/logos should sit within 1 inch of any edge.

## Grommets and finishing

Standard tarp grommets are placed every 2 ft along the edges and at each corner. For a 2.5 × 6 ft tarp that's typically:
- 4 corner grommets
- 2 additional grommets on each long edge (so 8 total)

Confirm grommet placement with the print shop. Their punch should not land on text or logos.

## What to ask the printer

1. "Can you accept SVG directly, or do you need PDF / TIFF?"
2. "Do you need text converted to outlines, or do you have the fonts?" (The SVG uses generic system fonts; if they want exact rendering, ask them to use **Inter** or convert text to outlines first.)
3. "Confirm 0.5-inch bleed on all sides."
4. "Confirm grommet placement: 4 corners + 2 on each long edge."
5. Ask for a **digital proof** (a small JPEG preview of what they'll print) before they commit the press. Check that:
   - Colors look correct (especially the emerald header `#047857`)
   - Text isn't pixelated anywhere
   - Bleed is clean (no white edges)

## Color targets (for proofing)

| Element | Hex (sRGB) | CMYK approximate |
|---|---|---|
| Header emerald | `#047857` | C90 M20 Y75 K15 |
| Stat accent — sky blue | `#0284c7` | C85 M50 Y0 K0 |
| Stat accent — red | `#dc2626` | C10 M95 Y95 K0 |
| Stat accent — amber | `#f59e0b` | C0 M40 Y95 K0 |
| Card border purple | `#7c3aed` | C70 M75 Y0 K0 |
| Background | `#f8fafc` | C2 M1 Y1 K0 |
| Dark footer | `#0f172a` | C90 M80 Y50 K85 |

The printer will do their own CMYK conversion. These approximate values are for visual reference if they ask.

## If you want to tweak the design before printing

Open the SVG in any of:

- **Browser** (read-only view): double-click the file
- **VS Code**: every label is an editable XML text node — search and replace works
- **Inkscape** (free vector editor): drag-drop, edit visually, re-save
- **Figma** (free, browser-based): drag-drop the SVG, edit, export

Common easy edits:

- Change tagline → search for "Unified clinical surveillance" in the file
- Change the headline numbers → search for `28+` or `192` or `5` or `6` (in the stat tile section)
- Swap a logo placeholder → the `<circle>` + `<path>` in the header is a simple checkmark; replace with your real logo
- Change region/LGU name → search for "Caraga Region" or "Surigao del Norte"

## Backup digital version

`docs/infographic.svg` is the same content sized for screen/digital sharing (1200 × 2700, 4:9 aspect). Use that for slides and social posts. Use `infographic-tarp.svg` only for print.
