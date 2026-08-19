# Camera-Ready PDF Build

`HealthSync-IDAP2026005-camera-ready.pdf` is the revised manuscript rendered
in the same IEEE two-column US-Letter conference format as the original
submission. The 11 figures are the originals, extracted losslessly from the
submitted PDF (`pdfimages -png`).

## To rebuild after editing

1. Edit `paper.html` (it is the single source for the PDF).
2. Run:

   ```bash
   chromium --headless=new --disable-gpu --no-pdf-header-footer \
     --print-to-pdf=HealthSync-IDAP2026005-camera-ready.pdf \
     "file://$PWD/paper.html"
   ```

   Any Chromium/Chrome works; the font stack falls back to Liberation Serif,
   which is metrically identical to Times New Roman.

## Before submitting — fill these placeholders in `paper.html`

- **Table Ib** — the Cronbach's α cells are `0.XXX`. Run
  `python ../scripts/cronbach.py survey-responses.csv` and paste the values.
- **Pilot barangay names** — `[Pilot Brgy 1]`, `[Pilot Brgy 2]`,
  `[Pilot Brgy 3]` appear twice (§V opening and §V-E).
- **IEEE copyright notice** — the conference will supply the exact copyright
  line (e.g. `979-8-3503-XXXX-X/26/$31.00 ©2026 IEEE`); add it as a
  first-page footnote once you receive it. It is deliberately absent here
  because the code is assigned by IEEE, not by the authors.

Then rebuild and run the result through IEEE PDF eXpress. If eXpress flags
font-embedding issues, the fallback path is to paste the section text from
`../full-revised-paper.md` into the official IEEE Word/LaTeX template —
the content is identical.
