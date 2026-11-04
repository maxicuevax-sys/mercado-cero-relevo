# 09 — Verificación independiente

**Producto final:** `bdfbe8b` (fix) + `8101849` (test)
**Build verificado por el verificador:** `8101849`
**Sesiones:** `ses_e579bd1f8ffenpeDiUAB1RA4dT` (primera revisión) y `ses_e578a804affeyIqzYXRGqpwida` (re-verificación final).
**Rol:** `mc-verificador-final` como sesión `general`, solo lectura/ejecución; no implementó los cambios que aprobó.

## Proceso

La primera revisión independiente encontró dos P1 reales que el implementador no había visto:

1. **La barra de cobro fija tapaba el enlace Ajustes** del sidebar a 1366×768 y 1280×800.
2. **Dos pestañas con el mismo draft podían crear dos ventas pagadas** porque cada una generaba una `requestId` distinta.

También detectó:
- el draft v1 seguía reimportándose después de elegir “Usar esta venta” (P3);
- el anuncio de ruta podía quedar en “.” por carrera con `document.title` (P2);
- el “Usar esta Caja clásica” no retiraba el draft v2 (P2).

## Correcciones posteriores verificadas

- `eab2a6f`: barra con `left: 236px/210px` según sidebar; `navigator.locks` + tombstone `caja-confirmed:v2`; anuncio con fallback al H1; v1 se descarta al elegir la venta nueva.
- `bdfbe8b`: cada draft tiene `instanceId` persistido; el tombstone se indexa por `instanceId + firma`. Dos pestañas del mismo draft no duplican; una venta idéntica después de “Nueva venta” sí crea una orden nueva.

## Resultado final de la re-verificación

| Check independiente | Resultado |
|---|---|
| B.1 regression | **65 PASS · 0 FAIL**, build `8101849`, seed `demoCashCents=7000`, `cashCents=0` |
| Dos pestañas, mismo draft | **PASS** — 15→16, ambas muestran el mismo pedido |
| Venta idéntica repetida | **PASS** — “Pan” $100 dos veces → 15→17, pedidos distintos |
| Ajustes 1366×768 | **PASS** — `elementFromPoint` devuelve el enlace |
| Ajustes 1280×800 | **PASS** — devuelve un hijo del enlace, no la paybar |
| Draft v1 tras “Usar esta venta” | **PASS** — eliminado, no se reimporta |
| Draft v2 tras “Usar esta Caja clásica” | **PASS** — eliminado, `/caja` no lo restaura |
| Anuncio de ruta | **PASS** — título y página presentes; no queda “.” |

## Tabla P0/P1 final

| ID | Estado independiente |
|---|---|
| P0-01 | **PASS** — fiado puro sin efectivo falso |
| P0-02 | **PASS** — mixto muestra recibido y faltante |
| P1-01 | **PASS** — v1/v2, dos pestañas y venta idéntica repetida |
| P1-02 | **PASS*** — importe visible; el check de 768 mide fuera de viewport (P3 de cobertura) |
| P1-03 | **PASS** — CTA visible y sin tapar sidebar |
| P1-04 | **PASS*** — 200 % y `/ventas` 320; mobile-320/360 cubre legacy, no `/caja` (P3) |
| P1-05 | **PASS** — foco y anuncio; puede quedar el título anterior en el live region (P3) |
| P1-06 | **PASS** — bandeja completa y salida |
| P1-07 | **PASS** — sin cambio fantasma ni aviso falso |
| P1-08 | **PASS*** — fila real validada por el verificador |
| P1-09 | **PASS** — cash real 0→0, demoCash +5000, Cobrado $0 |
| P1-10 | **PASS intacto** — 58/58 funcional; 0b pendiente de árbol limpio |
| P1-11 | **PASS** — chips y alias; Ajustes clicable |
| P1-12 | **PASS en `/caja`** — 502, recarga, llave durable; residual legacy P2 |
| P1-13 | **PASS** — Inicio 768 sin arte sobre H1 ni CTA recortado |

`*` = pasa la suite acotada con el límite indicado.

## Residuales aceptados

- **P2:** sin `navigator.locks`, el fallback no serializa pestañas; queda una ventana entre el commit del POST y el tombstone si la pestaña cae. Mitigación: Chromium/Web Locks es el objetivo de la demo; documentar.
- **P2:** la venta legacy conserva su flujo histórico de 502; la Caja nueva es la fuente y la legacy está marcada “Clásica”.
- **P3:** cobertura 768 fuera de viewport; `/caja` 320/200 % no está en mobile-320 (sí en a11y/B1 a 320).
- **P3:** el live region puede conservar el título anterior un instante.

## Veredicto

**GO local** con los residuales P2/P3 anteriores aceptados/documentados. Los P1 que bloquearon la primera verificación están cerrados y reproducidos. **Demo: GO** con datos demo y guion que incluya dos pestañas/venta repetida. **Público: NO-GO.**
