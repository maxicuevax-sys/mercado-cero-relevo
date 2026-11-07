# Auditoría de shell, navegación y rutas — Oleada A

- **Agente:** `mc-shell-responsive`
- **Fecha:** 2026-11-03
- **Modo:** SOLO LECTURA. No se editó código, datos, configuración ni se hizo commit. El único archivo escrito dentro del repo es este informe.
- **Repo:** `C:\Users\Elitebook 840 G8\Documents\Default Project\mercado-cero`
- **Rama / HEAD:** `design/oleada-a-fundacion` / `62c3fed` (`docs(handoff): consolida STATE de Fase 1 y evidencia vigente`)
- **Árbol:** limpio al iniciar (`git status --short` sin salida); el único cambio posterior es este informe sin seguimiento.
- **Servidor auditado:** `http://localhost:3100`, `/api/health` → `{"ok":true,"buildSha":"62c3fed6874bc500db16b4a9260fb62cf9626453","node":"v25.7.0"}`.
- **Alcance:** shell actual de `/inicio` y `/` (Caja legacy), navegación, rutas, responsive 1448/1366/390/320/200 %, alto contraste, foco, teclado y scroll. No se implementó nada.

---

## Veredicto ejecutivo

**El AppShell compartido es viable, pero A2 no debe cablearse dentro de Caja todavía.** Hay tres contratos que primero deben quedar cerrados:

1. **Una sola navegación funcional por vista.** Hoy conviven dos shells completos (`/inicio` con `inicio.css`; `/` con `caja-app.tsx` + `barrio.css`) y, dentro de Caja, dos navegaciones en el DOM (sidebar y tab bar móvil). La segunda está oculta por CSS, pero el código y los labels están duplicados.
2. **Un solo modelo de scroll por breakpoint.** `/inicio` móvil hace scroll de ventana; Caja móvil hace scroll dentro de `main#main`. Eso cambia anclas, foco, `scrollIntoView`, `--mc-chrome-*` y la posición al cambiar de sección.
3. **URL verdadera o alias seguro.** En Caja, los tabs son `<button>` con estado local: al pulsar “Fiado” la URL no cambia, el botón “atrás” no vuelve al tab anterior y recargar reinicia en `?tab=caja`. Por eso no se pueden activar rutas canónicas nuevas sin que la URL mienta.

La secuencia recomendada es: **A2 = componentes compartidos + migración de `/inicio`; A4 = Caja usa el mismo shell + alias 307 a `?tab=`; rutas canónicas en A5**, cuando el tab sea navegación real. Activar `/caja`, `/reportes`, `/productos`, `/proveedores`, `/ayuda` o `/ajustes` antes de tener pantalla/recorrido duplica destinos o crea enlaces muertos.

**Estado:** plan listo para A2. A4 queda condicionado a la secuencia de `caja-app.tsx`, a la actualización de `p0-shell-e2e.py` y a que el equipo acepte el mapeo `Ventas = tab caja` mientras no exista una pantalla separada de historial.

---

## 1. Línea base medida

Método: Playwright + Chromium headless, `deviceScaleFactor=1`, viewport exacto, `wait_until="networkidle"`, 350–500 ms de asentamiento. `200 %` se emuló con viewport CSS **724×543** (área de layout de 1448×1086 al 200 %), no con el zoom nativo de Chrome. Los artefactos quedaron fuera del repo, en `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-shell-audit\`.

### 1.1 Geometría actual

| Estado | `/inicio` 1448 | `/` (Caja) 1448 | `/inicio` 390 | `/` 390 | `/inicio` 320 | `/` 320 |
|---|---:|---:|---:|---:|---:|---:|
| Sidebar | 236 px | 248 px | **204 px de alto, antes del contenido** | oculta | **246 px de alto** | oculta |
| Topbar | 100 px | 65 px | 64 px | 64 px | 64 px | **120 px** |
| Topbar con texto xlarge | — | — | — | 86.4 px | — | **134 px** |
| Inicio del contenido (`main`) | y=100 | y=65 | **y=268** | y=64 | **y=310** | y=120 |
| Alto de ítem de nav | 52 px | 48 px | **40 px** | 60 px | **40 px** | 60 px |
| Tab bar inferior | no existe | 71 px | no existe | 71 px | no existe | 71 px |
| Scroll raíz | ventana | ventana (desktop) / `main` (móvil) | ventana | `main` | ventana | `main` |
| Ancho de contenido | 1129 px | 1200 px | 390 px | 390 px | 320 px | 320 px |

En **724×543 (200 %)**: `/inicio` coloca 162 px de sidebar + 64 px de topbar antes del contenido (main en y=226); Caja coloca 64 px de topbar y 71 px de tab bar (main en y=64, alto 408). Ambos pasan `scrollWidth === clientWidth`, pero son dos arquitecturas distintas.

### 1.2 Navegación actual

| Control | Destino real | Problema |
|---|---|---|
| Inicio · “Inicio” | `/inicio` | correcto |
| Inicio · “Ventas” | `/?tab=caja` | aterriza en la pantalla titulada **Caja** |
| Inicio · “Fiados” | `/?tab=fiado` | label plural, tab singular |
| Inicio · “Caja” | `/?tab=corte` | **no abre Caja: abre Corte**; repite el defecto F2 de la auditoría anterior |
| Inicio · “Reportes” | `/?tab=corte` | **duplicado exacto de “Caja”**; no existe pantalla Reportes |
| Caja · sidebar | tabs por `<button>` | URL no cambia; “atrás” no recorre tabs; recargar reinicia |
| Caja · tab bar móvil | tabs por `<button>` | misma deuda; 5 botones |
| Inicio · “Productos”, “Proveedores” | `<span aria-disabled>` | parecen navegación pero no lo son; no hay modelo/API |
| Inicio · campana/avatar | `<span aria-hidden>` | **controles falsos**: no son botones ni tienen acción |
| Inicio · “Ayuda”, “Ajustes” | `/?ayuda=1`, `/?ayuda=1#ajustes` | salen de Inicio y abren la hoja de Caja; no son destinos propios |

### 1.3 Rutas y URL

- `/inicio`, `/`, `/pay/[id]`, `/pay/[id]/success` responden 200.
- `/ventas`, `/caja`, `/fiados`, `/corte`, `/metas`, `/pendientes` responden **404**.
- `/?tab=fiado`, `/?tab=foo`, `/?tab=corte&ayuda=1` responden 200; `?tab=foo` cae silenciosamente en Caja.
- Al pulsar “Fiado” en `/?tab=caja`, la URL sigue siendo `/?tab=caja`; el título visible cambia, la URL no.
- `/pay/**` no tiene nav ni shell; es correcto y debe seguir fuera del AppShell.

### 1.4 Foco, teclado y scroll

- En Caja, el skip link enfoca `main#main` con JavaScript (`caja-app.tsx:2407-2418`); en Inicio el skip link es solo un ancla a `#inicio-main`, sin foco explícito (`inicio/page.tsx:117-119`).
- En Caja móvil, `main#main` es el scroller y la tab bar va antes de `main` en el DOM; en Inicio móvil el scroller es la ventana y no hay tab bar. `p0-shell-e2e.py` depende de ese contrato (skip link, tab bar antes de main, scroll por tab).
- `--mc-chrome-top/bottom` solo se mide dentro de `CajaApp` (`caja-app.tsx:1260-1286`). Inicio no las define; sus anclas y foco no descuentan el topbar.
- El foco de la nav activa de Inicio es blanco de 3 px con offset 3 (medido); en Caja el foco del tab activo en móvil devolvió `outline-style: none` con foco programático. Falta una regla única de foco para el shell.

### 1.5 Overflow y duplicación

