# FINAL-UX-REPORT — build `791b590`

- **Fecha:** 2026-11-03 (America/Mexico_City)
- **Rama:** `p0/final-ux`
- **Base / build servido:** `791b5906d57d0a8fc04eaa9f557b04eb0c6b1bd8` (`791b590`, “test(webhook): elegir puerto libre y evitar salud de servidor viejo”)
- **Superficies verificadas:** `http://localhost:3000` y `https://auction-margaret-mapping-deputy.trycloudflare.com`
- **Modo:** demo (`DEMO_MODE=true`), sin tocar `:3230`, sin cambios de código de app y sin merge.
- **Método:** Playwright/Chromium headless, viewports 320×640, 360×800, 1280×1000 y zoom de texto 200 %, más comprobaciones HTTP directas. Capturas y JSON crudo en `%TEMP%\opencode\final-ux\`.

## Veredicto

**PASS para la demo final.** 99 comprobaciones PASS, 0 FAIL y 4 knowns no bloqueantes. **No hay P0/P1 nuevos.** La app conserva la verdad de dinero (demo nunca se presenta como pagado/entregable), el corte no borra datos y la preview quedó limpia con los fixtures del runbook.

> Salvedad de consola: hubo **0 pageerrors** y **0 errores de consola de JavaScript**. Se registraron 4 errores de red esperados por las pruebas: 1 × 500 forzado en `/api/voice/parse` (el propio caso de prueba) y 3 × 503 de `/api/tts` al pedir voz dinámica. El detalle está en Hallazgos.

## PASS/FAIL por flujo

| # | Flujo | Resultado | Evidencia principal |
|---|---|---|---|
| 1 | Salud, build, caché y consola | **PASS** | Local y público devuelven `buildSha=791b5906…`; `/` responde `Cache-Control: private, no-store, max-age=0, must-revalidate`; 0 pageerrors; capturas `00-home-local.png`, `00-home-publica.png` |
| 2 | Caja: parser 500, venta manual, cambio, consultas locales y draft | **PASS** | 2 ítems, total `$90.00`, efectivo `$100`, cambio `$10.00`; draft recuperado tras recarga; “¿Cuánto vendí?” → `Ventas registradas hoy $280.00`; “¿Quién me debe?” → `Te deben $50.00…`; 0 llamadas a `/api/voice/parse` en las consultas locales |
| 3 | Fiado: confirmación, saldo vivo y sin doble envío | **PASS** | La voz abre “Registrar abono” con `Saldo vivo: $50.00` y no ejecuta; efectivo + doble clic → **1 solo POST**, saldo `5000 → 0`, estado `settled`, aviso `Juan debe $0.00` |
| 4 | Corte: “Antes de cerrar”, acciones, $550 y “Cuadra” | **PASS** | Vencidos / Para hoy / Para mañana + cobros `$120`; Completar, Posponer y “Ahora no” funcionan; conteo 5×$100 + 1×$50 → `$550.00` y `Cuadra`; guardado como `Corte #1`; pedidos `15→15`, fiado `1→1`, pendientes `3→3`, meta `$300→$300` |
| 5 | Pago demo, fulfill 409 y success pendiente | **PASS** | Hoja `Pago demo (simulado)` + `Cerrar demo`, sin `Listo para entregar`; `PATCH fulfill` → **409 `demo_not_deliverable`**; pedido queda `demo_paid`; success pendiente dice `Esperando la confirmación de pey` y no afirma débito ni entrega |
| 6 | 320/360/1280 y 200 %: overflow, targets, foco/teclado | **PASS** | Sin overflow horizontal en documento y contenedor `main` en los 5 escenarios; todos los controles visibles ≥48 px (única excepción: skip link sr-only de 1 px); Fiar/Cobrar 48–56 px; Enter activa pestaña, Escape cierra Guía y el foco tiene outline sólido de 3 px. Fiar/Cobrar bajo el pliegue queda declarado abajo |
| 7 | Preferencias: sugerencias off | **PASS** | `mercado-cero:companion:suggestions=off`; “Antes de cerrar” desaparece de Corte; “Cobros pendientes” y `$120.00` siguen visibles en Caja |
| 8 | Reset final y fixtures | **PASS** | Ventas `$190`, demo cash `$70`, por cobrar `$120`, fiado `$50`, meta `$300 / $1,800`, corte base/esperado `$500`, 0 pendientes de prueba, sin corte guardado; preview local y pública muestran lo mismo |

## Evidencia HTTP

```text
GET http://localhost:3000/api/health -> 200
{"ok":true,"buildSha":"791b5906d57d0a8fc04eaa9f557b04eb0c6b1bd8","node":"v25.7.0"}

GET https://auction-margaret-mapping-deputy.trycloudflare.com/api/health -> 200
{"ok":true,"buildSha":"791b5906d57d0a8fc04eaa9f557b04eb0c6b1bd8","node":"v25.7.0"}

GET / (local y público) -> 200
Cache-Control: private, no-store, max-age=0, must-revalidate
```

