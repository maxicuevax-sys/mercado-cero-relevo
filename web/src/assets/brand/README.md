# Mercado Cero — brand raster assets

These PNGs are **exact pixel crops of the two user-provided image sheets**. No artwork was generated, redrawn, vectorized, recolored, or background-removed.

## Provenance

| Sheet | Original file | Size |
| --- | --- | --- |
| Illustrations | `Imagen de ChatGPT 3 nov 2026, 06_52_11 a.m-10.png` | 1448 x 1086 |
| Icons | `Imagen de ChatGPT 3 nov 2026, 06_52_10 a.m-9.png` | 1448 x 1086 |

The exact source paths and SHA-256 checksums are recorded in `manifest.json`.

## How the crops were made

- Background color was sampled from the top-left corner of each sheet (cream, approximately `#FBF3E7`). The sheets have a very subtle cream gradient, so corner samples vary slightly.
- Foreground was keyed with a small tolerance: maximum per-channel difference from the sampled background greater than 12. Tiny isolated specks below 40 px were ignored so compression noise would not inflate the bounds.
- Artwork was segmented by row and horizontal-gap projections. This matters because the puesto plant, the taco cloth, and the centered third icon row cross the naive grid lines; cropping on fixed cell edges would have clipped them.
- Each crop adds **16 px of padding** around the detected artwork and is clamped to the sheet. The cream background is intentionally kept — these are RGB PNGs with no alpha channel.
- Images were resized only when the padded crop exceeded its limit, using Pillow's LANCZOS filter:
  - illustrations: maximum 640 px on the longest side;
  - icons: maximum 256 px on the longest side.
- PNGs are saved with `optimize=True`.

## Contents

### `ilustraciones/` (3 x 2 sheet order)

| Order | File | Crop box [l, t, r, b] | Size |
| --- | --- | --- | --- |
| 1 | `ilustraciones/lupita.png` | `[25, 90, 440, 536]` | 415 x 446 |
| 2 | `ilustraciones/puesto.png` | `[438, 80, 978, 524]` | 540 x 444 |
| 3 | `ilustraciones/qr.png` | `[982, 76, 1419, 534]` | 437 x 458 |
| 4 | `ilustraciones/ahorro.png` | `[18, 581, 451, 1020]` | 433 x 439 |
| 5 | `ilustraciones/bot.png` | `[478, 594, 913, 1008]` | 435 x 414 |
| 6 | `ilustraciones/tacos.png` | `[925, 568, 1423, 1038]` | 498 x 470 |

### `iconos/` (5 + 5 + 3 sheet order)

| Order | File | Crop box [l, t, r, b] | Size |
| --- | --- | --- | --- |
| 1 | `iconos/tienda.png` | `[59, 112, 326, 352]` | 256 x 230 |
| 2 | `iconos/recibo.png` | `[362, 134, 558, 359]` | 196 x 225 |
| 3 | `iconos/libreta.png` | `[607, 138, 819, 357]` | 212 x 219 |
| 4 | `iconos/caja.png` | `[871, 143, 1093, 364]` | 222 x 221 |
| 5 | `iconos/camion.png` | `[1142, 159, 1406, 342]` | 256 x 177 |
| 6 | `iconos/registradora.png` | `[54, 433, 304, 678]` | 250 x 245 |
| 7 | `iconos/meta.png` | `[340, 440, 567, 674]` | 227 x 234 |
| 8 | `iconos/lista.png` | `[612, 415, 828, 680]` | 209 x 256 |
| 9 | `iconos/reporte.png` | `[862, 465, 1109, 652]` | 247 x 187 |
| 10 | `iconos/ayuda.png` | `[1153, 431, 1392, 669]` | 239 x 238 |
| 11 | `iconos/ajustes.png` | `[300, 758, 538, 986]` | 238 x 228 |
| 12 | `iconos/qr-telefono.png` | `[610, 728, 844, 1000]` | 220 x 256 |
| 13 | `iconos/microfono.png` | `[889, 761, 1152, 999]` | 256 x 232 |

The third icon row is centered on the sheet; it was cropped as three real icons (`ajustes`, `qr-telefono`, `microfono`), with no empty cells.

`contact-sheet.png` is a quick visual review sheet showing all 6 illustrations and 13 icons with labels. `manifest.json` is the machine-readable source of truth for output paths, source sheets, crop boxes, and dimensions.

## Using these assets

- **The background is cream, not transparent.** Place these images on cream or near-cream surfaces. The design cream is approximately `#FBF3E7`; the retained sheet background blends there. On a contrasting background the crop rectangle will be visible.
- If you need transparent cutouts or a different background color, that is a new asset export — do not key these files, since the artwork itself contains cream-colored areas.
- Keep the native dimensions; avoid upscaling beyond the sizes listed above.
- Do not crop tighter than the supplied padding if you want to preserve the soft edges of the artwork.

No application source files were modified while producing these assets.