- No se encontró scroll horizontal en 1448/1366/390/320/724, normal ni HC. El problema no es ancho: es **alto de chrome** y **duplicación**.
- A 320, el topbar de Caja mide 120 px (134 px con texto xlarge) porque nombre + herramientas se envuelven en dos filas. Consume 19–21 % de 640 px antes de la venta.
- `/inicio` móvil coloca 204/246 px de sidebar antes del contenido: el usuario ve navegación, no la tarea.
- Hay dos sistemas de tokens (`--inicio-*`: verde `#004b3c`, papel `#fbf3e7`; globales: verde `#0f3d36`, canvas `#f9f6ee`), dos topbars, dos sidebars, dos modelos de scroll y dos reglas de alto contraste.
- El sello **DEMO** de Inicio se oculta con `display:none` a ≤760 px (`inicio.css:969-971`); en 390/320 no aparece en el topbar (sí el texto “Datos demo” del saludo). El shell nuevo debe mantener el sello visible en todos los anchos.
- La marca de Caja en el topbar móvil mide **28×28** (`caja-app.tsx:7490-7502`) y es un enlace de navegación real; el shell la lleva a 48×48 sin agrandar el icono interior.
- `barrio.css` se importa globalmente en `layout.tsx:4`; aunque `/inicio` no lo use, sus selectores `.app-shell`, `.topbar`, `.mobile-tabs` están cargados en todas las rutas. Reutilizar esas clases en el shell nuevo arrastra el layout legacy.

---

## 2. Arquitectura propuesta

### 2.1 Principios

1. **Un shell visual, una navegación funcional.** Sidebar y MobileNav comparten el mismo registro de destinos; solo uno es visible/interactivo por viewport.
2. **El shell es composición, no layout global todavía.** `AppShell` se monta por página con `activeKey` explícito. No se envuelve CajaApp mientras CajaApp siga renderizando su propio chrome.
3. **El shell no posee lógica de negocio.** No conoce ventas, fiado, saldo, voz ni modales. Recibe slots y devuelve estructura.
4. **Namespace CSS nuevo.** `.mc-shell`, `.mc-sidebar`, `.mc-topbar`, `.mc-main`, `.mc-mobile-nav`. No reutilizar `.app-shell`, `.desk-shell`, `.inicio-shell`, `.topbar` ni `.mobile-tabs` hasta retirar el legacy.
5. **Un solo `main` y un solo `H1` visible.** Los paneles ocultos no cuentan; el foco post-navegación busca el heading visible.
6. **La URL manda.** Si el tab no está en la URL, no se crea una ruta canónica que lo contradiga.

### 2.2 Árbol DOM propuesto

```tsx
<div className="mc-shell" data-shell="app">
  <SkipLink target="#main" />                      {/* primer focusable */}
  <div className="mc-shell__frame">
    <aside className="mc-sidebar">                 {/* display:none < 1024 */}
      <a className="mc-brand" href="/inicio">…</a>
      <nav aria-label="Navegación principal">
        {/* links o buttons según mode */}
      </nav>
      <div className="mc-sidebar__foot">{footer}</div>
    </aside>

    <div className="mc-shell__column">
      <header className="mc-topbar">…</header>
      <nav className="mc-mobile-nav" aria-label="Navegación inferior">
        {/* 5 slots; DOM antes de main para conservar p0-shell */}
      </nav>
      <main id="main" tabIndex={-1} className="mc-main" data-shell-main>
        {children}                                  {/* PageHeader dentro */}
      </main>
    </div>
  </div>

  <MoreSheet />                                     {/* <dialog> nativo */}
  <ChromeMetrics />                                 {/* mide chrome real */}
</div>
```

Notas de orden:

- Sidebar → topbar → mobile nav → main es el orden actual de Caja. Conserva `p0-shell-e2e.py` (“la tab bar va antes de main en el DOM”). Para que se vea abajo sin mover el DOM, la columna usa `order`: topbar `1`, main `2`, mobile nav `3` (como hoy en `globals.css:314-344`).
- En desktop, `.mc-mobile-nav` es `display:none`; en móvil, `.mc-sidebar` es `display:none`. No hay dos navegaciones focusables.
- `MoreSheet` va fuera de `main` para que el diálogo no quede dentro del scroller.
- `PageHeader` va dentro de `main`, no en el topbar; así el skip link y el H1 quedan en el contenido.

### 2.3 Componentes, props y slots

| Componente | Props principales | Estado / slots | Notas |
|---|---|---|---|
| `AppShell` | `children`, `activeKey`, `navItems?`, `merchant?`, `dateLabel?`, `demoMode?`, `topbarActions?: ReactNode`, `sidebarFooter?: ReactNode`, `moreItems?`, `mainId?`, `contentClassName?` | No posee tab state; recibe `activeKey` | Server component; islas cliente: `SkipLink`, `MobileNav`, `MoreSheet`, `ChromeMetrics`. |
| `Sidebar` | `items`, `activeKey`, `brandHref?`, `footer?`, `mode: "link" \| "state"`, `onSelect?` | `aria-current="page"` en activo; `soon` como `<span aria-disabled>`; `reserved` no se renderiza | `mode="state"` solo para Caja en transición; `mode="link"` para Inicio y rutas futuras. |
| `TopBar` | `merchant?`, `dateLabel?`, `demoMode?`, `actions?: ReactNode`, `brandHref?`, `onDemo?` | Sin estado propio; acciones reales por slot | No incluye campana/avatar falsos. `demoMode` se pinta siempre; si no hay `onDemo`, es texto, no botón. |
| `MobileNav` | `items`, `activeKey`, `moreItems?`, `footer?`, `mode`, `onSelect?` | `Más` con `aria-expanded`/`aria-controls`; si el activo vive en Más, `data-active` + `aria-label` contextual | 5 slots máximo; conserva `.mobile-tabs`/`.mobile-tab-label` como alias de clase si se necesita compatibilidad de tests. |
| `MoreSheet` | `open`, `onClose`, `items`, `footer?`, `activeKey` | `<dialog aria-modal>`; foco inicial, Escape, retorno de foco | Lista de links/botones; no es un segundo landmark de navegación. |
| `PageHeader` | `title`, `subtitle?`, `headingId`, `action?`, `eyebrow?`, `leading?`, `back?`, `compactSubtitle?` | Un H1 visible; `tabIndex={-1}`; `data-page-heading` | Reemplaza `ScreenHeading` conservando sus clases y API. |
| `ChromeMetrics` | — | `ResizeObserver` sobre topbar y mobile nav; escribe `--mc-chrome-top/bottom` | Se mueve aquí el efecto de `caja-app.tsx:1260-1286`. |
| `SkipLink` | `target="#main"` | Enfoca `main` con JS; 48 px; visible al foco | Primer Tab; no depende de Caja. |
| `NavIcon` | `src: StaticImageData`, `className?` | `aria-hidden` | Reutiliza `assets/inicio/icons/*`; Lucide solo para acciones, no para la nav principal. |

### 2.4 Registro único de navegación

Archivo propuesto: `web/src/components/shell/nav.tsx`.

