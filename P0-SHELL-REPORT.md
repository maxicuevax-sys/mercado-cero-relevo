# P0 · Shell 200 % y estados de error — reporte de carril (revisión 2)

> **Rama:** `p0/shell` · **Worktree:** `mercado-cero-shell` · **Base:** `be26105` (incluye P0-A/B/C).
> **Fecha:** 1–2 de noviembre de 2026.
> **Alcance:** P0-F del goal de carga cognitiva. Layout/accesibilidad a 200 % y estados de error honestos.
> **Fuera de alcance y no tocado:** webhook pey, `/api/verify`, `paymentTruth`, lógica de pagos, SQLite, identidad “Mostrador claro”, servidor `:3000` y repo principal.
> **Sin merge.**

---

## 1 · Resultado

A 200 % el shell deja de romperse: “Caja”, “Fiado”, “Corte” y “Verificar comprobante” se leen completos; el TopBar mide 18.5 % del viewport a 360×800 (antes ~43 %); el campo de venta aparece por encima de la tab bar a 360, 390 y **768**; la guía usa 1–2 columnas; la pantalla Meta muestra la cifra y el botón `Apartar` en el primer viewport.

Si `/api/dashboard` falla, la app **no inventa** el comercio, **no oculta DEMO**, **no dice “no hay ventas/fiados”** y ofrece un estado `error` persistente con `Reintentar`. El fallo no entra en bucle: la carga inicial hace **exactamente una** petición; cada reintento, una.

**Commits de producto:**
- `e0be811` — `fix(shell): 200% legible y estados de error honestos`.
- `81c7918` — `test(shell): registrar evidencia solo contra cambios de web`.
- `27d42c8` — `fix(shell): nombre accesible, JSON tolerante y venta visible a 768`.

**Sin cambios de esquema, pagos ni endpoints.**

---

## 2 · Cambios

### 2.1 · 200 % usable (sin `transform: scale`)

**Causa raíz retirada:** `body { overflow-wrap: break-word }` global. Ahora el valor es `normal`; solo se parte donde un componente lo declara explícitamente.

| Superficie | Cambio |
|---|---|
| `ScreenHeading` | Flex con `flex-wrap`; el H1 no compite con la acción. A ancho estrecho la acción baja de fila. |
| TopBar | Una fila compacta; iconos de 48 px fijos; la dirección se oculta solo cuando el contenedor tipográfico es estrecho. Sin comercio hardcodeado. |
| Sidebar | Ancho en `rem` (`13.75rem`–`15rem`) que crece con la raíz; labels sin `break-words`; targets de 48 px. A 1280/200 “Fiado” y “Corte” quedan completos. |
| Navegación intermedia | El sidebar aparece desde 1024 px; 768–1023 usa la tab bar inferior. Evita comprimir el contenido a 768/200 sin cambiar los cuatro destinos. |
| Caja | A contenedor ≤15 em el bloque de texto sube antes de la voz. En tablet (640–1023) el campo de texto también sube para no quedar bajo la tab bar. Micrófono de 80 px fijo; input de 48 px; tarjeta y encabezado compactos. |
| Guía | `option-grid` con `auto-fit`: **1–2 columnas al 200 %** y 2–4 con texto normal según el ancho; el botón de contraste acepta varias líneas. |
| Verificar | Título de sheet a 1.25 rem en viewports ≤480 px; cierre de 48 px; “Verificar comprobante” no se parte. |
| Meta | La foto pasa después de la tarjeta; `Apartar` sube antes del progreso y de las cifras secundarias; a 360/200 la cifra y el botón están visibles por encima de la tab bar. |
| Corte / Conciliación | Filas de totales con `flex-wrap`/`min-w-0`; notas largas con tamaño contenido; encabezados y eyebrow sin desbordar. |
| Opciones de cobro | Solo layout: iconos y padding compactos a contenedor estrecho; misma lógica y textos de pago. |

### 2.2 · Accesibilidad del botón Verificar

