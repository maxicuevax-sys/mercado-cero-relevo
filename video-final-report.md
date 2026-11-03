# Video final — UI definitiva, corte $550 y “Cuadra”

## Estado

- Rama: `p0/video-final`; base: `791b590` (`test(webhook): elegir puerto libre...`).
- Servidor: aislado en `http://127.0.0.1:3310`, SQLite temporal en
  `%TEMP%\opencode\video-final-3310\data`, `DEMO_MODE=true`, `APP_URL` local.
  **No** se usó `mercado-cero`, `:3000`, `:3230` ni la preview.
- Build: `npm run build` sellado con
  `BUILD_SHA=791b5906d57d0a8fc04eaa9f557b04eb0c6b1bd8`; `/api/health` devolvió
  el mismo SHA durante la grabación. El commit del carril no toca `web/src`, así
  que el build de la app sigue siendo `791b590`.
- Estado: **grabado y verificado**. No hay merge.

## Entregables

| Artefacto | Valor |
|---|---|
| MP4 | `demo/mercado-cero-demo.mp4` |
| SHA-256 MP4 | `ba4d068e6da68c68263b9d9a96e4f451320260dfefaf4263e9213c812604bbd0` |
| Bytes | `5,406,880` (5.2 MB) |
| Duración | `183.72 s` (3:03.7) |
| Resolución / códec | `1280×800`, H.264, 25 fps |
| Frames | `demo/stageshow/01-caja-en-reposo.png` … `08-meta.png` (8) |
| Manifiesto | `demo/record-demo.json` (15/15 checks; ignorado por git) |
| Contact sheet | `demo/stageshow/contact-sheet-1280.png` (generado, ignorado) |
| Motion sheet | `demo/stageshow/motion-sheet.png` (generado, ignorado) |

El MP4 anterior (39.8 s, 1,704,744 B, UI vieja, $570) quedó reemplazado solo
porque la corrida final terminó en verde. No se commitearía un video fallido.

## Verificación del corte

- API: `GET /api/cash` → `expectedCents: 55000` (`$500` de base + `$50` del
  abono de Juan en efectivo).
- UI visible: `$550.00`, `Cuadra` y
  “El efectivo cuadra con lo esperado.” en la pestaña **Corte**.
- Conteo usado: 5 × `$100`, 1 × `$50`, 0 × `$20`.
- `Guardar corte` → `Corte #1 guardado`.
- Meta: `$325.00` tras apartar `$25`.

## UI definitiva (copy verificado)

- Caja: `Ventas registradas hoy`, `Cobrado confirmado`, `Por cobrar de hoy`,
  `¿Qué vendiste?`, `Agregar a mano`.
- Cobro: `Pago demo (simulado)` y cierre `Cerrar demo` (nunca
  “Listo para entregar” para un demo).
- Corte: `Corte de caja` + `Antes de cerrar`.
- Pendientes: pestaña `Pendientes` y bandeja “Lo que queda para después.”
- No aparece el copy viejo `Mostrador claro`.

## Frames y hashes

| Frame | Bytes | SHA-256 |
|---|---:|---|
| 01-caja-en-reposo.png | 606,370 | `7626c240017cbce6bbbaa3e6c1a240493eb4d644c4c57668e6866f05b2cef1fb` |
| 02-venta-dictada.png | 510,566 | `13eda1b8fb7b0be0d0d262904af845d950bab6ea2a0f11ed42f5936a9ce2e35a` |
| 03-cobro-pendiente.png | 281,107 | `dbd1a66655efe8af96f4ab6fdc78ea9dbd2173ffa67e569989035e41f35afee8` |
| 04-link-y-qr.png | 266,908 | `bf6aa57998d38a5103bd0acae96aad79dca2d802b91e252bc7430b0d79818735` |
| 05-pago-simulado.png | 535,713 | `216a31455a3b0f7af9ddf404d0f3bb9f4170bf0812ddfd0ffdb990851f2554a9` |
| 06-comprobante-falso.png | 325,601 | `c4e3b9c6584cce9f847b6343056506124e76bb2b9dae26f2ebc4c7552639c0aa` |
| 07-corte.png | 412,647 | `43317f3e571b6ac08bd14a043429867c4af70e601a2baffe2db059c3416fca41` |
| 08-meta.png | 593,848 | `354f2b79c03dff5eaa0046ef56621a53428dbd8fff67dc4249bdc4139f54049d` |

## Checks de la grabación (15/15)

1. `app en Caja`
2. `servidor con build identificado` (`buildSha=791b590...`)
3. `UI definitiva en Caja`
4. `pestañas Caja/Fiado/Corte/Meta/Pendientes`
5. `venta de $90`
6. `pago demo confirmado`
7. `hoja de resultado cerrada`
8. `comprobante falso rechazado`
9. `abono de $50 en efectivo` (`balanceCents=0`, `cashCreditCents=5000`)
10. `consulta de ventas`
11. `Corte con 'Antes de cerrar'`
12. `corte espera $550` (`expectedCents=55000`)
13. `corte cuadra` (conteo por denominaciones)
14. `corte guardado` (`Corte #1 guardado`)
15. `meta avanza a $325`

`record-demo.json`: `allPassed: true`, 0 errores de consola bloqueantes (solo
el 503 esperado de `/api/tts` en el aislado).

## Gates

| Gate | Resultado |
|---|---|
| `npm ci` | OK (385 paquetes) |
| `npm run lint` | OK |
| `npx tsc --noEmit` | OK |
| `npm run build` | OK · `BUILD_SHA=791b5906d57d0a8fc04eaa9f557b04eb0c6b1bd8` |
| `python scripts/record-demo.py` (aislado `:3310`) | OK · 183.72 s, 5,406,880 B |
| `python scripts/film-check.py` | `FRAMES 8/8`, `SHEET …`, `FILM OK` |
| `film-check` sin MP4 | Falla con `ERROR: Falta el MP4 …`, exit 1 |
| `film-check` sin un frame | Falla con `ERROR: Faltan frames del stageshow …`, exit 1 |
| `record-demo` sin `DEMO_BASE_URL`/`BASE_URL` | Falla con mensaje claro, exit 1 |

## Cambios de scripts

- `web/scripts/demo_ui.py`: base URL obligatoria por
  `DEMO_BASE_URL`/`BASE_URL` (sin `:3000` por defecto), reset con IP única por
  corrida, `require_base()`, selectores por rol/nombre visible, cierre de hojas
  con `Cerrar demo`, y copy actual con fallbacks.
- `web/scripts/record-demo.py`: guion de ~3 min, valida copy final, `$550.00`,
  `Cuadra`, `Antes de cerrar`, `Agregar a mano`, `Pendientes`; escribe MP4 y 8
  frames; falla con screenshot (`record-demo-error.png`) y JSON diagnóstico.
- `web/scripts/film-check.py`: no recorre la app; exige MP4, manifiesto y
  frames; rechaza el video viejo por duración/tamaño; conserva el marcador
  `SHEET`; arma contact/motion sheets.

## Qué queda

- Merge: **lo hace el orquestador**; este carril no mergeó.
- El servidor `:3310` fue de prueba y puede apagarse; no queda corriendo como
  preview.
- `record-demo.json`, `record-demo-error.*`, `film-check.json` y las hojas se
  regeneran y están ignorados por git.
- Pendiente fuera de este carril: `latest.json`/`full` atado al HEAD y
  regenerar el QR/túnel si se usa la demo en vivo.
