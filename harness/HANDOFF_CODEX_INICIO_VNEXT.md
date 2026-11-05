# HANDOFF — Integración Codex Inicio vNext sobre B.1

> **Fecha:** 4 de noviembre de 2026.
> **Estado:** integración completada y verificada de forma independiente.
> **GO local de la integración; GO demo con datos demo; handoff público
> NO-GO; Oleada C no iniciada.**

## Identidad

- **Rama:** `integration/codex-inicio-vnext` (no mergeada).
- **Base:** `424fdd2d197aab550f52244413df7eb8b45414de`, tag
  `oleada-b1-cierre`.
- **Producto:** `bd15f22` + `0de183f`.
- **Pruebas:** `a439b9a` + `5ea2d85`.
- **Build de código:** `5ea2d853841e8f324c63486eafd4c2f033d407a4`.
- **Evidencia:** `quality-reports/codex-inicio-vnext/`.
- **Informe principal:** `quality-reports/codex-inicio-vnext/00_INFORME_INTEGRACION.md`.

## Qué cambió

- Inicio compacto: 4 KPI en una fila desde `52rem` de contenedor, tarjetas
  sin alturas mínimas artificiales, CTA de Nueva venta en la primera pantalla
  en 1448/1366/1280/768/390/320.
- Container queries sobre `.inicio-main`; topbar compacta; tablet desde
  `1023px` con MobileNav; móvil 2×2; hero antes de KPI a 320; Pendientes y
  Sugerencia a ancho completo.
- Papel picado dentro del saludo y oculto donde no cabe.
- `Pendientes` se mantiene en una línea a 200 % en 320/390
  (`@container max-width: 15rem`).
- Solo se modificaron `web/src/app/inicio/page.tsx` e `inicio.css` en
  producto. No se tocaron capas financieras, shell compartido, Caja ni Ventas.

## Contratos que no se deben romper

- Los KPI usan `getDashboardData`, `listGoals` y `listTasks`; no hay fixtures
  del Design Lab.
- “Ventas hoy” no implica cobro; “Cobrado hoy” = efectivo + digital
  verificado; “Por cobrar” = saldo digital pendiente; “Meta del mes” = primera
  meta.
- Se conservan B.1: fiado puro con efectivo $0, mixto con recibido/pendiente,
  idempotencia de demo-pay, tombstone por `instanceId`, reconciliación 502,
  foco de ruta y paybar.
- `paid` solo por webhook firmado de pey; demo es `demo_paid`; fiado es deuda;
  meta no es custodia.

## Verificación

- Gate Inicio: **111 PASS · 0 FAIL** (`evidencia/results.json`).
- B.1: **65 PASS · 0 FAIL**; una corrida previa tuvo un flake P1-11 de
  redirección, no reproducido (10/10 manual).
- Smoke A 33/33; HIG 5/5; a11y axe 0 normal/HC; mobile 60/60.
- demo-pay **59/59** en árbol limpio.
- p0-venta/fiado/corte/integración/dinero 7/7 gates verdes (`--only`,
  partial); fix-datos 32/0; seguridad 58/58.
- Verificador independiente: **GO con residuales, sin P0/P1**.
- `verify:static`/`verify:evidence --static` se ejecutan sobre el HEAD
  documental limpio. `latest.json` full sigue bloqueado por
  `tunnel`/`preflight`.

## Residuales

- 1024×768: CTA de Nueva venta ligeramente bajo el pliegue; accesible por
  scroll; fuera de la matriz obligatoria.
- Flake de redirección `/fiados → /?tab=fiado` en una corrida; no
  reproducido.
- `axe` reporta solo `violations`; no hay certificación WCAG formal ni lector
  de pantalla real. En `forced-colors`, 6 falsos positivos de contraste en los
  chips “Clásica” por colores computados.
- Semántica de KPI heredada de B.1 (“Meta del mes” = primera meta; “Por
  cobrar” = saldo digital pendiente).
- Handoff público NO-GO: pey real, webhook real, QR/lector, iOS/Safari,
  túnel/preflight y full.

## Oleada C — preparación, no ejecución

- **Fiados:** separar datos de lista; total global del servidor; historial por
  crédito; reusar `POST /api/credits/[id]/pay` con `requestId`,
  `expectedBalanceCents`, sobrepago y 409. No copiar simulaciones del lab.
- **Corte:** día México; efectivo separado de digital; fiado como deuda;
  conservar `previewCashClose`/`closeCash`, versiones, fingerprint y
  `requestId`; la variante compacta de Codex es referencia de densidad.
- **Metas/Pendientes:** crear/editar/historial requieren API real; no simular
  checks ni datos.
- No iniciar C hasta autorización explícita.

## Git

- No hay merge, push, deploy ni tag de integración.
- B.1 conserva rama, tag, historial y evidencia.
- El commit documental de esta integración contiene este handoff, el informe,
  la evidencia y la actualización de `harness/STATE.md` y de la matriz.