- El botón de la cabecera de Caja tiene `aria-label="Verificar comprobante"`.
- El texto visible `.verify-label` puede ocultarse en el punto más comprimido, pero el control **nunca queda sin nombre accesible**.
- El HIG audit ahora falla si `unnamedCount > 0` en cualquier medida y ejecuta **axe también en la pasada 200 %** de Caja, Guía, Verificar y Meta.
- Los selectores de `hig-after-audit.py`, `mobile-audit.py`, `rehearse-demo.py` y `film-check.py` se actualizaron al nombre accesible nuevo.

### 2.3 · Estados de error honestos y JSON tolerante

- Nuevo estado `dashboardError` + `retryingDashboard`, con banner `role="alert"` persistente y botón **Reintentar**.
- `loadDashboard` es estable (`deps: []`) y ya no llama `showToast`; `showToast` usa `useRef` para el timer. Se elimina el bucle de fetch/toasts.
- Un 500 sin JSON se maneja sin exponer el cuerpo crudo.
- `demoMode = dashboard?.demoMode ?? initialDemoMode`: un fallo no apaga el sello DEMO. `initialDemoMode` viene del servidor (`page.tsx`).
- Si no hay dashboard, el TopBar dice “Negocio sin datos” y “No pudimos consultarlo”, nunca el comercio de ejemplo.
- `ActivityList`: distingue `loading`, `error` y vacío; con error no muestra “Aún no hay ventas”. Con datos viejos, avisa que son de la última carga.
- `CreditList`: distingue error de vacío; con error no muestra “Sin fiados pendientes” ni un saldo inventado.
- `GoalCard`: si `goal === null` y hay error, muestra “No pudimos cargar la meta” con **Reintentar**; el vacío solo aparece en carga exitosa sin meta.
- **`GoalCard` ya no parsea el body antes de `response.ok`.** Un 500 de texto plano (`"fallo simulado"`) muestra “No pudimos cargar la meta” o “No pude aportar.”, nunca `Unexpected token` ni el body. Se aplicó el mismo criterio a Analytics, Corte (`/api/cash`) y Conciliación, sin tocar su lógica de dinero.
- Las cargas normales y los flujos de venta/fiado no cambian.

### 2.4 · Prueba y evidencia

- `web/scripts/p0-shell-e2e.py`: simula `/api/dashboard` 500, comprueba error/DEMO/Reintentar/sin bucle, exige **una sola carga inicial**, prueba Fiado, recuperación con pedidos reales, **fallo después de una carga buena**, GoalCard 500 en carga y en aportación, y las superficies a 200 % incluyendo 768/200 y 1280/200.
- `web/scripts/hig-after-audit.py`: nueva medición de **palabras partidas**, `headerRatio`, visibilidad del campo de venta **comparada contra la tab bar**, cifra/acción de Meta y columnas de la guía. `saleVisible` ya no basta con `innerHeight`. El gate falla si una palabra se parte, si el header supera 30 % a 360/390, si el campo de venta no aparece a 360/390/768, si Meta no muestra cifra/acción a 360, si la guía usa más de 2 columnas al 200 %, si hay controles sin nombre (`unnamedCount`) o si axe encuentra violaciones serias en normal o 200 %.
- `audit.json` incluye `code.commit` y `code.dirty`; `p0-shell-e2e.json` incluye el mismo par.

---

## 3 · Pruebas ejecutadas

### 3.1 · Gates

Ejecutados desde `web/` sobre `27d42c8`:

| Comando | Resultado |
|---|---|
| `npm run lint` | PASS · sin errores ni warnings |
| `npx tsc --noEmit` | PASS · sin salida |
| `npm run build` | PASS · Next.js 16.4.3, 21 páginas |
| `npm run verify:fast` | **PASS · 3/3** (guard, lint, types) |
| `npm run verify:static` | **PASS · 4/4** (guard, lint, types, build) |

Evidencia de gate: `harness/evidence/latest.json` — `mode: static`, `gitAtStart.sha = 27d42c8`, `dirty: false`, `ok: true`; 4/4.

> `latest.baseUrl` es el default estático del harness (`http://localhost:3000`). Los gates `fast/static` no hacen runtime contra `:3000`; el runtime de este corte se ejecutó en `:3101`.

### 3.2 · HIG audit aislado

Servidor propio en **`:3101`**, `DATABASE_PATH` temporal, `DEMO_MODE=true`, `OPENAI_API_KEY=""`. No se tocó `:3000`.