```ts
export type NavKey =
  | "inicio" | "ventas" | "fiados" | "corte"
  | "metas" | "pendientes"
  | "caja" | "reportes" | "productos" | "proveedores";

export type NavStatus = "ready" | "soon" | "reserved";
export type NavPlacement = "primary" | "more" | "hidden";

export interface NavItem {
  key: NavKey;
  label: string;                 // sidebar / Más
  shortLabel?: string;           // bottom nav ("Tareas")
  href?: string;                 // link canónico o legacy
  tab?: "caja" | "fiado" | "corte" | "meta" | "pendientes";
  icon: StaticImageData;
  status: NavStatus;
  desktop: boolean;
  mobile: NavPlacement;
  description?: string;
  match?: { pathname?: string; tab?: string };
}

export const NAV_ITEMS: readonly NavItem[] = [
  { key: "inicio", label: "Inicio", href: "/inicio", icon: iconInicio, status: "ready", desktop: true, mobile: "primary" },
  { key: "ventas", label: "Ventas", href: "/?tab=caja", tab: "caja", icon: iconVentas, status: "ready", desktop: true, mobile: "primary" },
  { key: "fiados", label: "Fiados", href: "/?tab=fiado", tab: "fiado", icon: iconFiado, status: "ready", desktop: true, mobile: "primary" },
  { key: "corte", label: "Corte", href: "/?tab=corte", tab: "corte", icon: iconCaja, status: "ready", desktop: true, mobile: "primary" },
  { key: "metas", label: "Metas", href: "/?tab=meta", tab: "meta", icon: iconMetas, status: "ready", desktop: true, mobile: "more" },
  { key: "pendientes", label: "Pendientes", shortLabel: "Tareas", href: "/?tab=pendientes", tab: "pendientes", icon: iconPendientes, status: "ready", desktop: true, mobile: "more" },
  // Reservadas: no se renderizan como enlace hasta que exista pantalla/recorrido.
  { key: "caja", label: "Caja", status: "reserved", desktop: false, mobile: "hidden", icon: iconCaja },
  { key: "reportes", label: "Reportes", status: "reserved", desktop: false, mobile: "hidden", icon: iconReportes },
  { key: "productos", label: "Productos", status: "soon", desktop: false, mobile: "hidden", icon: iconInventario },
  { key: "proveedores", label: "Proveedores", status: "soon", desktop: false, mobile: "hidden", icon: iconProveedores },
];
```

Reglas:

- `ready` = enlace real; `soon` = `<span aria-disabled>` con “Próximamente”, nunca un `<a>`; `reserved` = no se renderiza ni se enlaza.
- La etiqueta corta de `pendientes` sigue siendo **“Tareas”** en la barra inferior (cabe a 320 y ya es la convención actual); en sidebar/Más es **“Pendientes”**.
- `Fiado` (tab) se muestra como **“Fiados”** (destino); se conserva el tab `fiado` para no romper datos.
- `Meta` (tab) se muestra como **“Metas”**; la pantalla puede seguir titulada “Meta”.
- `Ventas` y `Caja` **no se muestran juntas** hasta que existan dos pantallas distintas. Hoy “Caja” es el título del tab de venta; usarlo también como destino es la ambigüedad que la auditoría anterior marcó como F2.

### 2.5 Breakpoints y geometría objetivo

| Token | Condición | Shell |
|---|---|---|
| `xs` | 0–639 | Sidebar oculta; topbar 56 px + safe top; bottom nav 64 px + safe bottom; gutter 16 px. |
| `sm` | 640–767 | Igual; gutter 20 px; dirección/fecha del negocio ocultas si no caben. |
| `md` | 768–1023 | Igual (tablet); contenido a ancho completo; grids de página pueden usar 2 columnas. |
| `lg` | 1024–1279 | Sidebar 248 px visible; sin bottom nav; topbar 64 px; gutter 24 px. |
| `xl` | ≥1280 | Sidebar 248 px; contenido máximo 1200 px; gutter 32 px. |
| Reflow 200 % | 1448 → 724 CSS px | Entra en `lg`? No: 724 < 1024 → shell móvil. Sin scroll horizontal. |

Medidas objetivo:

| Viewport | Sidebar | Topbar | Inicio de main | Bottom nav | Target de nav |
|---|---:|---:|---:|---:|---:|
| 1448×1086 | 248 | 64 | y=64 | oculta | 48 px sidebar |
| 1366×768 | 248 | 64 | y=64 | oculta | 48 px sidebar |
| 390×844 | oculta | 56 | y=56 | 64 + safe | 48 px por slot |
| 320×640 | oculta | 56 | y=56 | 64 + safe | 48 px por slot |
| 724×543 (200 %) | oculta | 56 | y=56 | 64 + safe | 48 px por slot |

Decisiones de diseño:

- **Sidebar 248 px** (no 236): coincide con Caja, deja 1200 px de contenido a 1448 y mantiene 1118 px a 1366.
- **Topbar 64/56 px** (no 100/65): unifica Inicio y Caja. Inicio pierde el topbar editorial de 100 px; se gana tarea en el primer viewport. El título grande sigue en `PageHeader`.
- **Contenido máximo 1200 px**, gutter `clamp(16px, 2.4vw, 32px)`. Inicio puede conservar un wrapper interno de 1129 px si diseño lo exige, pero el borde del shell no cambia.
- **Un solo scroll por breakpoint:** desktop = ventana (sidebar/topbar sticky); móvil = `main` interno. Es el modelo actual de Caja y evita que la bottom nav tape contenido. Inicio debe adoptarlo.
- **Sidebar con `overflow-y:auto` y `padding-bottom:12px`** para que el anillo de foco del último ítem no se recorte en 700/768 px de alto.

### 2.6 Estados

| Estado | Sidebar / MobileNav | Topbar | PageHeader |
|---|---|---|---|
| Activo | `aria-current="page"`, píldora crema/verde, icono más grueso, no solo color | — | H1 visible |
| Hover | overlay sutil; no desplaza layout | acciones con hover | — |
| Focus-visible | anillo 3 px; blanco/maíz sobre verde, negro sobre claro; offset 2–3 px | anillo 3 px | anillo 3 px, `clip-path` no lo recorta |
| Próximamente | `<span aria-disabled>` + “Próximamente”; no focusable | — | — |
| Reservado | no se renderiza | — | — |
| Demo | — | sello **DEMO** visible en todos los anchos y HC; hoy Inicio lo oculta a ≤760 y debe corregirse | — |
| Sin datos | — | “Negocio sin datos”, nunca “Cargando…” infinito | subtítulo honesto |
| Error de datos | — | conserva último negocio; banner en contenido | subtítulo “No pudimos cargar…” |
| Más abierto | `aria-expanded="true"`; `data-active` si la sección actual vive en Más | — | — |

El sello DEMO no se mueve al sheet ni se oculta a 320: es una verdad del producto. Si el topbar no cabe, se ocultan dirección/fecha y se mueve **Ayuda** a “Más”, no el sello.

### 2.7 Ownership

| Área | Dueño | Archivos |
|---|---|---|
| Shell, nav, topbar, page header, CSS de shell | `mc-shell-responsive` | `web/src/components/shell/**`, `web/src/components/screen-heading.tsx`, `web/src/app/layout.tsx` |
| Tokens, paleta, tipografía, alto contraste global | `mc-sistema-diseno` | `web/src/app/globals.css`, `barrio.css` |
| Contenido de Caja (venta/pago) | `mc-ventas-pagos` | `caja-app.tsx` (bloque venta/pago) |
| Fiado/corte | `mc-fiado-corte` | `caja-app.tsx` (bloques fiado/corte) |
| Metas/pendientes/ayuda | `mc-modulos-negocio` + `mc-onboarding-ayuda` | `caja-app.tsx`, `pending-tasks.tsx` |
| Pruebas y evidencia | `mc-verificador-final` | `web/scripts/**`, `harness/**` |
| `barrio.css` | `mc-sistema-diseno` | Solo lectura para shell; la limpieza se coordina. |

**Regla anti-colisión:** `caja-app.tsx` es un monolito. La extracción del shell y cualquier cambio de venta/pago **no pueden correr en paralelo**. Secuencia: shell A2 → contenido B → integración A4 con ventana congelada.

---

## 3. Convivencia temporal con el shell legacy

### 3.1 Reglas

