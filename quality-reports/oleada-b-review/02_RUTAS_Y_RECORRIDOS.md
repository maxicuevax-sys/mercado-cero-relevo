# 02 — Rutas y recorridos

## Matriz de rutas observada

| Ruta | Resultado | Shell | Nota |
|---|---|---|---|
| `/inicio` | 200 | nuevo `inicio-shell` | H1 editorial, CTA “Registrar” → `/caja` |
| `/caja` | 200 | nuevo | Pantalla real de venta; no redirect |
| `/ventas` | 200 | nuevo | Historial real, 25/página |
| `/` | 200 | legacy `app-shell` | Caja legacy; no redirect |
| `/?tab=caja` | 200 | legacy | Venta legacy |
| `/?tab=fiado` | 200 | legacy | H1 visible “Fiado” (hay un H1 “Caja” oculto en DOM) |
| `/?tab=corte` | 200 | legacy | H1 visible “Corte de caja” |
| `/?tab=meta` | 200 | legacy | H1 visible “Meta” |
| `/?tab=pendientes` | 200 | legacy | H1 visible “Pendientes” |
| `/fiados?ayuda=1` | **307** → `/?tab=fiado&ayuda=1` | legacy | Alias conserva `ayuda` |
| `/corte` | **307** → `/?tab=corte` | legacy | Alias |
| `/metas` | **307** → `/?tab=meta` | legacy | Alias |
| `/pendientes` | **307** → `/?tab=pendientes` | legacy | Alias |
| `/pay/[id]` | 200 | **sin shell** | Checkout público; link local |
| `/pay/[id]/success` | 200 | **sin shell** | Estado pendiente/confirmación |
| `/pay/inexistente` | **200** | sin shell | Debería ser 404 (heredado) |

Evidencia: `EVIDENCIAS/routes-navigation.json`, `EVIDENCIAS/routes-navigation.txt`, `EVIDENCIAS/pay-routes.txt`.

## Recorrido principal probado

| Paso | Ruta / componente | Acción | Estado / servicio | Resultado | Evidencia |
|---|---|---|---|---|---|
| 1 | `/inicio` | abrir | datos demo | H1, KPIs, CTA | `capturas/inicio-*.png` |
| 2 | `/caja` | clic “Registrar”/nav | AppShell nuevo | Caja vacía operativa | `capturas/caja-vacia-*` |
| 3 | Caja | agregar conceptos | estado local + draft v2 | total y líneas | `capturas/caja-conceptos-*` |
| 4 | Caja | editar cantidad/precio | estado local | total recalcula | smoke B C/D |
| 5 | Caja | elegir Efectivo/Digital/Fiado/Mixto | estado local | panel de cobro | smoke B / capturas |
| 6 | Caja | confirmar efectivo | `POST /api/orders` | orden `paid`; resultado | `cash-200-100-result.*` |
| 7 | Caja | confirmar digital | `POST /api/orders` + `/pay` | `payment_pending`; link/QR | `capturas/caja-digital-pendiente-*` |
| 8 | Caja | simular demo | `POST /api/demo/pay` | `demo_paid`, etiqueta demo | smoke B L |
| 9 | Caja | confirmar fiado | `POST /api/orders` con `creditCents` | `confirmed`; saldo vivo | smoke B M |
| 10 | Caja | “Nueva venta” | reset local | compose vacío | smoke B O |
| 11 | `/ventas` | abrir | `listOrders`/`getCredit` | historial y saldo | `capturas/ventas-*` |
| 12 | `/ventas` | paginar | `?page=2` | 25 filas distintas | `EVIDENCIAS/ventas-pager.txt` |
| 13 | Navegador | atrás | historial | vuelve a `/caja` | `routes-navigation.json` |
| 14 | `/caja` | recargar | server + localStorage | compose o pendiente | smoke N / pending trap |

## Hallazgos de navegación

### P1 — La nav presenta módulos legacy como si estuvieran migrados

Desde `/caja`, “Fiados”, “Corte”, “Metas” y “Pendientes” llevan a `/?tab=…` y cambian al shell legacy. En móvil cambian labels (`Fiados`→`Fiado`, `Metas`→`Meta`, `Pendientes`→`Tareas`) y desaparece el shell nuevo. No hay aviso de que se sale de la pantalla migrada. Evidencia: `EVIDENCIAS/routes-navigation.txt` (`caja_to_fiados`), `auditorias/03_shell.md`.

### P1 — Dos Cajas, dos borradores y dos llaves

`/` guarda `mercado-cero:draft:v1` y `/caja` guarda `mercado-cero:caja-draft:v2`. Ambos pueden contener la misma venta; `/caja` no avisa del v1 y `/` no avisa del v2. Cada pantalla puede generar su propio `requestId`, por lo que la misma venta física puede registrarse dos veces. Evidencia: `auditorias/03_shell.md`, `EVIDENCIAS/final-two-drafts-*.png`, `EVIDENCIAS/shell-probes2.json`.

### P1 — Foco de ruta y paginación

Tras navegar con clic/Enter, `document.activeElement` queda en `BODY`; al paginar, el foco permanece en el enlace “Siguiente” fuera del viewport. No hay anuncio de cambio de página. Evidencia: `EVIDENCIAS/keyboard-focus.json`, `auditorias/08_accesibilidad.md`.

### P2 — `?ayuda=1` no abre la ayuda en `/caja` ni `/ventas`

La ruta nueva ignora `ayuda`; “Ayuda”/“Ajustes” del shell llevan a `/?ayuda=1` (Caja legacy). Cerrar esa ayuda deja al usuario en la Caja legacy. Evidencia: `auditorias/03_shell.md`.

### P2 — Paginación sin canónica

`/ventas?page=999`, `?page=abc`, `?page=0` no normalizan la URL; el pager no tiene `aria-current` de página. `?page=2` sí muestra 25 filas distintas. Evidencia: `EVIDENCIAS/ventas-pager.txt`, `auditorias/03_shell.md`.

### P2 — 404 y `/pay` inexistente

La 404 por defecto es la de Next, en inglés y sin shell. `/pay/inexistente` responde 200. Es herencia, no una regresión de B, pero rompe la expectativa de rutas.

## Continuidad

- `/` y `?tab=` siguen funcionando; no hay bucles.
- `/pay/**` no recibe el shell nuevo.
- El borrador v2 sobrevive a ir a `/ventas` y volver; el v1 sigue en `/`.
- Recargar `/caja` con un pendiente reanuda el cobro, pero **sin salida a “Nueva venta”/“Descartar”** (P1, ver 05).
- `?tab=foo` cae en Caja legacy sin normalizar; no se probó como error visible.