```powershell
cd web
$env:BASE_URL="http://localhost:3101"
$env:HIG_OUT="C:\...\mercado-cero-shell\harness\evidence\p0-shell"
python scripts\hig-after-audit.py
```

**Resultado: PASS** en 360×800, 390×844, 768×1024 y 1280×800, texto normal y 200 %.

- `documentScrollWidth == innerWidth` en los 4 viewports y en todas las medidas 200 %.
- `clippedCount: 0`, `overlapCount: 0`, `under48Count: 0`, `unnamedCount: 0`.
- axe: 0 violaciones serias/críticas en normal y **también en las pasadas 200 %** de Caja, Guía, Verificar y Meta.
- 0 palabras partidas en todas las superficies medidas.
- `home-360-text200`: header **18.5 %** del viewport; campo de venta visible y por encima de la tab bar.
- `home-360-text200` / `390` / `768`: `saleTop` 623 / 586 / **679**; la tab bar empieza en 675 / 719 / 899. El campo queda arriba en los tres.
- `home-1280-text200`: sidebar `Caja / Fiado / Corte / Meta` completo; el campo de venta queda en `saleTop=899` con viewport de 800 (bajo el pliegue, sin clipping ni overflow; ver KNOWN).
- `help-1280-text200`: controles en **2 columnas**, velocidad de voz presente.
- `verify-360-text200`: “Verificar comprobante” completo y nombre accesible presente.
- `meta-360-text200`: cifra `$300.00 de $1,800.00` y `Apartar` visibles antes de la tab bar.

Artefacto: `harness/evidence/p0-shell/audit.json` — `code.commit = 27d42c8`, `dirty: false`, `failures: []`.

### 3.3 · E2E de estados de error y 200 %

```powershell
cd web
$env:P0_BASE_URL="http://localhost:3101"
python scripts\p0-shell-e2e.py
```

**52 PASS · 0 FAIL.**

Cubre:

1. `/api/dashboard` 500: banner persistente, DEMO visible, sin comercio hardcodeado, sin “Aún no hay ventas”, sin “Sin fiados pendientes”, `Reintentar` presente.
2. **Exactamente una petición inicial**; 2.6 s sin bucle; reintento con el fallo activo suma una petición; nuevo reintento con la ruta liberada recupera comercio y **la actividad vuelve con 6 pedidos reales**.
3. Fiado en error no se disfraza de vacío.
4. **Fallo después de una carga buena:** se conserva el comercio y la actividad de la última carga, aparece “Lo que ves es de la última carga.” y DEMO sigue visible; `Reintentar` limpia el aviso.
5. `/api/goals` 500 con `goal=null`: “No pudimos cargar la meta”, no “Aún no hay una meta”, con `Reintentar`; no aparecen `Unexpected token` ni `fallo simulado`.
6. Aportación con 500 de texto plano: “No pude aportar.”, sin `Unexpected token` ni el body crudo.
7. 200 %: header ≤30 %, campo de venta visible y por encima de la tab bar a 360/768, sidebar completo, guía 1–2 columnas, título de verificar completo, cifra y `Apartar` de Meta visibles, cero palabras partidas y cero overflow horizontal.
8. 1280/200 medido y capturado (`saleTop=899`); el gate de campo visible se limita a 360/390/768 y se documenta.

Artefacto: `harness/evidence/p0-shell/p0-shell-e2e.json` (`code.commit = 27d42c8`, `dirty: false`, `baseUrl = :3101`).

### 3.4 · Capturas

Versionadas en `harness/evidence/p0-shell/`:

- `home-360-text200.png` — Caja, header 18.5 %, campo de venta visible.
- `home-390-text200.png`
- `home-768-text200.png` — campo de venta por encima de la tab bar.
- `home-1280-text200.png` — “Fiado” y “Corte” completos; campo bajo el pliegue documentado.
- `help-360-text200.png`, `help-1280-text200.png` — controles legibles.
- `verify-360-text200.png` — título completo y control con nombre.
- `meta-360-text200.png` — cifra y `Apartar`.
- `e2e-error-360.png`, `e2e-error-fiado-360.png`, `e2e-error-recovered-360.png`, `e2e-stale-dashboard-360.png`, `e2e-goal-error-360.png`, `e2e-goal-contribute-error-360.png`.
- `e2e-home-360-text200.png`, `e2e-home-768-text200.png`, `e2e-home-1280-text200.png`, `e2e-help-1280-text200.png`, `e2e-verify-360-text200.png`, `e2e-meta-360-text200.png`.
- `home-360-fold.png`, `home-768-fold.png`, `home-1280-fold.png` — regresión normal.