1. **Una página = un shell.** Nunca montar `<AppShell>` alrededor de `CajaApp` mientras `CajaApp` siga renderizando `.app-shell > .desk-shell > AppSidebar + TopBar + MobileTabBar`.
2. **Una navegación visible por viewport.** Se pueden renderizar Sidebar y MobileNav, pero una debe ser `display:none`; no debe haber dos `<nav>` focusables ni dos `aria-current="page"` visibles.
3. **El shell nuevo no usa clases legacy.** `.mc-*` evita heredar `globals.css` (`body overflow:hidden` móvil, `.app-shell` flex) y `barrio.css` (`.topbar`, `.mobile-tabs`, `.index-tab`).
4. **No hay feature flag de dos shells.** Un flag que permita “shell viejo o nuevo” duplica caminos y vuelve a habilitar dos navegaciones. El rollback es por commit/rama, no por runtime.
5. **El estado de tabs sigue siendo de CajaApp** hasta A5. El shell solo pinta `activeKey` y dispara `onSelect`; no mueve scroll, no restaura posición, no enfoca títulos.
6. **El `#main` es del shell.** CajaApp deja de crear el `<main>` y sigue consultando `document.getElementById("main")` para su scroller; no lo duplica.
7. **`--mc-chrome-*` es del shell.** Se elimina el efecto de `caja-app.tsx:1260-1286` y se mide una vez en `ChromeMetrics`.
8. **Los modales siguen siendo de CajaApp** en A2/A4. `AppShell` recibe `sidebarFooter`/`topbarActions` como slots; no abre ayuda/demo por su cuenta.
9. **`/pay/**` nunca usa AppShell.** Si más adelante se usa un layout de grupo, `pay` debe quedar fuera del grupo.

### 3.2 Fases

| Fase | `/inicio` | `/` (Caja) | Navegación funcional | Rutas |
|---|---|---|---|---|
| **A2** | AppShell nuevo | Legacy intacto | Una por página: Inicio usa sidebar/mobile nav nuevos; Caja usa los suyos | Sin cambios; `/ventas` etc. aún 404 o alias posterior |
| **A4.1** | AppShell | Legacy intacto | Igual | Alias 307 `/ventas`, `/fiados`, `/corte`, `/metas`, `/pendientes` → `/?tab=` |
| **A4.2** | AppShell | AppShell nuevo; se eliminan `AppSidebar`, `TopBar`, `MobileTabBar` legacy | Una: la del shell nuevo, con `mode="state"` para Caja | Alias 307; `/` y `?tab=` intactos |
| **A5** | AppShell | AppShell + tabs como links | Una; URL real | Rutas canónicas; `?tab=` redirige; `/caja` solo si existe pantalla |

### 3.3 Gates anti-duplicación

En cada PR de shell, ejecutar en `/inicio` y `/`:

```js
document.querySelectorAll('nav[aria-label="Navegación principal"]:not([style*="display: none"])').length === 1
document.querySelectorAll('main').length === 1
document.querySelectorAll('h1').filter(h => h.getClientRects().length).length === 1
document.querySelectorAll('[aria-current="page"]').filter(e => e.getClientRects().length).length === 1
```

Y una búsqueda de código:

```bash
rg -n "AppSidebar|TopBar\(|MobileTabBar|inicio-nav|inicio-sidebar|TABS" web/src
```

Debe quedar solo el registro `NAV_ITEMS` y los componentes del shell. Si aparecen dos implementaciones, el PR no pasa.

---

## 4. Navegación móvil compacta

### 4.1 Barra inferior

**5 slots máximo:**

| Slot | Label | Icono | Destino A2/A4 | Nota |
|---|---|---|---|---|
| 1 | Inicio | `inicio.svg` | `/inicio` | activo en `/inicio` |
| 2 | Ventas | `ventas.svg` | `/?tab=caja` (A4) / `/ventas` (A5) | acción principal; no “Caja” |
| 3 | Fiados | `fiado.svg` | `/?tab=fiado` / `/fiados` | label plural |
| 4 | Corte | `caja.svg` | `/?tab=corte` / `/corte` | no “Caja” |
| 5 | Más | `MoreHorizontal` (excepción Lucide) | abre sheet | 48×48 mínimo; `aria-expanded` |

- **Metas** y **Pendientes (Tareas)** viven en “Más”. Si el producto insiste en la barra de la referencia (`Inicio / Vender / Caja / Fiado / Más`), se cambia **Ventas → Caja** solo cuando `/caja` tenga pantalla propia; nunca ambos.
- **No 6 slots.** A 320, 6 columnas dejan ~53 px por botón; “Fiados”/“Tareas” pierden legibilidad y el target se acerca al mínimo. 5 columnas dan 64 px.
- Altura: `64px + env(safe-area-inset-bottom)`; cada botón `min-height:48px; min-width:56px` (a 320 son 64 px). Icono 24, label 12–13 px, gap 4.
- La barra es **fila del flex shell**, no `position:fixed`: así no tapa contenido y el teclado virtual la desplaza/encoge con el layout. `main` lleva `scroll-padding-bottom: calc(64px + safe + 12px)`.
- Fondo `surface`, borde superior `separator`, activo con píldora `green-soft` + barra superior de 2 px; en HC, blanco/negro.
- `touch-action: manipulation` y `-webkit-tap-highlight-color: transparent`; sin doble tap.

### 4.2 “Más”

- `<dialog>` nativo (`showModal`) con `aria-modal="true"` y `aria-labelledby`; en móvil se ancla abajo (`margin:auto 0 0`), `max-height: calc(100dvh - safe-top - 16px)`, scroll interno.
- Contenido: **Metas**, **Pendientes (Tareas)**, **Ayuda y ajustes**. No incluir Productos/Proveedores/Reportes como enlaces; si se muestran, son `<span aria-disabled>` con “Próximamente”, nunca rutas muertas.
- Fila de 52 px, icono 24, label 17, descripción opcional 13; `aria-current="page"` en la sección activa.
- Foco: primer enlace o botón cerrar; Escape cierra; al cerrar vuelve al botón “Más”; `inert` en `.mc-shell__frame` mientras está abierto (o `overflow:hidden` en `main`), para que el fondo no reciba foco.
- El botón “Más” no lleva `aria-current`; si la sección activa está dentro, usa `data-active="true"` y `aria-label="Más, incluye Metas"` (o el nombre correspondiente). El `aria-current` va en el enlace del sheet.
- No crear un segundo `<nav aria-label="Navegación principal">` dentro del sheet: es un diálogo con una lista, no otro landmark de navegación.

### 4.3 Teclado, safe areas y scroll

- Orden: skip link → marca → sidebar (desktop) o topbar → bottom nav → main. En móvil, la bottom nav va **antes** de `main` en el DOM, como hoy; `p0-shell-e2e.py` lo verifica.
- `SkipLink` enfoca `main#main` (no solo hace scroll). `main` tiene `tabIndex={-1}`.
- Safe areas: topbar `padding-top: env(safe-area-inset-top)`; bottom nav `padding-bottom: max(6px, env(safe-area-inset-bottom))`; sheet y laterales con `env(safe-area-inset-left/right)`.
- `viewport-fit=cover` ya está en `layout.tsx:48`; añadir `interactiveWidget: "resizes-content"` en `viewport` (Next 16 lo soporta) para que el teclado virtual encoja el contenido. Si iOS no lo respeta, `visualViewport` en `ChromeMetrics` ajusta `--mc-viewport-h`; probar 390×844 con teclado abierto.
- `100dvh`, no `100vh`; `overscroll-behavior: contain` en `main`; `-webkit-overflow-scrolling: touch`.
- `scroll-margin-bottom: calc(64px + safe + 12px)` en CTAs críticos (`data-chrome-critical`), como ya hace Caja para “Registrar abono”.
- Al cambiar de tab con puntero, Caja conserva la posición por tab; con teclado, vuelve arriba y enfoca el H1 visible. Es comportamiento actual y debe sobrevivir a A4.

---

## 5. Compatibilidad de rutas

### 5.1 Matriz

