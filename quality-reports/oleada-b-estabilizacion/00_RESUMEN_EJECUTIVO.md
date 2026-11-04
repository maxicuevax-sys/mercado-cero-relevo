# 00 — Resumen ejecutivo — Operación B.1

**Fecha:** 4 de noviembre de 2026
**Rama:** `fix/oleada-b1-estabilizacion`
**Producto:** `bdfbe8b` (fix) + `8101849` (pruebas)
**Build verificado independientemente:** `8101849`
**Entrega documental:** commit que contiene esta carpeta (HEAD; ver `git log -1`)
**Base de partida:** `844f759` + handoff versionado en `e025895`

## Decisión

| Nivel | Decisión | Condición |
|---|---|---|
| **Local B.1** | **GO local** | P0 = 0; P1 del alcance cerrados; verificación independiente 65/65; residuales P2/P3 documentados y aceptados |
| **Demo controlada** | **GO con guion ampliado** | Fiado puro, mixto y pendientes ya tienen copy y flujo verificados; sigue prohibido presentar demo como dinero real |
| **Handoff público** | **NO-GO** | Faltan túnel/preflight, `latest.json` full, pey real, QR/lector real e iOS/Safari |

No se inició Oleada C, no se hizo merge, no se desplegó y no se tocó la base principal.

## Qué se corrigió

- **P0-01 (fiado puro):** el resultado ya no afirma que entró efectivo. Muestra cobrado $0, efectivo $0 y saldo fiado.
- **P0-02 (mixto efectivo+digital):** el panel muestra “Ya recibiste $60” y “Falta cobrar $40” por separado; el historial conserva el cobro parcial.
- **P1-01:** `/caja` importa el borrador v1, bloquea la confirmación si hay dos borradores distintos y la Caja clásica avisa/bloquea hasta elegir.
- **P1-02/P1-03/P1-04:** importe por línea visible, CTA persistente en la barra de cobro, container queries a 200 %, paginador y nav móvil 3+2.
- **P1-05:** foco a `h1`/lista al navegar y paginar, con `aria-live`; la primera carga conserva el skip link.
- **P1-06:** bandeja con todos los pendientes, sin auto-secuestro y con “Nueva venta”.
- **P1-07:** cambio real en split válido; bloqueo del cambio fantasma cuando el fiado cubre todo.
- **P1-08:** fila de `/ventas` muestra cobrado y pendiente a la vez.
- **P1-09:** abonos demo salen de “Cobrado confirmado” en `db.ts` y `analytics.ts`.
- **P1-10:** preservado; no se reimplementó `/api/demo/pay`.
- **P1-11:** Fiados/Corte/Metas/Pendientes/Ayuda/Ajustes se marcan “Clásica” y su nombre accesible lo explica.
- **P1-12:** 502 post-commit se trata como estado desconocido, bloquea edición, persiste la llave y reconcilia por `requestId`.
- **P1-13:** Inicio 768 sin papel picado sobre el H1 y sin CTA recortado.

## Regresión principal (SHA `8101849`)

| Suite | Resultado |
|---|---|
| B.1 regression (servidor y SQLite propios) | **65 PASS · 0 FAIL** |
| p0-venta | **66 PASS · 0 FAIL · 0 KNOWN** |
| p0-fiado | **51 PASS · 0 FAIL · 0 KNOWN** |
| p0-corte | **69 PASS · 0 FAIL · 0 KNOWN** |
| p0-integración | **51 PASS · 0 FAIL · 0 KNOWN** |
| p0-dinero | **45 PASS · 0 FAIL · 3 KNOWN** |
| webhook | **40/40** |
| checkout | **19/19** |
| demo-pay | **59 PASS · 0 FAIL** en árbol limpio (incluye 0b) |
| Smoke A | **33/33** |
| Smoke B | **45/45** |
| HIG | **5/5 viewports** |
| Accesibilidad B | axe **0** normal y alto contraste; 0 targets <44; sin overflow a 200 % |
| Mobile 320/360 | **60/60** |
| Build | **BUILD OK** |
| Static | **5/5 PASS** y `verify:evidence -- --static` **PASS** en árbol limpio |

## Bloqueos que permanecen

- `verify:full` completo no se ejecutó: `tunnel` y `preflight` siguen sin infraestructura válida.
- `latest.json` full no es de este HEAD; no se usa como evidencia.
- La Caja legacy conserva su flujo de venta histórico. B.1 la preserva y la marca; la fuente nueva es `/caja`. El residual de 502 en legacy está documentado en `12_PENDIENTES_OLEADA_C.md`.
- Pagos reales, pey, QR escaneado, lector físico, iOS/Safari y lector de pantalla real no se probaron.

## Evidencia

- Matriz: `01_MATRIZ_HALLAZGOS.md`
- Causas: `02_CAUSAS_RAIZ.md`
- Lotes: `03_LOTE_1_VERDAD_FINANCIERA.md`, `04_LOTE_2_INTEGRIDAD.md`, `05_LOTE_3_OPERACION_A11Y.md`
- Pruebas: `06_PRUEBAS_REGRESION.md`
- Verificación independiente: `09_VERIFICACION_INDEPENDIENTE.md`
- GO/NO-GO: `10_GO_NO_GO.md`
- Git: `11_ESTADO_GIT.md`
- Crudo: `evidencia/`