El `audit.json` contiene todas las medidas; se versionan solo las capturas clave para no inflar el repo. `demo/hig-after/` no se tocó.

---

## 4 · Riesgos y KNOWN

- **1280/200: el campo de venta está bajo el pliegue.** `saleTop=899` en un viewport de 800. No hay clipping ni overflow y la página se desplaza; el criterio de “campo en el primer viewport” se aplica a 360/390/768 porque en 1280/200 el sidebar deja ~712 px de contenido y el 200 % exige scroll. Queda documentado, no se declara resuelto.
- **`initialDemoMode` se calcula en el servidor al renderizar `page.tsx`; la página es estática.** En este build `DEMO_MODE=true`; un cambio de entorno sin rebuild puede dejar el fallback desactualizado hasta que `/api/dashboard` responda. El dashboard sigue siendo la fuente de verdad.
- **768–1023 px usa tab bar inferior, no sidebar.** Es una decisión de layout para no comprimir el contenido a 200 %; en tablet el campo de texto también sube antes de la voz. Los cuatro destinos y sus nombres se conservan.
- **A 200 % se ocultan dos subtítulos redundantes** (“Habla o escribe; tú confirmas.” en Caja y “Una meta a la vez.” en Meta) y la etiqueta visible de `Verificar` (queda el icono con `aria-label="Verificar comprobante"`). El contenido principal y las acciones siguen.
- **El 200 % es inyección de `font-size`**, no zoom de navegador. No se probó TalkBack/VoiceOver/NVDA, alto contraste, daltonismo, teléfono físico ni una mano.
- **El fallo de red es simulado con Playwright** (`route` 500); no se probó desconexión real, DNS, latencia ni un servidor caído de verdad.
- **El caso de fallo tardío usa “Reiniciar demo”** para disparar la recarga del dashboard; la UI conserva los datos viejos y muestra el aviso. No se añadió un botón “Actualizar” (P0-E).
- **Descripciones largas introducidas por el usuario** ya no se parten por defecto; el audit con datos de demo no encontró overflow, pero un texto sin espacios podría desbordar en una tarjeta.
- **La foto de Meta pasó después de la tarjeta en todos los tamaños** (el hallazgo pedía considerarlo en móvil). Es un cambio de orden visual, no de contenido.
- **No se tocó la lógica de pagos.** Los ajustes en `PaymentPanel` son clases de layout (`pay-option`) y no cambian `paymentTruth`, estados ni llamadas.
- **No hay merge** ni cambios en `mercado-cero` o `:3000`.

---

## 5 · Estado de entrega

- **Producto:** `web/src/components/caja-app.tsx`, `web/src/app/globals.css`, `web/src/app/page.tsx`.
- **Pruebas:** `web/scripts/p0-shell-e2e.py`, `web/scripts/hig-after-audit.py`; selectores actualizados en `mobile-audit.py`, `rehearse-demo.py`, `film-check.py`.
- **Evidencia:** `harness/evidence/p0-shell/audit.json`, `p0-shell-e2e.json`, capturas clave; `harness/evidence/latest.json` static 4/4 con `sha = 27d42c8`.
- **Commits:** `e0be811` (producto), `81c7918` (ajuste de evidencia E2E), `27d42c8` (revisión independiente); este reporte y la evidencia se commitean después.
- **Sin merge a `master`.**

### Reproducir

```powershell
cd web
npm ci
$env:PORT="3101"
$env:DATABASE_PATH="C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\p0-shell.db"
$env:DEMO_MODE="true"
$env:OPENAI_API_KEY=""
npm run build
npm start
# en otra terminal, desde web/
$env:BASE_URL="http://localhost:3101"
$env:HIG_OUT="..\harness\evidence\p0-shell"
python scripts\hig-after-audit.py
$env:P0_BASE_URL="http://localhost:3101"
python scripts\p0-shell-e2e.py
```