| Ruta | Hoy | A2 | A4 | A5 (propuesta) | ¿Activar? |
|---|---|---|---|---|---|
| `/inicio` | 200 | 200 AppShell | 200 | 200 | Sí |
| `/` | 200 Caja | 200 Caja | 200 Caja | 307 a `/inicio` o `/ventas` (decisión) | Sí, sin cambios |
| `/?tab=caja` | 200 | 200 | 200 | 307 `/ventas` | Sí |
| `/?tab=fiado` | 200 | 200 | 200 | 307 `/fiados` | Sí |
| `/?tab=corte` | 200 | 200 | 200 | 307 `/corte` | Sí |
| `/?tab=meta` | 200 | 200 | 200 | 307 `/metas` | Sí |
| `/?tab=pendientes` | 200 | 200 | 200 | 307 `/pendientes` | Sí |
| `/ventas` | 404 | 404 (no enlazar) | **307 → `/?tab=caja`** | 200 página canónica | Alias sí; canónica en A5 |
| `/fiados` | 404 | 404 | **307 → `/?tab=fiado`** | 200 | Alias sí |
| `/corte` | 404 | 404 | **307 → `/?tab=corte`** | 200 | Alias sí |
| `/metas` | 404 | 404 | **307 → `/?tab=meta`** | 200 | Alias sí |
| `/pendientes` | 404 | 404 | **307 → `/?tab=pendientes`** | 200 | Alias sí |
| `/caja` | 404 | 404 | **404 / “En construcción”** | Solo si se separa Caja de Ventas | **No** |
| `/reportes` | 404 | 404 | 404 | Solo si se extrae de Corte | **No** |
| `/productos`, `/proveedores` | 404 | 404 | 404 | Cuando exista modelo/API | **No** |
| `/ayuda`, `/ajustes` | 404 | 404 | 404; se abren con `?ayuda=1` | Decidir si son páginas | **No** |
| `/ventas/nueva` | 404 | 404 | 404 | Solo si se separa el flujo | **No** |
| `/pay/[id]`, `/pay/[id]/success` | 200 | 200 sin shell | 200 sin shell | 200 sin shell | Sí, intocables |

### 5.2 Redirects seguros

Seguros porque el destino es la misma pantalla y el mismo estado:

```ts
/fiados      → 307 /?tab=fiado
/corte       → 307 /?tab=corte
/metas       → 307 /?tab=meta
/pendientes  → 307 /?tab=pendientes
/ventas      → 307 /?tab=caja   // solo si se acepta “Ventas = Caja” durante B
```

Condiciones:

- Usar `redirect()` (307) durante la migración, no `permanentRedirect()` (308). Un alias permanente antes de que la ruta sea canónica envenena cachés y bookmarks.
- Conservar `ayuda=1` y el hash. El servidor no lee el hash; si `Location` no incluye fragmento, el navegador conserva `#ajustes` al redirigir. Probar explícitamente `/?tab=corte&ayuda=1#ajustes`.
- Descartar `tab` del destino para evitar cadenas: `/fiados?tab=corte` → `/?tab=fiado` (la ruta gana), no `/?tab=corte`.
- No reenviar parámetros arbitrarios (`utm_*`, `debug`) al shell; solo `ayuda`.
- `?tab=metas` (plural) y `?tab=fiados` se pueden aceptar como alias y normalizar a `meta`/`fiado`; `?tab=foo` no debe caer en Caja en silencio: redirigir a `/?tab=caja` o mostrar default con URL normalizada.

### 5.3 Rutas que NO se activan

| Ruta | Motivo | Qué hacer |
|---|---|---|
| `/caja` | No hay pantalla distinta de Ventas. Si se redirige a `/corte`, se repite el defecto “Caja abre Corte”; si se redirige a `/ventas`, se duplica el destino. | Reservar en el registro; 404 honesto o “En construcción” con enlaces a rutas reales. |
| `/reportes` | No existe pantalla; hoy “Reportes” es una sección dentro de Corte. | Mantener fuera de la nav; extraer en Oleada D. |
| `/productos`, `/proveedores` | No hay modelo, API ni pantalla. | No enlazar; si se muestran, `aria-disabled` “Próximamente” solo en Más. |
| `/ayuda`, `/ajustes` | Son una hoja/modal, no páginas. | Mantener `?ayuda=1` y `#ajustes`; mover la hoja al shell en A4 si se quiere contexto global. |
| `/ventas/nueva` | El flujo de venta vive en la misma pantalla; no hay recorrido separado. | No crear hasta Oleada B. |
| `/onboarding` | No existe namespace de práctica. | No crear. |

### 5.4 Preservar query params y acciones

- `?ayuda=1`: abre la hoja de ayuda. En A2 sigue abriendo la de Caja; en A4 debe abrirse desde el shell en cualquier ruta, o los redirects a `/fiados` perderán el contexto.
- `#ajustes`: posiciona la sección de preferencias dentro de la hoja. Conservar al redirigir.
- `?tab=`: estado inicial de Caja. En A4 sigue siendo la fuente de verdad; en A5 se convierte en alias canónico.
- `?tab=` + `ayuda=1`: no perder ninguno de los dos. Helper:

```ts
function legacyTabHref(tab: string, ayuda?: string) {
  const params = new URLSearchParams({ tab });
  if (ayuda === "1") params.set("ayuda", "1");
  return `/?${params.toString()}`;
}
```

- Enlaces de pago `/pay/[id]` generados por Caja: no pasan por el shell; no agregar nav ni `noindex` sin decisión.
- `localStorage`: `mercado-cero:draft:v1`, `pending-order:v1`, `sale-request:v1`, `text-size`, `contrast`, `voice-rate`, `muted`. Cambiar de ruta no debe borrarlos; el borrador se restaura al montar CajaApp.
- `mercado:refresh`: evento global de Caja; el shell no lo intercepta.
- PWA: `start_url: "/inicio"` (`manifest.ts:9`) se mantiene. No cambiar a `/ventas` hasta que la ruta sea canónica y estable.

### 5.5 Verdad de URL (gate)

Para cada ítem de nav:

1. `href` visible = URL final (o alias 307 documentado).
2. `aria-current="page"` en el ítem que corresponde a la URL.
3. `H1` visible coincide con el destino (excepción documentada: `Ventas` → H1 “Caja” durante B).
4. Recargar conserva pantalla y estado inicial.
5. “Atrás” vuelve a la pantalla anterior; en A4, como los tabs siguen siendo estado, “atrás” sale de la página (comportamiento actual). No empeorarlo.
6. En A5, cada tab debe ser un `<Link>` real; ahí sí “atrás” recorre tabs.

---

## 6. Revisión responsive y alto contraste

### 6.1 1448×1086

- Objetivo: sidebar 248, topbar 64, main 1200, gutter 32. Sin scroll horizontal.
- Riesgo: Inicio pasa de contenido 1129 a 1200; sus grids de 4 KPI y hero/pendientes deben revalidarse. A 1448, el breakpoint `max-width:1340` de `inicio.css` no aplica, así que hero/pendientes siguen en dos columnas; con 1200 hay espacio.
- La sidebar de Inicio (236) y la de Caja (248) se unifican en 248; el brand de 76 px de Inicio baja a 44–48 px. Es un cambio visual que diseño debe aprobar.

### 6.2 1366×768

- Sidebar 248 + contenido 1118. Caja ya vive así; Inicio deja de tener 236 + 1130.
- En 1366×768, Inicio hace scroll vertical (hoy `scrollHeight 1019`); con topbar 64 en vez de 100 gana 36 px.
- Riesgo: sidebar de 6 ítems + footer en 768 px de alto; con 48 px por ítem y brand 72, cabe. Probar foco del último ítem (no debe recortarse).

### 6.3 390×844