## Evidencia de los flujos

### Caja

- Parser interceptado en `500`: la app muestra “No pude interpretar la venta. La IA no está disponible. Escribe el producto o agrégalo a mano.” y la venta manual sigue disponible.
- Ítems: Quesadilla ×2 a `$35.00` + Agua ×1 a `$20.00` → total `$90.00`.
- Efectivo `$100.00` → `Cambio $10.00`; la hoja de cobro confirma `Efectivo recibido`, `$90.00`, cambio `$10.00`.
- Tras recarga: banner “Recuperé tu venta…”, 2 productos, `$90.00` y `$100.00` conservados; nada se envió hasta confirmar.
- Consultas locales sin red:
  - `¿Cuánto vendí hoy?` → `Ventas registradas hoy $280.00 · Cobrado confirmado $0.00 · Por cobrar de hoy $120.00 · Demo $160.00 (no es dinero real).`
  - `¿Quién me debe?` → `Te deben $50.00 en 1 fiado de 1 cliente.`
  - 0 peticiones a `/api/voice/parse` durante ambas consultas.

### Fiado

- La frase “Juan me pagó 50 del fiado” abre la hoja de confirmación con `Saldo vivo: $50.00`; el abono **no** se ejecuta al interpretar.
- Efectivo + doble clic en “Registrar abono” produjo **1 solo POST** `/api/credits/{id}/pay`.
- Resultado: saldo `0`, estado `settled`, aviso “Abono registrado. Juan debe $0.00.”

### Corte

- “Antes de cerrar” mostró `VENCIDOS`, `PARA HOY`, `PARA MAÑANA` y `COBROS POR CONFIRMAR` con `$120.00`.
- Completar quitó “Cobrar a Doña Mari” y el servidor la dejó `done`; posponer movió “Comprar servilletas” a mañana (`postponedUntil` presente); “Ahora no” desmontó la tarjeta.
- Conteo por denominaciones: 5 de `$100` + 1 de `$50` → `Total contado $550.00`; estado `Cuadra`, `El efectivo cuadra con lo esperado`, diferencia `$0.00`.
- Confirmación del servidor: `expectedCents=55000`, `differenceCents=0`; guardado como `Corte #1`.
- No borró datos: pedidos `15→15`, créditos `1→1`, pendientes `3→3`, meta `30000→30000`.

### Pago demo y checkout

- `Pago demo (simulado)` y `Cerrar demo` visibles; `Listo para entregar` **no** aparece en la hoja demo.
- `PATCH /api/orders/{id}` con `{action:"fulfill"}` → `409 {"code":"demo_not_deliverable"}`.
- El pedido queda `demo_paid`, nunca `paid` ni `fulfilled` por esta vía.
- `/pay/{id}/success` de un pedido pendiente muestra `Esperando la confirmación de pey`, “Puedes cerrar; este link conserva el comprobante”, y no promete entrega.

## Responsive, 200 % y targets

| Escenario | Documento | `main` | Fiar/Cobrar | ¿Bajo el pliegue? |
|---|---|---|---|---|
| 320×640 | `320/320` | `320/320` | 56 px / 56 px | Sí: top 827 > límite visible 573 |
| 360×800 | `360/360` | `360/360` | 56 px / 56 px | Sí: top 712, bottom 768; el área visible termina en 733 y la tab bar tapa los últimos 35 px |
| 1280×1000 | `1280/1280` | `1048/1048` | 56 px / 56 px | No: top 814, bottom 870 < 1000 |
| 360×800 @ 200 % | `360/360` | `360/360` | 48 px / 51 px | Sí: top 1419 > 733 |
| 1280×1000 @ 200 % | `1280/1280` | `856/856` | 48 px / 51 px | Sí: top 1296 > 1000 |

- Sin scroll horizontal en ninguno de los cinco escenarios.
- Todos los controles visibles miden ≥48 px en 320, 360, 1280 y 200 %; único elemento menor es el enlace “Saltar al contenido” oculto (1×1 px, sr-only).
- Teclado: `Enter` activa la pestaña Corte, `Enter` abre Ayuda, `Escape` la cierra y Fiar recibe un outline sólido de 3 px.

## Reset final (preview limpia)

Comprobado contra `/api/dashboard`, `/api/cash`, `/api/tasks` y `/api/goals` después del último reset:

```text
Ventas de hoy:          $190.00
Cobrado confirmado:      $0.00
Por cobrar de hoy:      $120.00
Pago demo (simulado):    $70.00
Fiado:                   $50.00
Meta:                   $300.00 de $1,800.00
Corte: base $500.00 / esperado $500.00 / sin corte guardado
Pedidos: 15 · Pendientes: 1 · Créditos: 1 · Tareas: 0
```

