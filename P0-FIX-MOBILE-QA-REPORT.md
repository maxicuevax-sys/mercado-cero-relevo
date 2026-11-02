# P0 · Fix mobile QA — reporte de carril

Rama: `p0/fix-mobile-qa` · Base: `c0248ba` · Commit: HEAD de la rama (hash en el cierre de sesión)
Worktree: `mercado-cero-fix-mobile-qa` · Servidor de QA: `:3170` con DB temporal.
No se tocó `mercado-cero`, `:3000` ni `:3101`. Sin merge.

## Cambios

### 1. `requestId` de venta (P1)
- `caja-app.tsx` genera `sale_<uuid>` la primera vez que se confirma una venta,
  con firma del payload exacto (`items`, efectivo, fiado, cliente).
- La llave se guarda en `localStorage` (`mercado-cero:sale-request:v1`) y se
  restaura con el borrador. Reintentos con el mismo payload reutilizan la llave;
  editar la venta genera una nueva. Se limpia solo con éxito confirmado.
- Candado síncrono contra doble tap, además de `saving`/disabled.

### 2. Metas concurrentes
- `/api/goals/[id]/contribute` exige `requestId` (400 si falta) y
  `contributeToGoal` lo valida también en la capa de dominio.
- `GoalCard` genera `goal_<uuid>` estable por intento y la reutiliza al
  reintentar. El doble POST con la misma llave no infla el ahorro.

### 3. Success 404 honesto
- `/pay/:id/success` distingue 404: muestra “No encontramos este cobro”, foco en
  el H1, salida pública (“Cerrar esta pestaña”) y detiene el polling.
- No muestra “Estamos confirmando con el banco” ni “Tu pago ya salió del banco”.
- Título del documento: “Cobro no encontrado · Mercado Cero”.

### 4. Tab bar a 320
- Labels con `clamp(12px, 0.8125rem, 13px)` (antes el label dependía del
  contenedor). Medido: 13 px a 320 y 13 px a 360; sin recorte ni overflow.
- Check nuevo en `hig-after-audit.py` (tamaño real, fit y overflow) y en
  `mobile-320-e2e.py` para Chromium/Firefox/WebKit.

### 5. “Registrar abono” y chrome
- `scroll-padding-bottom` del scroller móvil y `scroll-margin-bottom` de
  `[data-chrome-critical]`; fallback `100vh` antes de `100dvh`.
- Verificado con `elementFromPoint` y foco de teclado en 3 motores a 320/360.

### 6. Fiado inexistente
- `NotFoundError` de `recordCreditPayment` ya se traduce a 404; se conserva y
  cubre con contrato (`abono de fiado inexistente responde 404`).

### 7. `hig-after-audit.py` a 320
- 320×640 entra en `VIEWPORTS` y en el flujo completo.
- La espera del success ya no depende de `section[role=status]`: espera `main h1`
  y luego **aserción explícita** `successHasStatus`; el gate falla si falta.
- Se corrigieron recortes reales a 320/200 % (título de hoja, píldora
  “Recomendado”, párrafos largos) sin partir palabras.

### 8. Doble submit
- Se conserva `saving`/disabled y se añade el candado síncrono; la garantía real
  es la llave idempotente del servidor.

## Matriz de verificación

| Caso | Resultado | Evidencia |
|---|---|---|
| 502 post-commit: commit + 502; reintento misma llave devuelve la misma orden | PASS · 2 POST, 1 orden, mismo id | `p0-venta-e2e.json` |
| Doble tap | PASS · 1 POST, 1 orden | `p0-venta-e2e.json` |
| Tecleo `0.01` | PASS · texto crudo `0.01`, 1 cent | `p0-venta-e2e.json` |
| Tecleo `00035` | PASS · texto crudo `00035`, 3500 cents | `p0-venta-e2e.json` |
| Tecleo `35.` | PASS · texto crudo `35.`, 3500 cents | `p0-venta-e2e.json` |
| Tecleo `35.5` | PASS · texto crudo `35.5`, 3550 cents | `p0-venta-e2e.json` |
| Tecleo `35.50` | PASS · texto crudo `35.50`, 3550 cents | `p0-venta-e2e.json` |
| Mixta 2×35.50 + $100 + $40 + Juan a 320 | PASS · total 7100, pagado 3100, fiado 4000, cambio 6900 | `p0-venta-e2e.json` |
| Mixta idéntica a 360 | PASS · total 7100, pagado 3100, fiado 4000, cambio 6900 | `p0-venta-e2e.json` |
| Meta sin `requestId` | PASS · 400 y no escribe | `p0-fix-datos-contract.mjs` |
| Meta doble POST misma llave | PASS · 200/200 y una aportación | `p0-fix-datos-contract.mjs` |
| Success de pedido inexistente | PASS · “No encontramos este cobro”, sin banco, foco H1 | `checkout-audit.py` |
| Labels de tab 320/360 | PASS · 13 px, fit, 3 motores | `mobile-320-e2e.json` |
| “Registrar abono” 320/360 | PASS · elementFromPoint + foco, sobre tab bar, 3 motores | `mobile-320-e2e.json` |
| Fiado inexistente | PASS · 404 | `p0-fix-datos-contract.mjs` |
| HIG 320/360/390/768/1280 (100 % y 200 %) | PASS | salida `hig-after-audit.py` |

## Gates

| Gate | Resultado |
|---|---|
| `npm run lint` | PASS · 0 errores (1 warning preexistente en `harness-gate.mjs`) |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm run test:fix-datos` | PASS · 41/41 |
| `npm run test:security` | PASS · 29/29 |
| `npm run test:harness` | PASS · 44/44 |
| `p0-venta-e2e.py` | PASS · 65/65 |
| `p0-fiado-e2e.py` | PASS · 50/50 |
| `p0-corte-e2e.py` | PASS · 61/61 · 1 KNOWN |
| `p0-integracion-e2e.py` | PASS · 51/51 |
| `p0-shell-e2e.py` | PASS · 68/68 |
| `hig-after-audit.py` 320/360/390/768/1280 | PASS |
| `motion-check.py` | PASS · 19/19 |
| `checkout-audit.py` | PASS · 19/19 |
| `mobile-320-e2e.py` (320/360, 3 motores, Chromium CPU 6× + Slow 3G) | PASS · 42/42 |

## Capturas

- `harness/evidence/mobile-320-chromium.png`, `...-fiado.png`
- `harness/evidence/mobile-320-firefox.png`, `...-fiado.png`
- `harness/evidence/mobile-320-webkit.png`, `...-fiado.png`
- `harness/evidence/mobile-360-*.png` (mismos 3 motores)
- `demo/checkout-360-missing.png`
- `demo/hig-after/` (generado por el auditor HIG, no versionado)

## KNOWN

- `P0-CORTE` omite la migración de esquema viejo cuando corre con
  `P0_EXTERNAL_SERVER=1`; el propio script lo marca KNOWN. No es un fallo del
  cambio.
- El audit de HIG usa `demo/hig-after/` como salida local; no se versiona.
- `npm ci` reporta 16 vulnerabilidades moderadas preexistentes de dependencias.
- En esta base los labels de tab ya medían 13 px en Chromium; el clamp evita
  que una regla de contenedor los baje de 12 y el check lo hace exigible en los
  3 motores. No se reprodujo el salto 10→17 del reporte original.
- No hay merge.