- Objetivo: topbar 56, bottom nav 64, main empieza en y=56 (hoy Inicio y=268; Caja y=64).
- Ganancia de Inicio: **212 px** de contenido en el primer viewport.
- Riesgo: el topbar debe caber en una fila con nombre largo + DEMO + mute (Caja) o solo DEMO (Inicio). Ayuda se mueve a “Más”.
- La bottom nav de 5 slots mide 390/5 = 78 px por botón; sobra para “Fiados” y “Tareas”.

### 6.4 320×640

- Objetivo: topbar 56 **sin segunda fila**; bottom nav 64; main y=56.
- Hoy Caja tiene topbar 120/134; es el mayor riesgo de overflow vertical. Reglas:
  - `mc-topbar` grid `48px minmax(0,1fr) auto`, `flex-wrap:nowrap`.
  - Nombre `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`; dirección/fecha `display:none` < 640.
  - Acciones máx. 2 iconos + sello DEMO; “Ayuda” a Más.
  - Sello DEMO 44–48 px, texto 10 px, sin borde que lo agrande.
- Bottom nav: 5×64; labels 12–13 px; `Fiados` (6) y `Tareas` (6) caben. No usar “Pendientes” en la barra.
- Importes: la auditoría anterior midió `$1,245.00` con 15.1 px de margen a 320 xlarge; el shell no debe reducir el ancho útil del contenido (no meter padding extra). Revalidar KPI.

### 6.5 200 % (724×543)

- Entra en shell móvil. Topbar 56 + bottom nav 64 dejan 423 px de main; el contenido debe scrollear dentro de `main`, no en la ventana.
- Sin scroll horizontal; `html/body scrollWidth === clientWidth`.
- El topbar no debe crecer a dos filas: a 20 px de raíz, “Antojitos de Lupita” puede medir ~190 px; con brand 48 + DEMO 48 + mute 48 + padding 32 + gaps 8 = 184, sobran ~220 para el nombre; truncar es aceptable.
- El sheet “Más” debe pasar a una columna si no caben dos; filas de 48 y scroll interno.

### 6.6 Alto contraste

- Un solo bloque de tokens de shell para `data-contrast="high"`:
  - sidebar negro, texto blanco; activo blanco/negro;
  - topbar blanco, texto negro, borde negro;
  - bottom nav blanco, activo negro/blanco;
  - sello DEMO blanco/negro con borde negro;
  - foco 3 px: blanco sobre verde, negro sobre claro, **maíz `#f2c768`** sobre activo negro (≥13:1).
- No usar verde sobre verde para el foco. No depender solo del color para el activo: píldora + peso + `aria-current`.
- `forced-colors`: no aplicar `forced-color-adjust:none` al shell completo (hoy Inicio lo hace en `inicio.css:1476-1480`). Dejar que el sistema pinte bordes/foco; si se necesita conservar arte decorativo, desactivar solo el arte, no la nav.
- El script de `layout.tsx:61-68` activa HC por `location.pathname === '/inicio'` en `forced-colors`; al agregar rutas, esa condición deja fuera a `/ventas`, `/fiados`, etc. Reemplazar por CSS `@media (forced-colors: active)` o por una condición de shell, no por ruta.
- Probar: 1448/1366/390/320, normal + HC + `forced-colors`, foco en primer/último ítem y en “Más”.

### 6.7 Riesgos de overflow y duplicación (resumen)

| Riesgo | Evidencia actual | Mitigación |
|---|---|---|
| Topbar de dos filas a 320 | 120 px normal, 134 px xlarge | Grid de una fila, nombre truncado, ayuda en Más |
| Sidebar como bloque previo | Inicio 204 px (390) / 246 px (320) | Sidebar oculta <1024; bottom nav |
| Nav de 40 px | Inicio móvil | 48 px mínimo en shell |
| 6.º slot en bottom nav | 5×59.6 px a 320 ya justo | Máximo 5; Metas/Pendientes en Más |
| Dos scroll roots | ventana vs `main` | Desktop ventana / móvil `main`; `ChromeMetrics` |
| Dos navegaciones | sidebar + tab bar en Caja | Una visible; mismo registro; gate DOM |
| Caja/Reportes duplicados | ambos `/?tab=corte` | Reportes fuera; Caja reservada |
| Tokens duplicados | `--inicio-*` vs globales | Aprobar una paleta; shell usa globales |
| Foco recortado | sidebar sin padding-bottom en alturas cortas | `padding-bottom:12px`, `scroll-padding` |
| H1 múltiples | 5 paneles con `ScreenHeading` | Un H1 visible; PageHeader; gate |

---

## 7. Plano de implementación A2 / A4

### A2 — Fundación y migración de Inicio (sin tocar Caja)

**Objetivo:** que `/inicio` use el shell compartido y que los componentes existan, sin cambiar `/` ni rutas.

**Archivos nuevos**

```
web/src/components/shell/nav.tsx
web/src/components/shell/nav-icon.tsx
web/src/components/shell/app-shell.tsx
web/src/components/shell/sidebar.tsx
web/src/components/shell/top-bar.tsx
web/src/components/shell/mobile-nav.tsx
web/src/components/shell/more-sheet.tsx
web/src/components/shell/page-header.tsx
web/src/components/shell/chrome-metrics.tsx
web/src/components/shell/skip-link.tsx
web/src/components/shell/shell.css
```

**Archivos editados**

| Archivo | Cambio |
|---|---|
| `web/src/app/inicio/page.tsx` | Sustituir `.inicio-shell`, sidebar, topbar y nav propios por `<AppShell activeKey="inicio">`; conservar KPIs, hero, pendientes y sugerencia; `PageHeader` para el saludo. |
| `web/src/app/inicio/inicio.css` | Retirar reglas de shell (`inicio-shell`, `inicio-sidebar`, `inicio-topbar`, `inicio-nav`, `inicio-brand`, `inicio-skip`); conservar contenido/tarjetas; reemplazar `--inicio-*` por tokens globales o dejar un mapa temporal aprobado por diseño. |
| `web/src/app/layout.tsx` | Importar `shell.css`; añadir `interactiveWidget: "resizes-content"`; simplificar el script de HC/forced-colors para que no dependa de `/inicio`. |
| `web/src/components/screen-heading.tsx` | Convertir en fachada de `PageHeader` (misma API/clases) para no tocar las 5 llamadas de Caja. |
| `web/src/app/manifest.ts` | Sin cambios en A2 (`start_url` sigue `/inicio`). |

**Pasos**

1. Crear `NAV_ITEMS` con los 6 destinos listos + reservados; eliminar el array `nav` de `inicio/page.tsx`.
2. Crear `AppShell` con la estructura de §2.2; Sidebar y MobileNav leen el registro; sin estado de tabs.
3. Migrar Inicio: topbar 56/64, sidebar 248, bottom nav 5 slots, sin bloque de 204/246 px.
4. Mover `--mc-chrome-*` a `ChromeMetrics`; `SkipLink` enfoca `main#main`.
5. Reemplazar el nav de Inicio por links `/?tab=` (aún no canónicos) con `aria-current` solo en Inicio.
6. Ayuda/Ajustes: mantener `/?ayuda=1` y `/?ayuda=1#ajustes` en el footer/Más; no crear rutas.
7. Añadir `data-shell`, `data-shell-main`, `data-page-heading` para pruebas.
8. Correr `p0-shell-e2e.py` contra Caja: debe seguir verde sin cambios; cualquier cambio en Caja es señal de que se tocó el legacy.

**No hacer en A2:** no extraer `AppSidebar` de `caja-app.tsx`; no tocar `barrio.css`; no crear rutas nuevas; no mover Caja a `(app)`.

### A4 — Caja con el shell compartido + alias seguros

**Precondiciones**

