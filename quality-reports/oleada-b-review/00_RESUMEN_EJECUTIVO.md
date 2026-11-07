# 00 — Resumen ejecutivo

**Revisión adversarial de Oleada B (Caja y Ventas)**  
**HEAD auditado:** `4130e71d668e5e4693a8f5b634d2d2f953d21b02`  
**Build servido:** `http://localhost:3100`, buildSha `4130e71...`  
**Base:** tag `oleada-a-cierre` = `26c7741`  
**Rama:** `design/oleada-b-caja-ventas`  
**Árbol de producto:** limpio al iniciar; el único untracked es esta carpeta de revisión.

## Decisión

| Nivel | Decisión |
|---|---|
| **Cierre local de Oleada B** | **NO-GO** |
| **Demo controlada** | **GO condicionado solo con guion restringido** (efectivo exacto/cambio + digital demo, operador presente). **NO-GO** si incluye fiado puro o mixto efectivo+digital. |
| **Handoff público** | **NO-GO** |

**En una frase:** la arquitectura visual y el motor financiero son una base real, pero la interfaz miente sobre dinero en dos flujos principales y tiene fallos P1 de composición, responsive, continuidad y accesibilidad. El smoke 44/44 no cubre esos casos.

## Conteo consolidado

| Nivel | Cantidad |
|---|---:|
| P0 | **2** |
| P1 | **13** |
| P2 | **18** |
| P3 | **10** |

## P0 — bloqueantes

1. **Fiado puro afirma que se registró efectivo.** Con `paidCents=0`, el resultado dice “el efectivo sí se registró en la caja”. Evidencia: `EVIDENCIAS/fiado-total-p0.png`, `EVIDENCIAS/final-fiado-puro.png`.
2. **Mixto efectivo+digital oculta el efectivo ya cobrado.** Con `paidCents=6000` y `due=4000`, el panel dice “El dinero aún no se considera recibido” y no muestra “Recibiste $60”. Evidencia: `EVIDENCIAS/mixto-efectivo-digital-panel.png`, `EVIDENCIAS/final-mixto-panel.png`.

## P1 principales

- Importe por línea invisible en escritorio/tablet (1448/1366/1280/768): mide 1×1 px por un clip CSS.
- CTA de confirmación fuera del primer viewport en 1366×768, 1280×800 y 768×1024.
- Texto al 200 %: cabeceras encimadas, CTA lejos del fold, labels móviles solapados y 17 px de overflow en `/ventas` 320.
- Dos Cajas/dos borradores/dos `requestId`; nav lleva a legacy sin aviso.
- Un cobro pendiente secuestra `/caja` sin “Nueva venta” ni “Descartar”.
- Cambio fantasma en Mixto ($100 recibidos + $100 fiado → cambio $100, aplicado $0) y aviso falso “El total cambió”.
- `/ventas` oculta “Cobrado $60” cuando el pedido pasa a `payment_pending`.
- Abonos demo suman a “Cobrado confirmado” aunque el subtítulo dice “demo no cuenta”.
- `/api/demo/pay` heredado: acepta pedidos `demo=0` y puede duplicar en multiproceso.
- Nav desde Caja a Fiados/Corte/Metas/Pendientes sale al shell legacy.
- 502 post-commit + edición + reintento puede duplicar una venta pagada.
- Foco de ruta en `BODY` y foco de paginación fuera de pantalla.
- Inicio 768 presenta solapamiento artístico/CTA en la sugerencia.

## Lo que sí funciona

- Motor financiero intacto: `orders.ts`, `cash.ts`, `goals.ts`, `tasks.ts`, `db.ts`, `payment-*.ts`, `pey-events.ts`, `checkout.ts`, `api/**`, `pay/**` sin cambios.
- `/caja` y `/ventas` son pantallas reales, no redirects.
- Efectivo exacto/cambio/insuficiente, cantidades, eliminación, decimales, borrador, doble clic, `requestId`, link/QR, `demo_paid` y `/ventas` básico funcionan en los caminos probados.
- Fiado crea deuda sin efectivo; abono parcial no crea venta; corte separa efectivo, fiado y pendiente.
- Axe 0 normal/HC en los estados muestreados; skip link, landmarks, labels y targets ≥44.

## Evidencia

- Auditorías: `auditorias/01_repo.md` … `08_accesibilidad.md`.
- Evidencia de campo: `EVIDENCIAS/` (458+ archivos: capturas, JSON, logs).
- Veredicto independiente: `11_VEREDICTO_INDEPENDIENTE.md`.
- GO/NO-GO: `12_GO_NO_GO.md`.
- Plan correctivo: `10_PLAN_CORRECTIVO.md`.

## Límites

No se probó lector de pantalla real, iOS/Safari, HCM real, QR real, pey/webhook/checkout reales, teclado virtual real, multiproceso natural ni estudio con personas. La base demo fue contaminada por la propia revisión (cientos de pedidos `demo=1`); no se forzó el reset. `latest.json` full sigue siendo de `9206ea1`. `latest-static.json` es válido para `4130e71` antes de crear esta carpeta.
