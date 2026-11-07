# Evidencias — revisión adversarial Oleada B

> Todo corresponde al HEAD `4130e71` y build `4130e71`, salvo los casos aislados indicados en las auditorías. Los PNG están ignorados por Git; los JSON/MD de esta carpeta son la evidencia versionable.

## Reproducciones propias del orquestador

| Archivo | Qué prueba |
|---|---|
| `routes-navigation.json` / `.txt` | Rutas, 307, back/forward, recarga, borrador v2, Caja→Fiados, `/pay` |
| `keyboard-focus.json` / `.txt` | Skip, landmarks, foco al agregar/quitar/resultado, pager, paybar |
| `text200-geometry.txt` | 200 %: cabeceras, nav, CTA, overflow Ventas 320 |
| `caja-layout-measures.txt` | CTA/chip/summary a 1448/1366/1280/768/390/320 |
| `importe-linea-invisible.txt` + `.png` | Importe de línea 1×1 px en desktop/tablet |
| `fiado-p0.txt` + `fiado-total-p0.png` | P0: banner falso de efectivo en fiado puro |
| `mixto-efectivo-digital.txt` + `.png` | P0: panel mixto oculta $60 recibidos |
| `mixto-fantasma-resultado.txt` + `.png` | P1: cambio fantasma |
| `pendiente-secuestra.txt` + `.png` | P1: pendiente sin salida |
| `ventas-mixto-pendiente.txt` + `.png` | P1: historial oculta cobrado |
| `demo-abono-real.txt` + `.png` | P1: abono demo en Cobrado confirmado |
| `cash-200-100-result.*` | $100 con $200 → cambio $100 |
| `concurrent-tabs.txt` | Dos pestañas con el mismo draft: una sola orden en esta prueba |
| `demo-pay-sequential.txt` / `-race.txt` | `/api/demo/pay` secuencial/concurrente: sin duplicado en un proceso |
| `abono-no-new-order.txt` | Abono parcial no crea venta |
| `fiado-corte-deltas.txt` | Efectivo/fiado/digital/abono y buckets de corte |
| `webhook.txt`, `checkout.txt`, `p0-*.txt` | Suites de regresión |
| `full-partial.txt` | Full parcial; fallos por contaminación/concurrencia de la base demo |
| `a11y.json` | axe normal/HC, targets y zoom del script |
| `capturas/` | 50 capturas de Inicio/Caja/Ventas en 6 viewports + 200 % |
| `comparativa-*.png` | Comparaciones lado a lado |

## Evidencia de los auditores

- `01_repo.md` → `repo-*`
- `02_diseno.md` → `design-capturas/`, `design-metricas/`
- `03_shell.md` → `shell-*`
- `04_ventas_pagos.md` → `pagos-*`
- `05_fiado_corte.md` → `fiado-corte-*`
- `06_modulos.md` → `modulos-*`
- `07_onboarding.md` → `onboarding-*`
- `08_accesibilidad.md` → `a11y-*`
- `11/12` → `final-*`

## Límites

No hay pagos pey reales, QR escaneado en banco, lector de pantalla, iOS/Safari, HCM real ni teclado virtual real. La base demo compartida fue contaminada por la revisión; no se forzó su reset.