- `p0-venta`, `p0-fiado`, `p0-corte`, `p0-dinero`, `checkout` verdes en HEAD limpio.
- `caja-app.tsx` congelado para otros carriles durante la ventana de integración.
- Decisión de producto sobre `Ventas` vs `Caja` (ver §9).
- `p0-shell-e2e.py` y `mobile-320-e2e.py` actualizados al nuevo contrato **en el mismo PR** (hoy esperan 5 botones y labels `Caja/Fiado/Corte/Meta/Tareas`).

**Archivos editados**

| Archivo | Cambio |
|---|---|
| `web/src/components/caja-app.tsx` | Reemplazar el bloque de shell (`2398-2449`) y las funciones `AppSidebar` (`7384-7464`), `TopBar` (`7466-7548`), `MobileTabBar` (`7550-7592`) por `<AppShell>`; conservar `tab`, `selectTab`, scroll/focus, `#main`, `#caja-heading`, etc. Eliminar `TABS`/`TAB_HEADINGS` o derivarlos del registro. |
| `web/src/app/ventas/page.tsx` | Alias 307 a `/?tab=caja` (o página canónica en A5). |
| `web/src/app/fiados/page.tsx` | Alias 307 a `/?tab=fiado`. |
| `web/src/app/corte/page.tsx` | Alias 307 a `/?tab=corte`. |
| `web/src/app/metas/page.tsx` | Alias 307 a `/?tab=meta`. |
| `web/src/app/pendientes/page.tsx` | Alias 307 a `/?tab=pendientes`. |
| `web/src/app/page.tsx` | Pasar `initialTab`/`initialDemoMode` como hoy; no cambiar la URL. |
| `web/src/app/barrio.css` | Retirar selectores de shell solo después de que no haya referencias; dueño `mc-sistema-diseno`. |
| `web/scripts/p0-shell-e2e.py` | Actualizar labels/role/scroll expectations al shell nuevo; conservar las verificaciones de foco, scroll y target. |
| `web/scripts/mobile-320-e2e.py` | Actualizar labels esperados; seguir exigiendo 5 labels ≥12 px y que quepan. |

**Pasos**

1. **Extracción mecánica:** mover el markup de shell a `AppShell` sin cambiar clases/IDs ni comportamiento. Caja sigue usando `mode="state"` y sus botones. Commit aislado, sin cambios de contenido.
2. **Swap:** CajaApp renderiza `<AppShell activeKey={tab} ... topbarActions={...} sidebarFooter={...}>`; se borran las funciones legacy. Verificar que solo hay un `<main>` y una nav visible.
3. **Chrome:** quitar el efecto `ResizeObserver` de CajaApp; `ChromeMetrics` mide topbar/mobile nav. Verificar `--mc-chrome-*` en Caja y Inicio.
4. **Navegación:** Sidebar/MobileNav en `mode="state"` siguen llamando `selectTab`; labels del registro. Mantener `aria-current="page"`. No convertir a links todavía.
5. **Alias:** crear las 5 páginas 307. No crear `/caja` ni `/reportes`.
6. **Pruebas:** actualizar `p0-shell-e2e.py` y `mobile-320-e2e.py`; añadir matriz de rutas; correr P0 completos.
7. **Limpieza:** borrar CSS de shell legacy y clases muertas; `rg` sin referencias. Capturas 1448/1366/390/320/724 + HC.

**A4.3 opcional (no recomendado para el mismo PR):** rutas canónicas con `<CajaApp initialTab>` y tabs como `<Link>`. Requiere:
- URL sync real (`router.push` o `<Link>`), no solo estado;
- `p0-shell` actualizado a links;
- scroll/foco por ruta;
- `?tab=` con 307 a canónica;
- decisión `/` → `/inicio` o `/ventas`.

Si se hace en A4, aceptar que `history.replaceState` mantiene el scroll por tab pero no crea historial; es un puente, no el destino.

### Rollback

- A2: revertir el commit de Inicio; Caja no se toca.
- A4: revertir el commit de swap; los alias 307 se pueden dejar (no rompen nada) o revertir juntos.
- No usar flags de runtime que monten dos shells.

---

## 8. Criterios de aceptación

### 8.1 A2

- [ ] `/inicio` renderiza **un** `main#main`, **una** nav visible (“Navegación principal” en desktop / “Navegación inferior” en móvil) y **un** H1 visible.
- [ ] Sidebar 248 px, topbar 64 px en 1448/1366; contenido empieza en y=64.
- [ ] En 390/320 no hay sidebar-block; topbar ≤56 px; bottom nav 5 slots; targets ≥48×48.
- [ ] En 320 no hay segunda fila de topbar ni scroll horizontal; nombre largo se trunca; DEMO visible.
- [ ] En 724×543 (200 %) no hay scroll horizontal; bottom nav y contenido alcanzables; foco no queda bajo chrome.
- [ ] HC normal y `forced-colors`: activo y foco visibles; sin verde sobre verde; sin recorte del anillo.
- [ ] Teclado: primer Tab = skip link; Enter enfoca `main`; orden sidebar/topbar/nav/main; “Más” abre/cierra con Escape y devuelve foco.
- [ ] `/` y `/pay/**` no cambian: mismos `p0-shell`, checkout y capturas de Caja.
- [ ] `rg` no encuentra `inicio-nav|inicio-sidebar|inicio-topbar|inicio-shell` en JSX.
- [ ] Axe 0 violaciones en 1448/1366/390/320 + HC; `verify:fast` verde.

### 8.2 A4

- [ ] `caja-app.tsx` no renderiza `.app-shell`, `.desk-shell`, `AppSidebar`, `TopBar` ni `MobileTabBar`; solo `<AppShell>`.
- [ ] Una sola nav visible y un solo `main`; sidebar y mobile nav comparten `NAV_ITEMS` (labels, hrefs, iconos).
- [ ] `p0-shell-e2e.py` y `mobile-320-e2e.py` actualizados y verdes; conservan las verificaciones de skip link, scroll por tab, foco en H1 y targets.
- [ ] `/ventas`, `/fiados`, `/corte`, `/metas`, `/pendientes` → 307 a `/?tab=`; conservan `ayuda=1` y hash.
- [ ] `/` sigue sirviendo Caja; `?tab=` sigue funcionando; `/caja` y `/reportes` no están enlazados ni redirigen en silencio.
- [ ] `/pay/**` sigue sin shell y sin nav.
- [ ] 320: topbar ≤56 px (no 120/134), bottom nav 5 slots, sin overflow; 200 %/HC pasan.
- [ ] P0 venta 66/0, fiado 51/0, corte 69/0, dinero 45/0 (+3 KNOWN), checkout 19/19; borrador/pending order se restauran.
- [ ] No hay doble envío ni cambio de contratos financieros.
- [ ] `verify:fast`, `verify:static` y `verify:full` verdes; evidencia con `gitAtStart.sha` = HEAD limpio y `buildSha` correcto.

### 8.3 Gates de ruta/URL

- [ ] Cada `href` de nav lleva a la pantalla que declara.
- [ ] `aria-current` coincide con la URL en cada ruta.
- [ ] Recargar conserva pantalla; “atrás” no engaña.
- [ ] `?tab=foo` no se queda como URL válida silenciosa.
- [ ] `?ayuda=1#ajustes` abre la hoja y posiciona ajustes desde cualquier ruta que lo soporte.
- [ ] El H1 visible coincide con el destino; la excepción `Ventas`/`Caja` está documentada y tiene fecha de salida.

### 8.4 Evidencia mínima

- Playwright: 1448×1086, 1366×768, 390×844, 320×640, 724×543; normal, `xlarge` (20 px), HC y `forced-colors`; capturas de shell y foco.
- Axe: 0 violaciones; documentar `incomplete` si aparece.
- Pruebas de teclado: skip link, orden, “Más”, foco de último ítem de sidebar, retorno de foco.
- Pruebas de scroll: desktop ventana / móvil `main`; CTA crítico sobre bottom nav; `scroll-padding` y `scroll-margin`.
- `p0-shell-e2e.py`, `mobile-320-e2e.py`, `hig-audit.py`, `a11y-contrast.py` actualizados si cambian selectores.