La preview pública volvió a mostrar `$190.00`, `$120.00` y `Juan`; el build final siguió siendo `791b590…`.

## Hallazgos (5)

1. **P2 UX — Fiar/Cobrar bajo el pliegue en móvil (declarado, no bloqueante).**
   - 320×640: top 827 contra un área visible que termina en 573.
   - 360×800: top 712, bottom 768; el `main` visible termina en 733 y la tab bar fija cubre la parte baja de ambas teclas.
   - 200 %: top 1419 en 360×800 y top 1296 en 1280×1000.
   - Impacto: la acción principal requiere un scroll corto; no hay overflow horizontal y se alcanza sin problema. Capturas: `13-responsive-360.png`, `13b-acciones-320.png`, `13b-acciones-360-200.png`.
   - Pasos: abrir `/` a 360×800 sin hacer scroll → observar el borde inferior de Fiar/Cobrar bajo la tab bar; repetir a 320 y con `html { font-size: 200% }`.

2. **P2 — TTS dinámico no disponible en este entorno (503).**
   - Al pedir voz para respuestas dinámicas (por ejemplo “¿Cuánto vendí?”) se ven 3 respuestas `503` de `/api/tts`; el texto de la respuesta sí aparece y los audios fijos del guion (`/tts/*.wav`) se sirven bien.
   - No es un error de JavaScript ni afecta los flujos de dinero; degrada la experiencia de voz para texto no pre-renderizado. Captura: `05-caja-consultas.png`.

3. **P2 — En modo demo, el efectivo manual se ve como “Efectivo recibido” en Actividad pero suma a “Pago demo”.**
   - Venta manual de `$90` con `$100` en efectivo: el encabezado queda `Cobrado confirmado $0.00`, la libreta muestra `Pago demo (simulado) $160.00` y Actividad rotula el pedido como `Efectivo recibido`.
   - Es la separación demo/real existente (no se afirma pago verificado), pero puede confundir al presentador. Captura: `05-caja-consultas.png`.

4. **Known — “Ahora no” es solo por sesión.**
   - Oculta “Antes de cerrar” en la pestaña actual; al recargar o abrir otra pestaña vuelve a aparecer. Comportamiento intencional, no defecto. Capturas: `08-corte-antes-de-cerrar.png`, `15-preferencias-off-corte.png`.

5. **Known — El link/QR de la demo depende del túnel efímero.**
   - El pedido pendiente sembrado usa `APP_URL`; el link actual apunta a `https://auction-margaret-mapping-deputy.trycloudflare.com`. Si el quick tunnel cambia, hay que regenerar `APP_URL`, QR y PDF. Hoy el túnel respondió 200 con el build correcto.

## P0/P1 nuevos

**Ninguno.** No se encontró pérdida de datos, doble cobro, pago demo presentado como real/entregable, ni bloqueo de los flujos solicitados.

## Knowns heredados / límites de esta pasada

- No hubo pago real de pey/CoDi; la verificación es de modo demo, como el propio runbook declara.
- No se probó en teléfono físico ni con VoiceOver/NVDA; 320/360 se emularon con Chromium.
- No se modificó código de app, no se tocó `:3230` y no se hizo merge.
- El audio TTS dinámico depende de la instalación de Piper; los audios fijos del guion están en `web/public/tts`.

## Artefactos

Directorio: `%TEMP%\opencode\final-ux\` (`C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\final-ux`).

- `results.json` — 103 comprobaciones crudas, 99 PASS / 0 FAIL / 4 KNOWN.
- `final_ux.py` — script Playwright de la pasada.
- Capturas principales:
  - `00-home-local.png`, `00-home-publica.png`
  - `02-caja-manual-draft.png`, `03-caja-draft-recuperado.png`, `04-caja-venta-cobrada.png`, `05-caja-consultas.png`, `05b-caja-consulta-deuda.png`
  - `06-fiado-abono.png`, `07-fiado-saldado.png`
  - `08-corte-antes-de-cerrar.png`, `09-corte-550-cuadra.png`, `09b-corte-confirmacion.png`, `10-corte-guardado.png`
  - `11-success-pendiente.png`, `12-pago-demo.png`
  - `13-responsive-320.png`, `13b-acciones-320.png`, `13-responsive-360.png`, `13b-acciones-360.png`, `13-responsive-1280.png`, `13-responsive-360-200.png`, `13b-acciones-360-200.png`, `13-responsive-1280-200.png`, `14-teclado-360.png`
  - `15-preferencias-off-corte.png`, `16-cobros-con-sugerencias-off.png`
  - `17-preview-final-caja.png`, `18-preview-final-meta.png`, `19-preview-final-publica.png`