---

## 9. Riesgos y bloqueadores

| ID | Severidad | Riesgo | Evidencia | Mitigación / gate |
|---|---|---|---|---|
| R1 | **Alta** | Doble shell/doble nav | Caja ya renderiza sidebar + tab bar; A4 podría envolverla sin borrar el chrome interno | Gate DOM `nav/main/aria-current`; borrar legacy en el mismo commit; no flags |
| R2 | **Alta** | Colisión en `caja-app.tsx` | Monolito de ~8.2k líneas compartido por 4 carriles | Extracción mecánica primero; congelar archivo; integración secuencial |
| R3 | **Alta** | URL mentirosa | Click en “Fiado” deja `/?tab=caja`; `/ventas` 404 | A4 solo alias 307; canónicas en A5 con links reales |
| R4 | **Alta** | Regresión de scroll/foco | `p0-shell` exige scroll por tab, skip a `#main`, H1 enfocado | Conservar `selectTab` y `#main`; probar pointer vs keyboard; no cambiar a links sin actualizar test |
| R5 | **Media** | Topbar 320 de dos filas | 120/134 px medidos | Grid una fila, nombre truncado, ayuda en Más, DEMO fijo |
| R6 | **Media** | Nav de 5 slots con labels largos | “Pendientes”/“Fiados” a 320 | shortLabel “Tareas”; 5 slots; container query 12–13 px |
| R7 | **Media** | HC fragmentado | `inicio.css` y `barrio.css` tienen overrides distintos; script solo `/inicio` | Tokens de shell + CSS `forced-colors`; probar 320/390/1448 |
| R8 | **Media** | Cascada CSS | `barrio.css` global; `.app-shell`/`.topbar` ya definidos | Namespace `.mc-*`; no reutilizar clases legacy; importar `shell.css` una vez |
| R9 | **Media** | Deriva visual de Inicio | Sidebar 236→248, topbar 100→64, brand 76→48, tokens `#004b3c`→`#0f3d36` | Aprobación de diseño; capturas; mapa temporal de tokens si hace falta |
| R10 | **Media** | Pérdida de contexto de Ayuda | Inicio enlaza a `/?ayuda=1` (Caja) | Hoja de ayuda en shell antes de redirects canónicos; preservar `ayuda`/hash |
| R11 | **Media** | Contratos de test desactualizados | `p0-shell` espera 5 botones y labels viejos; `mobile-320` exige 5 labels | Actualizar tests en el mismo PR; conservar intención, no solo el número |
| R12 | **Baja** | `/` y PWA | `start_url=/inicio`; `/` es Caja; CTA “Registrar” usa `/` | No redirigir `/` en A2/A4; decidir al final de A5 |
| R13 | **Baja** | Foco recortado en sidebar | Último ítem pegado al borde en 700/768/HC | `padding-bottom:12px`, `scroll-padding-bottom`, probar teclado |
| R14 | **Baja** | H1/IDs duplicados | 5 paneles con `ScreenHeading`; paneles ocultos | Un H1 visible; IDs únicos; filtro `getClientRects()` en tests |
| R15 | **Baja** | `body overflow:hidden` global | `globals.css:289-345` aplica a `/pay` y `/inicio` | Scopear a `html[data-shell="app"]`; probar checkout móvil |
| R16 | **Baja** | Iconos mezclados | Inicio usa SVG mask; Caja usa Lucide | Nav con set de Inicio; Lucide solo acciones; excepción documentada para “Más” |

### Decisiones que requieren aprobación

1. **`/caja`:** reservada (recomendado), alias de Ventas, o pantalla separada en Oleada B. No activar como alias de Corte.
2. **`Ventas` vs `Caja`:** ¿la pantalla actual se llama Ventas o Caja? Si se separan historial y registro, hacerlo en B, no en A.
3. **Paleta del shell:** global `#0f3d36/#f9f6ee` vs Inicio `#004b3c/#fbf3e7`. Una sola fuente; no duplicar tokens.
4. **Primarios móviles:** `Inicio/Ventas/Fiados/Corte/Más` (recomendado) vs `Inicio/Vender/Caja/Fiado/Más`. Nunca 6.
5. **Ayuda/Ajustes:** hoja de shell vs páginas propias. Si se quedan como hoja, no crear rutas.
6. **`/` al final:** `/inicio` o `/ventas`. Mantener `/` durante A2/A4.
7. **Hearth/Alder:** sigue sin archivos/licencias; el shell usa Fraunces/Inter hasta decisión (bloqueo del documento de migración).

---

## 10. Evidencia, método y limitaciones

### Evidencia de esta pasada

- `C:\Users\Elitebook 840 G8\AppData\Local\Temp\opencode\mc-shell-audit\measure_shell.json`: geometría de 16 estados (Inicio/Caja × 1448/1366/390/320/724/HC/xlarge).
- `...\behavior_shell.json`: click de tab sin cambio de URL, orden de Tab en Inicio, topbar 320/320 xlarge, landmarks y medidas 1448.
- `...\checkout_check.py` / ejecución: `/pay/[id]` sin nav/shell, scroll de ventana, sin overflow.
- Repo: `quality-reports/mercado-cero-final/CIERRE_FASE_1/AUDITORIA_RESPONSIVE.md` (F1–F6), `14_EVIDENCIAS/metricas/inicio-*.json`, `.../variantes/*.json`, `.../axe/*.json`.
- Contratos de test leídos: `web/scripts/p0-shell-e2e.py` (skip, scroll por tab, foco H1, tab bar antes de main), `web/scripts/mobile-320-e2e.py` (5 labels, tamaño, CTA sobre tab bar).

### Limitaciones

- No se implementó el shell: las medidas objetivo son propuestas, no verificadas.
- No se modificaron datos ni se forzaron estados vacíos/listas largas; la revisión de overflow es geométrica y de DOM.
- `200 %` se emuló con viewport 724×543; no se usó el zoom nativo de Chrome.
- No se ejecutó lector de pantalla real (NVDA/VoiceOver); la revisión es semántica + axe previo.
- No se corrió axe nuevo para el shell inexistente; los 0 violations citados son de la evidencia previa de Inicio/Caja.
- El servidor auditado es `62c3fed` limpio; cualquier cambio posterior invalida estas medidas.

---

## Apéndice — Árbol de archivos propuesto

```
web/src/
  components/
    shell/
      app-shell.tsx
      sidebar.tsx
      top-bar.tsx
      mobile-nav.tsx
      more-sheet.tsx
      page-header.tsx
      chrome-metrics.tsx
      skip-link.tsx
      nav.tsx
      nav-icon.tsx
      shell.css
    screen-heading.tsx        # fachada temporal de PageHeader
    caja-app.tsx              # A2: intacto; A4: solo bloque shell
  app/
    layout.tsx                # importa shell.css + viewport
    inicio/page.tsx           # A2: AppShell
    inicio/inicio.css         # A2: sin reglas de shell
    page.tsx                  # A4: Caja + AppShell (sin cambio de URL)
    ventas/page.tsx           # A4: alias 307
    fiados/page.tsx           # A4: alias 307
    corte/page.tsx            # A4: alias 307
    metas/page.tsx            # A4: alias 307
    pendientes/page.tsx       # A4: alias 307
    pay/**                    # sin shell, sin cambios
```

**Siguiente paso recomendado:** aprobar §9 (decisiones 1–3) y ejecutar A2 con `p0-shell` como regresión de Caja. No abrir A4 hasta que exista un commit de extracción mecánica revisado y el archivo `caja-app.tsx` esté congelado para los demás carriles.
