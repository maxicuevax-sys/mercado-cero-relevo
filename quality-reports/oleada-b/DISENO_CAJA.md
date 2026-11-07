# Diseño de Caja y Ventas — Oleada B

> **Rol:** `mc-sistema-diseno` · **Modo:** solo lectura. No se editó código por este agente, no se hicieron commits.
> **Repo:** `mercado-cero` · **Rama:** `design/oleada-b-caja-ventas` · **Base:** `26c7741`.
> **Fecha:** 4 de noviembre de 2026.
> **Alcance:** dirección visual y contrato de composición de `/caja` y `/ventas`; auditoría de la fundación de Oleada A; estados, tokens, responsive, criterios verificables y riesgos.
> **Fuera de alcance:** implementar, reescribir el motor de ventas, cambiar contratos financieros, tocar `orders.ts`, `cash.ts`, `db.ts`, `payment-labels.ts`, APIs, webhook o `/pay/**`.
> **Método:** lectura estática de `web/src`, conteo de clases/declaraciones, análisis de cascada y cálculo de contraste WCAG 2.2 sobre los valores declarados. **No se ejecutó navegador ni comparación renderizada**; las capturas son un requisito de la ola, no evidencia producida por este documento.
>
> **Estado del árbol:** al iniciar la lectura el árbol estaba limpio en `26c7741`. Durante la auditoría aparecieron cambios no realizados por este agente (`web/src/app/caja/`, `web/src/app/ventas/page.tsx`, `web/src/components/caja/`, cambios en `nav.ts` y `inicio/page.tsx`). **No se evaluaron ni se tocaron.** Este documento se basa en la base declarada y debe leerse como contrato de diseño; si la implementación de B ya está en curso, sus archivos necesitan una revisión de alineación contra §3–§7.

---

## 0 · Veredicto ejecutivo

La Oleada A dejó una fundación aprovechable, pero **no dejó un shell portable**: `AppShell`, `Sidebar`, `TopBar`, `BrandLockup` y `SkipLink` siguen dependiendo de clases y variables de `inicio.css`. Si `/caja` o `/ventas` importan `inicio.css` para que el shell se vea bien, arrastran la segunda paleta de Inicio y su grid editorial. Ese es el primer bloqueo de Oleada B.

La dirección propuesta es:

- **`/caja` = mostrador de una pasada.** Una calculadora de mercado: total grande, método visible, confirmación clara y el detalle de conceptos alrededor. Sin KPIs, sin hero, sin papel picado, sin tarjetas de dashboard.
- **`/ventas` = libro operativo.** Historial legible por día, con estado, importe, método y fecha; detalle bajo demanda. Sin gráficas ni reportes.
- **Una sola paleta.** Solo tokens de `globals.css`. Hearth únicamente en marca y títulos editoriales; Alder en todo lo operativo, incluidos todos los importes. Ningún hex nuevo en `caja.css` o `ventas.css`.
- **La verdad del dinero manda.** Efectivo no es “verificado”; demo no es “pagado”; fiado no es dinero recibido; pendiente digital no es éxito. El color nunca es el único portador: siempre icono + texto + forma.

**Decisión central de composición:** en escritorio, el cobro vive en una columna derecha pegajosa; en móvil, el cobro vive arriba y la confirmación en una barra fija sobre la navegación inferior. Así el total, el método y la confirmación están en el primer viewport en 1448, 1366, 390 y 320, sin convertir la pantalla en un dashboard.

---

## 1 · Auditoría de la fundación existente

### 1.1 Shell (`components/shell`)

| Componente | Qué es hoy | ¿Reutilizable? | Condición / riesgo |
|---|---|---|---|
| `AppShell` (`app-shell.tsx`) | Compone `SkipLink`, `Sidebar`, `TopBar`, `MobileNav` y `main`; clases `.inicio-shell`, `.inicio-main`; `contentClassName` por defecto `inicio-content`. | **Sí, con reserva.** | Depende de `inicio.css` para `.inicio-shell`, `.inicio-main`, `.inicio-content`. En `/caja` y `/ventas` hay que pasar `contentClassName="mc-caja"` / `"mc-ventas"`; nunca usar `inicio-content`, que tiene un grid de 5 áreas editoriales. |
| `Sidebar` | Marca, 7 enlaces, footer Ayuda/Ajustes, arte de plantas. | **Sí, tras extraer CSS.** | `.inicio-sidebar`, `.inicio-brand`, `.inicio-nav`, `.inicio-sidebar__foot` viven solo en `inicio.css`. El arte decorativo no debe aparecer en Caja/Ventas si compite con la tarea. |
| `TopBar` | Logo, comercio, dirección, sello DEMO, avatar no interactivo. | **Sí, tras extraer CSS.** | `.inicio-topbar`, `.inicio-demo`, `.inicio-avatar` viven en `inicio.css`. No tiene acciones de ayuda/demo; el avatar es un `span` con `aria-hidden`, correcto: no es un botón falso. |
| `MobileNav` | 4 destinos + “Más” (`<details>`), cierre con Escape y foco devuelto. | **Sí.** | Sus clases `.mc-mobile-nav` sí están en `shell.css`. Mantiene 5 slots; con Caja y Ventas como destinos reales, las etiquetas siguen cabiendo a 320. |
| `SkipLink` | Enfoca `#main` con JS. | **No portable aún.** | `.inicio-skip` está solo en `inicio.css`; sin ese archivo el enlace aparece como texto normal. Es un bloqueo de accesibilidad, no cosmético. |
| `BrandLockup` | Enlace a `/inicio`, marca + rayos. | **Sí, tras extraer CSS.** | `.inicio-brand*` está en `inicio.css`; el `<br>` del wordmark cambia de ancho según el contenedor. |
| `PageHeader` | H1 + eyebrow + subtítulo + acciones; `.mc-page-header` en `shell.css`. | **Sí.** | Ya es portable. Para Caja/Ventas necesita un modificador compacto: el título actual llega a `clamp(2rem, 3vw, 3.25rem)` y empuja el total hacia abajo en 1366×768. |
| `nav.ts` | Registro único de destinos reales; `cajaNav = appNav`. | **Sí.** | En la base `26c7741`, `/caja` está reservada y `/ventas` es alias 307 a `/?tab=caja`. Oleada B debe convertir ambas en pantallas reales y dejar de tratar “Ventas” como la pantalla de venta. |

**Hallazgo P0 de portabilidad:** `AppShell` no es un componente autónomo. La mitad de su CSS vive en `inicio.css`:

- `.inicio-shell`, `.inicio-main`, `.inicio-content`
- `.inicio-sidebar`, `.inicio-brand*`, `.inicio-nav*`, `.inicio-sidebar__foot`
- `.inicio-topbar*`, `.inicio-demo`, `.inicio-avatar`
- `.inicio-skip`
- Reglas de foco y alto contraste del shell.

`shell.css` solo cubre iconos, page header, empty states, mobile nav y el ocultamiento del sidebar a ≤760. **No cubre el shell de escritorio.** Consecuencia: `/caja` y `/ventas` no pueden usar `AppShell` sin importar `inicio.css` o sin una extracción previa.

### 1.2 Primitivas (`components/ui` y compartidas)

| Primitiva | Estado | Decisión para B |
|---|---|---|
| `CurrencyAmount` | Pura: `formatMxn` + `tabular-nums`. | **Usar** en totales, filas, cambio, saldo y detalle. No reimplementar `Intl`. |
| `EmptyState` | Pura; usa `role="status"`. | **Usar solo para vacío real.** No usarla para errores: un error necesita `role="alert"` y acción de reintento. |
| `MaskIcon` | Pura; usa `.inicio-icon` de `shell.css` y `--inicio-icon`. | **Usar solo en navegación.** Para acciones y estados usar Lucide, que ya está en el proyecto. No mezclar ambos sets en la misma fila. |
| `SectionHeader` | Pura; siempre renderiza `h2`. | **Usar en cabeceras de tarjeta**, cuidando no duplicar el `h2` de la sección. |
| `ProgressIndicator` | Pura; `role="progressbar"`. | **No se necesita** en Caja/Ventas. No introducir metas ni progreso donde no hay. |
| `AnimatedAmount` | Anima el importe y parte el string con `<wbr>`. | **No usar en el total de Caja ni en filas.** Un importe que cambia de ancho o se parte antes del decimal rompe la lectura y el CLS. Reservarlo, si se quiere, para el resultado y con `prefers-reduced-motion`. |
| `Sheet` | **No es compartido:** vive dentro de `caja-app.tsx` y su `inert` depende de `.app-shell`. | **Extraer a `components/ui/sheet.tsx`** (movimiento mecánico, sin reescribir el focus trap) o implementar un `<dialog>` equivalente para el detalle de Ventas. |
| `StatusBadge` | **No es compartido:** vive en `caja-app.tsx:7236` y duplica el mapeo de `pending-payments.tsx`. | **Extraer a `components/ui/payment-status.tsx`** con una sola tabla estado → etiqueta/icono/tono. Es la verdad visual del dinero. |
| `paymentTruth` | **No es compartido:** función local en `caja-app.tsx:7310`. | **Extraer a `lib/payment-truth.ts`** (función pura, con tests). Caja, Ventas y el detalle deben leer la misma verdad. |
| `QrImage` | Local a `caja-app.tsx`. | No se necesita en el historial salvo que el detalle muestre un QR pendiente; en ese caso reutilizar el existente, no dibujar uno nuevo. |

### 1.3 `inicio.css` y assets de Inicio

`inicio.css` tiene 1 396 líneas y define una **cuarta paleta de facto** (`--inicio-*`, líneas 5–15) con valores distintos a `globals.css`:

| Token Inicio | Valor | Token global equivalente | Diferencia |
|---|---|---|---|
| `--inicio-paper` | `#fbf3e7` | `--color-canvas` `#f9f6ee` | Más cálido/rosado |
| `--inicio-surface` | `#fdf3e4` | `--color-surface` `#fffdf7` | Más melocotón |
| `--inicio-green` | `#004b3c` | `--color-accent` `#0f3d36` | Más esmeralda |
| `--inicio-clay` | `#b33d24` | `--color-attention` `#8f2d1c` | Más oscuro |
| `--inicio-focus` | `#004b3c` | `--color-focus` `#0e6f5a` | Distinto |

**Regla para Oleada B:** `caja.css` y `ventas.css` **no declaran colores**. No usan `--inicio-*`. Si el shell obliga a importar `inicio.css` como puente temporal, se documenta como deuda y no se copian sus valores a la página nueva.

Assets de Inicio reutilizables sin volverlos interactivos:

| Asset | Uso permitido | Límite |
|---|---|---|
| `assets/inicio/icons/*.svg` | Iconos de navegación con `MaskIcon` y `currentColor`. | Solo navegación; no usarlos como iconos de estado ni de acción. |
| `assets/inicio/brand-shop-cream.svg`, `logo-simbolo.svg` | Marca en sidebar/topbar. | No recrear la marca con texto o emoji. |
| `assets/inicio/hero-registradora.png`, `sugerencia-lupita.png`, `papel-picado.png`, `sidebar-plantas.png` | Solo decoración de `/inicio`; no en Caja/Ventas. | Son recortes con fondo crema; no son capas vectoriales ni controles. |
| `assets/brand/ilustraciones/transparent/*.png` | Decoración opcional ≤96 px en vacío/resultado, siempre `aria-hidden`. | No usarlas como botón, tarjeta clicable ni QR real. |
| `assets/brand/iconos/transparent/*.png` | No usar como iconos de interfaz. | Son raster fijos, no heredan `currentColor`; para UI usar SVG/Lucide. |
| `qr.png` ilustrado | **Prohibido** como QR real. | El QR real sale de `QrImage`/`order.qrImage`; una ilustración no cobra. |

### 1.4 CSS legacy global

`barrio.css` se importa en `layout.tsx:4` y aplica a todas las rutas. Contiene dos capas visuales superpuestas (“Amable y de barrio” y “Mercado 2026”), 86 selectores repetidos y 34 conflictos base. Además define `.state-*` globales que cualquier página nueva heredaría. Por eso:

- `/caja` y `/ventas` usan un namespace nuevo `mc-*`.
- No reutilizan `.app-shell`, `.desk-shell`, `.topbar`, `.main-container`, `.caja-*`, `.draft-*`, `.checkout-key`, `.state-*` ni `.inicio-*` salvo las clases internas del shell.
- La limpieza o el scoping de `barrio.css` se trata como deuda separada; no se mezcla con el cambio visual de B.

---

## 2 · Dirección visual y tokens

### 2.1 Nombre y principios

**Dirección:** **“Caja de una pasada”** para `/caja`; **“Libro de ventas”** para `/ventas`. Ambas continúan “Mostrador claro” y “Mercado de papel”, pero quitan el teatro de papel de la ruta transaccional.

1. **Una tarea principal por pantalla.** Caja cobra; Ventas consulta. No hay KPIs, gráficas, metas ni pendientes dentro de Caja.
2. **Un solo primario visible.** “Confirmar venta” (o su variante de resultado) es el único botón de acento sólido. Los demás son secundarios o silenciosos.
3. **La verdad del dinero se ve antes que la estética.** Efectivo, digital verificado, demo, fiado y pendiente tienen tratamientos distintos, con texto e icono.
4. **El total manda.** Es el elemento tipográfico más grande de la pantalla después del H1; no compite con ilustraciones ni con tarjetas de resumen.
5. **Sin una segunda paleta.** Solo `--color-*`, `--shadow-*`, `--font-*` y los nuevos tokens de espacio/radio/foco. Cero hex en las hojas de ruta.
6. **La pantalla no finge.** No hay botones deshabilitados sin razón visible, ni “Cargando…” eterno, ni cifras de ejemplo presentadas como reales.

### 2.2 Color: roles, no valores nuevos

Todos los valores existen en `globals.css`. La tabla fija el uso; no propone hex nuevos.

| Token | Valor actual | Uso en Caja/Ventas | Contraste medido |
|---|---|---|---:|
| `--color-canvas` | `#f9f6ee` | Fondo de página. | — |
| `--color-surface` | `#fffdf7` | Tarjetas, filas, barras, hojas. | — |
| `--color-surface-2` | `#f2ebdf` | Campos agrupados, fila abierta, cambio (fondo). | — |
| `--color-ink` | `#1f2622` | Texto principal, importes. | 15.20:1 en surface · 14.31:1 en canvas |
| `--color-ink-2` | `#515b54` | Texto secundario, metadatos. | 6.94:1 en surface · 6.54:1 en canvas |
| `--color-placeholder` | `#6b6256` | Placeholder y texto deshabilitado. | 5.05:1 en surface-2 · 5.89:1 en surface |
| `--color-control-border` | `#687369` | Borde de campos, radios, botones secundarios. | 4.86:1 en surface |
| `--color-separator` | `#e0d6c7` | Hairlines y bordes de tarjeta; nunca controles. | 1.4:1: solo decorativo |
| `--color-accent` | `#0f3d36` | Acción primaria, marca, foco de selección. | 11.86:1 con `surface`; blanco sobre accent 11.86:1 |
| `--color-accent-press` | `#0a332c` | Pressed del primario. | 13.56:1 con `surface` |
| `--color-success` | `#0a5039` | **Solo** pago verificado por pey. | 8.20:1 en `green-soft` |
| `--color-attention` | `#8f2d1c` | Fiado, demo, pendiente, advertencia. | 8.06:1 en surface · 6.99:1 en terracotta-soft |
| `--color-danger` | `#8a281b` | Error de campo, error de envío, destructivo. | 8.60:1 en surface · 7.46:1 en terracotta-soft |
| `--color-info` | `#293b68` | Pendiente digital / información neutral. | 9.25:1 en blue-soft |
| `--color-focus` | `#0e6f5a` | Anillo de foco en superficies claras. | 5.65:1 en canvas · 6.00:1 en surface |
| `--color-green-soft` | `#e2f3e7` | Fondo de pagado/verificado y selección suave. | — |
| `--color-terracotta-soft` | `#fbe9e6` | Fondo de fiado/error. | — |
| `--color-saffron-soft` | `#fff0d2` | Fondo de demo/pendiente. | — |
| `--color-blue-soft` | `#e9ecf3` | Fondo de pendiente digital/parcial. | — |
| `--color-saffron` | `#f2c768` | Acento de marca y foco sobre negro. **Nunca texto sobre blanco.** | 7.55:1 sobre accent · 9.68:1 sobre ink |
| `--color-terracotta` | `#c1492e` | Acento cálido decorativo. | 4.85:1 en surface: no usar en texto pequeño; usar `attention`. |

**Prohibiciones de color:**

- `--color-success` no se usa en efectivo, fiado, demo, pendiente ni “copia”.
- `--color-saffron` no se usa como texto sobre `surface`/`canvas` (1.57:1).
- `--color-terracotta` no se usa como texto pequeño (3.14:1 sobre ink; 4.85:1 sobre surface).
- El color nunca es el único indicador: siempre icono + etiqueta textual.
- No se agrega ningún hex nuevo a `caja.css`/`ventas.css`. Si falta un rol, se añade el token en `globals.css` con aprobación, no un literal local.

### 2.3 Mapa de estados (tokens existentes)

| Estado | Fondo | Texto/icono | Icono | Etiqueta |
|---|---|---|---|---|
| Pagado verificado | `--color-green-soft` | `--color-success` | `Check` | “Pago verificado por pey” |
| Efectivo recibido | `--color-surface` + borde `--color-control-border` | `--color-ink` | `Banknote` | “Efectivo recibido” |
| Pendiente digital | `--color-blue-soft` | `--color-info` | `Clock3` | “Por cobrar” / “Esperando confirmación” |
| Parcial | `--color-surface-2` + borde `--color-control-border` | `--color-ink` | `CircleDashed` | “Pago parcial” |
| Fiado | `--color-terracotta-soft` | `--color-attention` | `NotebookPen` | “Fiado” |
| Demo | `--color-saffron-soft` | `--color-attention` | `FlaskConical` | “Demo” |
| Error | `--color-terracotta-soft` | `--color-danger` | `CircleAlert` | “No se pudo cobrar” |
| Neutro / borrador | `--color-surface-2` | `--color-ink-2` | `Clock3` | “Sin cobrar” |

Esta tabla separa **demo** de **parcial** (hoy ambos son casi idénticos) y **efectivo** de **verificado** (hoy el efectivo puede parecer éxito). Es una corrección semántica, no un cambio de contrato.

### 2.4 Tipografía Hearth / Alder

**Reparto:** Hearth solo marca, saludo editorial y título de página; Alder todo lo operativo, incluidas cifras, botones, campos, badges y tablas. Hearth **nunca** en importes.

| Rol | Familia | Tamaño / línea | Peso | Uso |
|---|---|---|---:|---|
| Título de página | Hearth | `clamp(1.75rem, 1.4rem + 1vw, 2.25rem)` / 1.05 | 600 | “Caja”, “Ventas” |
| Título de sección | Hearth | `1.375rem` / 1.15 | 600 | “Conceptos”, “Cobro” (solo si es editorial; si es operativo, Alder) |
| Título de tarjeta | Alder | `1.0625rem` / 1.35 | 600 | “Pedido en curso”, “Detalle de la venta” |
| Cuerpo | Alder | `1.0625rem` / 1.5 | 400 | Texto, ayudas, detalle |
| Cuerpo denso | Alder | `1rem` / 1.4 | 400 | Filas, metadatos largos |
| Label | Alder | `0.9375rem` / 1.3 | 600 | Campos, métodos, acciones |
| Metadato | Alder | `0.8125rem` / 1.35 | 500 | Fecha, folio, “3 conceptos” |
| Badge / sello | Alder | `0.75rem` / 1.2 | 700 | Estados; mayúsculas solo en “DEMO” |
| Total hero | Alder | `clamp(2.5rem, 2rem + 1.5vw, 3.5rem)` / 1 | 600 tabular | Total de la venta |
| Total de panel | Alder | `2.125rem` / 1.05 | 600 tabular | Total en hoja/resultado |
| Importe de fila | Alder | `1.0625rem` / 1.3 | 600 tabular | Filas de venta, subtotales |
| Cambio | Alder | `1.5rem` / 1.05 | 600 tabular | Cambio y saldo |

Reglas:

- Mínimo **12 px** para texto esencial; 11 px solo para sellos no esenciales, y aun así se prefiere 12.
- `font-variant-numeric: tabular-nums lining-nums` en todo importe; `white-space: nowrap` en total, cambio y saldo.
- Sin `font-synthesis`; sin features `ss01`/`cv11` heredadas de Inter.
- Tracking: display `-0.03em`; títulos `-0.015em`; cuerpo `0`; badges en mayúsculas `0.06em`.
- No usar Hearth en cifras, botones, labels, badges ni tablas.

### 2.5 Espacio, radios, bordes, foco y targets

**Espacio (base 4):** `4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`.

| Contexto | Desktop | Móvil |
|---|---:|---:|
| Gutter de página | 32 | 16 |
| Gap entre columnas | 24 | 16 |
| Padding de tarjeta | 20 | 16 |
| Gap entre secciones | 24 | 16 |
| Gap label → control | 6 | 6 |
| Gap control → ayuda | 4 | 4 |
| Gap entre campos | 12 | 12 |

**Radios:** control `12px`; campo `14px`; tarjeta `18px`; panel/hoja `20px`; hero/ilustración `26px`; píldora/badge `999px`. No usar `999px` en botones genéricos: solo pills y badges.

**Bordes:**

- Tarjeta: 1 px `--color-separator`.
- Campo/botón secundario: 1 px `--color-control-border` (≥3:1).
- Seleccionado: 2 px `--color-accent`.
- Error: 2 px `--color-danger` en el campo, más mensaje e icono.
- Vacío/agregar: 1 px dashed `--color-control-border`; nunca dashed en un control seleccionado.
- Sin doble borde + sombra fuerte. Tarjeta = borde + `--shadow-card` opcional; hoja = `--shadow-lift`.

**Foco:**

- Anillo 3 px `--color-focus`, offset 2 px, radio del control.
- Sobre accent/superficie oscura: 3 px `--color-surface` (blanco cálido), offset 3 px.
- Alto contraste: 3 px negro sobre claro, blanco sobre oscuro; activo de nav sobre negro: `--color-saffron`.
- `:focus-visible` para teclado; los campos también cambian borde a accent en `:focus`. Nunca `outline: none` sin reemplazo.
- El foco no puede quedar recortado por `overflow: hidden`, sticky bars ni `clip-path`.

**Targets:**

- Mínimo de la casa: **48×48 px** en todo control interactivo.
- Primario: **52 px** de alto; método: **56 px**; campo: **52 px**; fila de historial: **64 px** mínima.
- Icon-only: 48×48 con `aria-label`; separación ≥8 px.
- WCAG 2.2: 24 px es el mínimo legal; la casa usa 48. No se baja a 40 para “que quepa”.

### 2.6 Movimiento

- `--mc-motion-fast: 160ms`, `--mc-motion-base: 220ms`, `--mc-motion-slow: 300ms`; ease `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- El total no hace count-up; aparece estable. El cambio puede tener un fade de 120 ms.
- La hoja de resultado entra con fade + 12 px, 220 ms; sin rebote ni escala.
- El mic ring solo mientras se graba; en idle, sin animación.
- `prefers-reduced-motion`: sin traslación, sin count-up, sin barrido de tabs; el estado se conserva.
- Sin animaciones que retrasen la confirmación ni que oculten un estado.

### 2.7 Namespace y arquitectura CSS

- Nuevas hojas: `web/src/app/caja/caja.css` y `web/src/app/ventas/ventas.css`.
- Todo selector de página empieza por `.mc-caja` o `.mc-ventas`; los componentes compartidos usan `.mc-*` y viven en `components/ui` o `components/caja`.
- No se estilizan clases del shell (`inicio-*`) desde la página. Si hace falta un ajuste de shell, se hace en `shell.css` con aprobación de `mc-shell-responsive`.
- No `!important`; no estilos inline salvo variables dinámicas inevitables (por ejemplo, un ancho de barra). En Caja/Ventas no debería haber ninguno.
- Container queries para la composición: `.mc-caja { container-type: inline-size; }`; dos columnas cuando el contenedor mide ≥880 px, una columna debajo. Así 1024 con sidebar no fuerza dos columnas estrechas.
- `barrio.css` sigue global en B; el namespace evita colisiones. Su scoping se pospone.

---

## 3 · Composición exacta de `/caja`

### 3.1 Árbol de la pantalla

```tsx
<AppShell
  activeHref="/caja"
  mainId="main"
  contentClassName="mc-caja"
  topbar={<TopBar merchant address initial demo />}
>
  <PageHeader
    className="mc-page-header--compact"
    eyebrow="Mostrador"
    title="Caja"
    subtitle="Cobra una venta; tú confirmas."
    actions={<button className="mc-button mc-button--quiet">Verificar comprobante</button>}
  />

  <div className="mc-caja__layout">
    <section className="mc-caja__main" aria-labelledby="conceptos-title">
      <header className="mc-ticket__head">
        <h2 id="conceptos-title">Conceptos</h2>
        <span>3 conceptos · 5 piezas</span>
        <button className="mc-button mc-button--quiet">Limpiar</button>
      </header>

      <Composer />          {/* voz + texto + agregar a mano */}
      <Ticket />            {/* filas editables + errores + agregar */}
      <p className="mc-trust">La venta no se envía hasta que confirmes.</p>
    </section>

    <aside className="mc-caja__rail" aria-labelledby="cobro-title">
      <CobroPanel />         {/* total, método, efectivo/cambio, fiado, digital, CTA */}
    </aside>
  </div>

  <CobroBar />              {/* solo ≤760: total + CTA fijo sobre la nav */}
</AppShell>
```

Notas de integración:

- `mainId="main"` para conservar el foco global de `globals.css` (`main#main:focus-visible`) y el contrato de skip link.
- `contentClassName="mc-caja"` obligatorio: `inicio-content` tiene grid de 5 áreas y no debe usarse aquí.
- `PageHeader` con modificador compacto; el título no debe llegar a 52 px en una pantalla operativa.
- El shell sigue siendo el de Oleada A; no se crea un segundo shell.

### 3.2 Header

- **Topbar del shell:** comercio, dirección, sello DEMO, avatar. No se duplica.
- **PageHeader:** eyebrow “Mostrador”; H1 “Caja”; subtítulo de una línea. Ejemplos:
  - Sin conceptos: “Cobra una venta; tú confirmas.”
  - Con conceptos: “3 conceptos · $245.00 · 12:40”.
  - Error de datos: “No pudimos cargar los totales. No hay cifras nuevas.”
- **Acción secundaria:** “Verificar comprobante” (48 px, texto + escudo). Abre la hoja existente. No es un botón primario.
- **Sin KPIs, sin tarjetas de resumen, sin ilustración de hero.** El contexto del día vive en una sola línea del subtítulo o en el pie del panel de cobro, nunca en cuatro tarjetas.

### 3.3 Composer de conceptos

La captura debe seguir siendo la misma que ya funciona: voz, texto y alta manual. Cambia la jerarquía, no la lógica.

**Composición:**

1. **Fila principal** (≥640 px): botón de micrófono 56×56 + campo de texto flexible + botón “Interpretar” (secundario, 48 px).
2. **Fila secundaria:** “Agregar a mano” (quiet, 48 px) + “Escuchar ayuda” (quiet, 48 px) + texto de ayuda “Sin IA: escribe producto, cantidad y precio.”
3. **Frases de ejemplo:** solo cuando no hay conceptos o en modo demo; chips de 48 px, secundarios. No compiten con el micrófono.
4. **Estados de voz:** idle, grabando (anillo + segundos), transcribiendo (spinner + “Interpretando…”), error (banner + “Escribir productos”). El error nunca bloquea: el alta manual queda a la vista.
5. **Móvil ≤639:** el campo ocupa una fila completa; debajo, micrófono 56 + “Interpretar” flexible + “Agregar” icono 48. El label “Mantén y habla” va bajo el micrófono, 12 px.

**Reglas:**

- Placeholder: “Ej. 2 quesadillas $35”. No sustituye al label “Escribe la venta”.
- `Enter` interpreta; no envía la venta.
- El micrófono es press-and-hold (pointer y teclado); no es un toggle.
- No hay FAB flotante; el composer vive en el flujo.
- La voz es opcional: sin micrófono, la pantalla se completa con texto/manual.

### 3.4 Ticket de conceptos

**Fila (desktop ≥760):** `[índice] [descripción flexible] [cantidad − input +] [precio $] [subtotal] [quitar]`.
**Fila (520–759):** dos líneas: descripción + quitar; cantidad + precio + subtotal.
**Fila (≤519):** tres líneas: descripción + quitar; cantidad + precio; subtotal alineado a la derecha. Sin scroll horizontal.

Especificación:

- `<ol>` semántica; índice `01`, `02` en Alder 600 tabular, decorativo (`aria-hidden`).
- Descripción: input 52 px, label visible o `aria-label="Producto"`; no depende del placeholder.
- Cantidad: stepper `−` / input / `+`, targets 48, `inputMode="decimal"`, mínimo 0.25, paso 0.25. Acepta fracciones de mercado.
- Precio: input 52 px, `$` como prefijo visual, `inputMode="decimal"`, alineado a la derecha; se formatea a dos decimales al salir, no en cada tecla.
- Subtotal: Alder 600 tabular, 17 px; no editable.
- Quitar: icono 18, target 48, `aria-label="Quitar producto"`; no usa solo el color rojo.
- Agregar: borde dashed, 52 px, full width; no es primario.
- Limpiar: quiet; pide confirmación inline (“¿Descartar la venta sin confirmar?”) con Cancelar / Sí, limpiar. No usa `window.confirm`.
- Errores: fila con borde izquierdo 2 px danger; mensaje debajo, `role="alert"`, `aria-invalid` en el campo; foco al primer campo inválido; resumen “Revisa los productos marcados.” arriba.
- Vacío: una línea “La caja está lista.” + “Habla, escribe o agrega un producto.” + acciones; ilustración opcional ≤64 px, nunca 140 px.
- Avisos de borrador recuperado / cobro pendiente: banner de una línea sobre el composer, `role="status"`, acciones de 48 px; no modal.

### 3.5 Panel de cobro

#### Total

- Label “Total” (12 px, 700, mayúsculas, tracking 0.06em, `ink-2`).
- Importe hero Alder 600 tabular, `clamp(2.5rem, 2rem + 1.5vw, 3.5rem)`, `nowrap`.
- Meta: “3 conceptos · 5 piezas” o “Sin conceptos”.
- Sin conceptos: `$0.00` + “Agrega un concepto para cobrar.” No se inventa un total.
- El total no se anima ni se parte antes del decimal.

#### Selector de método

- `<fieldset>` con `<legend>` “¿Cómo cobras?”.
- Tres radios reales, visualmente ocultos, con labels/tiles de 56 px:
  - **Efectivo** · `Banknote`.
  - **Digital** · `QrCode` · sublabel “Link o QR”.
  - **Fiado** · `NotebookPen`.
- Un solo seleccionado por defecto: Efectivo.
- Seleccionado: borde 2 px accent + fondo `green-soft` + icono accent; no solo color: check visible.
- No seleccionado: surface + borde control-border; hover borde accent/60.
- Foco: anillo 3 px en el tile (`:has(input:focus-visible)`), no en el radio invisible.
- Teclado: flechas mueven entre radios; `Tab` entra y sale del grupo.
- **“Mixto” no es un cuarto tab.** Es un estado que aparece cuando hay más de una fuente. Se muestra como desglose, no como método.

#### Efectivo y cambio

- Campo “Efectivo recibido”, 52 px, `$` prefijo, `inputMode="decimal"`.
- Ayuda: “Escribe lo que te dieron; el cambio se calcula solo.”
- Si `cash > total`: bloque **Cambio**:
  - Label “Cambio”, importe 1.5rem Alder 600 tabular.
  - Fondo `surface-2`, texto `ink`; icono `Banknote`.
  - **No usar verde de éxito**: el cambio no es un pago verificado.
  - Meta: “Se aplican $X al cobro.”
- Si `0 < cash < total`: bloque **Falta cubrir**:
  - Fondo `saffron-soft` o `surface-2`, texto `ink`/`attention`; icono `Clock3`.
  - Copy: “Faltan $X. Cóbralos con link o anótalos a fiado.”
  - Dos acciones de 48 px: “Cobrar con link” (marca complemento digital) y “Fiar el resto” (revela cliente y calcula crédito).
  - No es un error rojo: es una decisión pendiente.
- Si `cash = 0` y el método es Efectivo: mostrar la misma línea de “Falta cubrir $X” con las dos acciones, sin regañar.
- Si `cash > 0` y hay cambio, el CTA sigue siendo “Confirmar venta”; el resultado repite el cambio.
- **Nunca** crear una venta con un remanente digital implícito si el usuario eligió Efectivo y no eligió complemento. El CTA se bloquea con explicación y las dos salidas.

#### Fiado

- Aparece cuando `creditCents > 0` o el usuario elige Fiado.
- Campo “¿Quién queda a deber?” 52 px, icono `UserRound`, placeholder “Ej. Juan”; label persistente.
- Copy: “Fiado es deuda, no dinero recibido.” Una línea, 13 px.
- Desglose: “Fiado $X”.
- Si falta el nombre y se intenta confirmar: error inline `role="alert"`, foco al campo, no se limpia nada.
- Si el fiado supera el total: error “El fiado no puede superar el total.” y foco al campo.
- Fiado puro: CTA “Confirmar fiado” (o “Confirmar venta” con helper “Quedará a fiado con Juan”). No verde; badge terracota.
- Fiado + efectivo: badge “Pago mixto” o “Fiado + efectivo”; desglose claro; el total no se presenta como cobrado.

#### Digital

- No pide datos de tarjeta. No hay campos de tarjeta.
- Copy: “Se cobra con link o QR. El banco confirma; una captura no cuenta.”
- Importe digital = remanente después de efectivo/fiado. Si es el método principal, es el total.
- CTA: “Confirmar y generar cobro” (o “Confirmar venta” con helper “Se generará un link por $X”).
- Después de crear el pedido, se abre la hoja de cobro existente para generar link/QR. Si el usuario la cierra, el resultado queda en **Por cobrar** y ofrece “Cobrar $X”.
- Estados: “Por generar”, “Esperando confirmación”, “Verificado por pey”, “Demo”, “Sin verificar”. El estado nunca se inventa en cliente.

#### Desglose y CTA

- Desglose solo si hay más de una fuente o si hay deuda:
  - “Efectivo $X”
  - “Fiado $Y”
  - “Digital $Z”
  - “Total $T”
- CTA primario único:
  - Efectivo completo: “Confirmar venta”.
  - Efectivo + link: “Confirmar y cobrar”.
  - Fiado: “Confirmar fiado”.
  - Digital: “Confirmar y generar cobro”.
  - Todos con `aria-label` que incluye el total (“Confirmar venta por $245.00”).
- Helper debajo del CTA, 13 px:
  - “Se cobrarán $80.00 con link.”
  - “Quedará a fiado con Juan.”
  - “Cambio $10.00.”
- Loading: spinner 16 + “Confirmando…”, `aria-busy`, ancho estable, deshabilitado para evitar doble envío.
- Error de envío: alerta inline sobre el CTA (`role="alert"`), mensaje con qué pasó y qué hacer; conserva conceptos, efectivo, fiado y cliente; el reintento usa la misma llave de idempotencia.
- No hay un segundo primario “Cobrar después” ni “Guardar”. La venta se confirma o se sigue editando.

### 3.6 Resultado

El resultado reemplaza el formulario en el mismo panel; no es solo un toast ni una hoja que se va. `role="status"` / `aria-live="polite"`; al aparecer, el foco va al título del resultado (`tabIndex={-1}`). Una sola acción primaria.

| Variante | Icono / tono | Título | Detalle | Acción primaria | Acción secundaria |
|---|---|---|---|---|---|
| Efectivo | `Banknote` / neutro | “Efectivo recibido” | Total, cambio si aplica, folio | “Nueva venta” | “Ver en Ventas” |
| Verificado | `Check` / verde | “Pago verificado por pey” | Total, folio, “Puedes entregar” | “Listo para entregar” (si aplica) | “Nueva venta” |
| Fiado | `NotebookPen` / terracota | “Quedó anotado a fiado” | “Fiado $X con Juan”, “No es dinero recibido” | “Nueva venta” | “Ver en Fiados” |
| Pendiente | `Clock3` / azul | “Esperando confirmación” | “Falta cobrar $X”, “No entregues hasta que el banco confirme” | “Cobrar $X” / “Compartir link” | “Cerrar” |
| Demo | `FlaskConical` / maíz | “Pago demo (simulado)” | “No es dinero real. No se entrega.” | “Cerrar demo” | “Nueva venta” |
| Deuda confirmada | `NotebookPen` + `Clock3` / terracota/azul | “Venta confirmada; falta cobrar $X” | Desglose efectivo/fiado/digital | “Cobrar $X” (si digital) | “Ver en Fiados” / “Nueva venta” |
| Error | `CircleAlert` / danger | “No se pudo cobrar” | Qué pasó + qué hacer | “Reintentar” | “Seguir editando” |

Reglas del resultado:

- **Verde solo para pey verificado.** Efectivo, fiado y demo no usan verde.
- **Demo nunca dice “Pagado”.** Usa “Pago demo (simulado)” y “Cerrar demo”.
- **Fiado nunca dice “Cobrado”.** Usa “Quedó anotado” / “Fiado”.
- **Pendiente nunca dice “Listo”.** Usa “Esperando confirmación” y “No entregues”.
- El cambio se repite en el resultado de efectivo; no se pierde al cerrar.
- “Nueva venta” limpia el formulario y vuelve al estado vacío; no recarga la página.
- “Ver en Ventas” navega a `/ventas` con el folio resaltado (`?venta=...`), si se implementa; si no, a `/ventas`.

### 3.7 Mapa de intención de cobro → motor existente

El motor no se reescribe. La UI solo decide qué `cashCents` / `creditCents` enviar y cuándo abrir el cobro digital. El remanente digital lo deriva el servidor (`total - cash - credit`).

| Intención UI | `cashCents` | `creditCents` | Remanente | Resultado del servidor | Acción posterior |
|---|---:|---:|---|---|---|
| Efectivo exacto | total | 0 | 0 | `paid` (efectivo) | Resultado efectivo |
| Efectivo con cambio | total (el servidor recorta) | 0 | 0 | `paid` (efectivo) | Resultado + cambio |
| Efectivo parcial + link | parcial | 0 | >0 | `confirmed` con deuda digital | Abrir hoja link/QR → `payment_pending` |
| Efectivo parcial + fiado | parcial | total − parcial | 0 | `confirmed` con crédito | Resultado fiado/mixto |
| Fiado puro | 0 | total | 0 | `confirmed` con crédito | Resultado fiado |
| Digital puro | 0 | 0 | total | `confirmed` con deuda digital | Abrir hoja link/QR → `payment_pending` |
| Digital + fiado | — | — | — | **No se crea en B**; solo se muestra si viene de datos viejos | — |
| Sobrepago de fiado | — | >total | — | **Bloqueado en UI** | Error + foco |

Condiciones de implementación:

- El selector de método es estado presentacional; **no se agrega un método nuevo al contrato**. `CreateOrderInput` sigue aceptando `cashCents`, `creditCents`, `paymentMethod` y `requestId`.
- Si el usuario elige Efectivo y no cubre el total, el CTA no envía un remanente digital silencioso: exige “Cobrar con link” o “Fiar el resto”.
- Si el usuario elige Digital, el pedido se crea con `cashCents=0`, `creditCents=0`; el remanente es el total. La hoja existente genera link/QR.
- `requestId` se conserva entre reintentos; no se limpia el borrador hasta tener `order.id`.
- No se marca `paid` en cliente. Solo el webhook firmado de pey cambia `payment_pending → paid`; demo es `demo_paid`; efectivo es efectivo, no pey.

### 3.8 Responsive y primer viewport

| Rango | Composición | Cobro | Confirmación |
|---|---|---|---|
| ≥1200 | Dos columnas: conceptos ~1fr, cobro 380 px, gap 24. | Columna derecha sticky `top: 24px`; total/método/campos/CTA visibles. | CTA en la columna. |
| 1024–1199 | Dos columnas si el contenedor mide ≥880; si no, una columna. | Columna derecha 360–380 px o bloque arriba. | CTA en la columna/bloque. |
| 761–1023 | Una columna: header → cobro → composer → ticket. | Cobro arriba, sin barra fija. | CTA dentro del bloque. |
| ≤760 | Una columna: header → cobro → composer → ticket. | Cobro arriba; CTA en barra fija sobre la nav móvil. | Barra fija 64 px + nav 64 px. |
| ≤340 | Igual; la barra fija pasa a dos filas si el importe no cabe. | Total 1.25rem + CTA full width. | Barra 112 px. |

**Criterio de primer viewport:** en 1448×1086, 1366×768, 390×844 y 320×640, el total, el grupo de métodos y el CTA primario están completamente visibles, sin scroll, con ≥16 px de margen y sin quedar debajo de la nav móvil. En 390/320, además, el campo de texto del composer debe estar al menos parcialmente visible. En 724×543 (200 %), total/método/CTA deben estar visibles; el composer puede requerir scroll.

Números objetivo para la maqueta (no promesas de implementación):

- 390×844: topbar 64 + header ~72 + total ~112 + métodos ~80 + CTA ~68 = **~396 px** hasta el CTA; el composer empieza antes de 600.
- 320×640: mismo orden; CTA antes de **~520 px**; composer visible antes de 600.
- 1366×768: topbar 100 + header 72 + contenido 24 + rail ~368 = CTA antes de **~600 px**.
- 1448×1086: CTA antes de **~650 px**.

La barra fija móvil:

- Altura 64 px + safe area; fondo `surface`, borde superior `separator`, `shadow-lift`; z-index 40 (la nav móvil es 50).
- Izquierda: “Total” 12 px + importe 1.25rem tabular + helper condicional (“Cambio $X”, “Falta $X”, “Fiado”).
- Derecha: CTA 52 px, `aria-label` con total.
- No se muestra en el estado resultado; el resultado tiene sus propias acciones.
- `padding-bottom` del contenido: `calc(64px + 64px + env(safe-area-inset-bottom) + 16px)` para que la última fila no quede tapada.
- Montarla en un portal o como hermana de `main` dentro del shell; si vive dentro de `main`, ningún ancestro puede tener `transform`, `filter` o `overflow: hidden`, o el `fixed` se rompe.

---

## 4 · Matriz de estados visuales de `/caja`

| # | Estado | Disparador | Tratamiento visual | Copy principal | Acción primaria | Prohibido |
|---|---|---|---|---|---|---|
| 1 | **Vacío** | 0 conceptos | Total `$0.00`; método Efectivo; CTA deshabilitado con razón; ticket con línea y acciones; sin ilustración grande. | “La caja está lista. Habla, escribe o agrega un producto.” | “Agregar producto” / composer | Mostrar cifras de ejemplo como reales; CTA activo sin conceptos. |
| 2 | **Con conceptos** | ≥1 fila válida | Total actualizado; contador “3 conceptos · 5 piezas”; CTA activo; filas limpias. | “3 conceptos · $245.00” | “Confirmar venta” | KPIs, resumen de dashboard, total duplicado en grande. |
| 3 | **Error de campo** | Descripción/cantidad/precio inválidos | Fila con borde izquierdo danger; mensaje `role="alert"`; `aria-invalid`; foco al primer error; resumen “Revisa los productos marcados.” | “Escribe el producto.” / “La cantidad debe ser mayor a cero.” / “El precio debe ser mayor a cero.” | Foco al campo; corregir | Borrar la fila; perder lo escrito; error solo por color. |
| 4 | **Efectivo insuficiente** | `0 < cash < total` | Bloque attention/neutral “Faltan $X”; dos acciones de 48: link o fiado; CTA con helper; no es error rojo. | “Faltan $90.00. Cóbralos con link o anótalos a fiado.” | “Cobrar con link” o “Fiar el resto” | Enviar un remanente digital sin que el usuario lo elija; bloquear sin salida. |
| 5 | **Cambio** | `cash > total` | Bloque `surface-2` “Cambio $X”; importe 1.5rem; “Se aplican $Y al cobro.”; neutro, no verde. | “Cambio $10.00” | “Confirmar venta” | Usar `success`/verde; perder el cambio al confirmar. |
| 6 | **Fiado** | `credit > 0` | Badge terracota “Fiado”; campo cliente; desglose “Fiado $X”; copy “Es deuda, no dinero recibido.” | “¿Quién queda a deber? Ej. Juan” | “Confirmar fiado” | Verde, “Pagado”, “Cobrado”; crear deuda sin nombre. |
| 7 | **Pendiente digital** | Pedido `confirmed`/`payment_pending` con deuda digital | Badge azul “Por cobrar” / “Esperando confirmación”; importe; acciones link/QR; nota “No entregues”. | “Esperando confirmación. No entregues hasta que el banco confirme.” | “Cobrar $X” / “Compartir link” | “Pagado”, check verde, “Listo para entregar”. |
| 8 | **Demo** | `demoMode` + pago simulado | Badge maíz “Demo” + `FlaskConical`; bloque separado dashed; simulación secundaria. | “Pago demo (simulado). No es dinero real. No se entrega.” | “Cerrar demo” | Verde, “Pagado”, entrega; demo como primario. |
| 9 | **Pagado (efectivo)** | Pedido `paid` con provider cash | Badge neutro “Efectivo recibido” + `Banknote`; total; cambio. | “Efectivo recibido. Cambio $X.” | “Nueva venta” | Verde de verificado; “Pago verificado por pey”. |
| 10 | **Pagado (verificado)** | Webhook pey | Badge verde “Pago verificado por pey” + `Check`; total; “Puedes entregar”. | “Pago verificado por pey” | “Listo para entregar” / “Nueva venta” | Mostrarlo antes del webhook; inferirlo del cliente. |
| 11 | **Confirmado con deuda** | `confirmed` con `credit>0` y/o `digitalDue>0` | Badge “Fiado”/“Por cobrar”; título “Venta confirmada; falta cobrar $X”; desglose; acciones cobrar/ver fiado. | “Venta confirmada; falta cobrar $X.” | “Cobrar $X” o “Ver en Fiados” | Presentarlo como venta cobrada; sumar fiado a caja. |
| 12 | **Resultado** | Tras confirmar | Panel de resultado en el mismo lugar; icono + título + importe + detalle + acciones; `aria-live`. | Según variante | Según variante | Toast como único feedback; dos primarios; resultado que se cierra solo. |
| 13 | **Error de envío** | Fallo de red/500 | Alerta inline sobre CTA, `role="alert"`, conserva todo; “Reintentar” seguro. | “No pudimos confirmar la venta. Revisa tu conexión e intenta de nuevo.” | “Reintentar” | Limpiar el borrador; crear otra venta; cambiar la llave de idempotencia. |
| 14 | **Guardando** | POST en curso | Spinner + “Confirmando…”, `aria-busy`, CTA deshabilitado; total visible. | “Confirmando…” | — | Doble POST; ocultar el total; dejar el CTA activo. |

---

## 5 · Composición exacta de `/ventas`

### 5.1 Árbol

```tsx
<AppShell activeHref="/ventas" mainId="main" contentClassName="mc-ventas" topbar={<TopBar … />}>
  <PageHeader
    className="mc-page-header--compact"
    eyebrow="Libro de ventas"
    title="Ventas"
    subtitle="Lo que vendiste y cómo se cobró."
    actions={<Link href="/caja" className="mc-button mc-button--primary">Nueva venta</Link>}
  />

  <section className="mc-ventas__summary" aria-label="Resumen de hoy">
    <p>Hoy: <CurrencyAmount cents={summary.salesCents} /> vendidos · <CurrencyAmount cents={collected} /> cobrados · <CurrencyAmount cents={summary.pendingCents} /> por cobrar</p>
  </section>

  <div className="mc-ventas__filters">
    <fieldset>Periodo: Hoy / 7 días / Todo</fieldset>
    <fieldset>Estado: Todas / Pagadas / Por cobrar / Fiado</fieldset>
    <button className="mc-button mc-button--quiet">Limpiar filtros</button>
  </div>

  <section className="mc-sales" aria-labelledby="ventas-list-title">
    <h2 id="ventas-list-title" className="sr-only">Lista de ventas</h2>
    <div className="mc-sales__day">Hoy <span>12 ventas</span></div>
    <ul>
      <li><SaleRow order={order} onOpen={…} /></li>
    </ul>
    <button className="mc-sales__more">Cargar más</button>
  </section>

  <SaleDetailSheet order={selected} onClose={…} />
</AppShell>
```

### 5.2 Header y resumen

- H1 “Ventas”; subtítulo “Lo que vendiste y cómo se cobró.”
- Acción primaria “Nueva venta” → `/caja` (no `/`).
- Resumen de una línea, solo “Hoy” y solo con datos del `DailySummary` existente:
  - “Hoy: $1,240.00 vendidos · $980.00 cobrados · $260.00 por cobrar.”
  - `cobrados = summary.cashCents + summary.verifiedDigitalCents` (misma definición de “Cobrado hoy” que `/inicio`); no sumar fiado ni demo.
  - No es un KPI card; no cambia con los filtros. Se etiqueta “Hoy” para no mentir.
  - En demo: “Datos demo · Hoy: …”; el sello DEMO del shell sigue visible.
- Sin gráficas, sin metas, sin pendientes, sin actividad de otros módulos.

### 5.3 Filtros mínimos

Dos filtros, no cinco:

1. **Periodo:** Hoy / 7 días / Todo. Por defecto **Hoy**.
2. **Estado:** Todas / Pagadas / Por cobrar / Fiado. Por defecto **Todas**.

Reglas:

- “Pagadas” = dinero recibido (efectivo o pey verificado), sin crédito abierto; excluye demo.
- “Por cobrar” = deuda digital (`confirmed`/`payment_pending`/`partial` con remanente digital).
- “Fiado” = crédito abierto >0. Si una venta tiene fiado + digital, la fila se clasifica como **Fiado** y el detalle muestra ambas deudas; el filtro no pretende ser una máquina de estados.
- **En modo demo**, los filtros operan sobre las filas demo y “Pagadas” incluye `demo_paid`; el badge DEMO y el banner impiden leerlo como dinero real. Los totales reales y demo nunca se suman.
- “Limpiar filtros” solo aparece si hay un filtro activo.
- Estado en URL: `?periodo=hoy&estado=todas`; refrescar/atrás conserva la vista. No llenar el historial con cada cambio: `replace`.
- En móvil, los chips envuelven en 2 columnas; no hay scroll horizontal como única salida.
- No hay búsqueda en B. El audit previo recomienda no extraer `SearchField` hasta que exista una superficie real; aquí no se necesita para “mínimos”.

### 5.4 Fila / tarjeta de venta

**Desktop ≥720:** grid `[hora 72] [folio 88] [conceptos 1fr] [estado 180] [método 96] [importe 120] [chevron 24]`.
**Móvil <720:** tarjeta de 2–3 líneas:

```
$245.00                         [Pagado]
2 × Quesadilla · 1 × Agua
12:40 · Efectivo · Pedido A96B   ›
```

Reglas:

- Fila entera es un `<button>` (o `<Link>` si existe ruta de detalle) con `aria-haspopup="dialog"`; no hay botones anidados.
- **Importe:** total de la venta, Alder 600 tabular, 17–20 px; no se recorta; `nowrap`.
- **Estado:** badge con icono + texto, misma tabla que Caja. No usar solo color.
- **Método:** “Efectivo”, “Digital”, “Fiado”, “Mixto”; no confundir método con estado. “Digital” puede ser verificado o demo; el badge lo dice.
- **Fecha:** `<time dateTime>`; “12:40” si es hoy, “Ayer 18:02”, “3 nov 09:15”; detalle con fecha completa.
- **Conceptos:** una línea con `2 × Quesadilla · 1 × Agua`; si hay más, `+2`; en el detalle, lista completa con cantidad, descripción, precio unitario y subtotal.
- **Deuda:** si `due > 0`, una segunda línea pequeña “Falta $X” en attention; si hay fiado, “Fiado $X”. No mezclar con el total.
- **Demo:** sello rectangular “DEMO” en la línea de metadatos; fondo normal; no teñir toda la fila (evita que el demo parezca otra categoría de dinero).
- **Fila abierta:** `surface-2`, borde izquierdo 2 px accent; foco visible.
- **Agrupación:** por día local de México; encabezado “Hoy”, “Ayer”, “3 nov”; contador a la derecha; hairline. No sticky headers en B.

### 5.5 Detalle

- Desktop: hoja lateral derecha de 480 px o `<dialog>` centrado; móvil: hoja inferior ≤90dvh, header/footer fijos, body scrollable.
- Header: “Venta A96B” + badge de estado + fecha completa.
- Importe total grande (Alder 600 tabular) + desglose:
  - Efectivo $X
  - Digital verificado $Y
  - Digital demo $Y
  - Fiado $Z
  - Cambio $C
- Lista de conceptos: cantidad × descripción, precio unitario, subtotal; total.
- Cliente si hay fiado.
- Estado de la deuda: “Saldo $X” o “Saldado”; si está saldado, no mostrar “Fiado” como deuda viva.
- Acciones: una sola primaria.
  - Si hay deuda digital: “Cobrar saldo” (abre el flujo existente de link/QR).
  - Si hay fiado: “Ver en Fiados” (ruta existente) o “Registrar abono” solo si se reutiliza la hoja existente; no duplicar la lógica.
  - Si está pagada: “Cerrar”.
- Sin “Cancelar venta”, “Reembolsar” ni “Editar”: no existen en el contrato; no se inventan.
- Foco atrapado, Escape cierra, foco vuelve a la fila. `aria-labelledby` al título.

### 5.6 Estados de `/ventas`

| Estado | Visual | Copy | Acción |
|---|---|---|---|
| Cargando | 5 skeletons de fila + skeleton de resumen; filtros visibles. | — | — |
| Con datos | Lista agrupada; resumen de hoy; “Cargar más” si `hasMore`. | “12 ventas · Mostrando 12 de 84” | Abrir detalle |
| Vacío real | `EmptyState` con icono de recibo; sin cifras inventadas. | “Aún no hay ventas en este periodo.” | “Nueva venta” |
| Vacío por filtro | Igual, más específico. | “No hay ventas con este filtro.” | “Ver todas” |
| Error sin datos | Banner `role="alert"` con icono; no mostrar $0 como verdad. | “No pudimos cargar las ventas. No sabemos si hay ventas.” | “Reintentar” |
| Error con datos viejos | Banner `role="status"` sobre la lista; conservar filas. | “No pudimos actualizar. Estos son los últimos datos cargados.” | “Reintentar” |
| Demo | Banner de demo + sello DEMO en filas; resumen “Datos demo”. | “Estos movimientos son una simulación.” | — |
| Paginación | “Cargar más” 48 px; “Mostrando 20 de 84”. | — | Cargar más |

---

## 6 · CSS legacy: qué NO copiar y qué clases nuevas usar

### 6.1 No copiar de `barrio.css`

| Bloque legacy | Por qué no copiarlo | Clase nueva |
|---|---|---|
| `.app-shell`, `.desk-shell`, `.app-main`, `.topbar`, `.main-container`, `.app-sidebar`, `.index-tab`, `.sidebar-*`, `.mobile-tabs`, `.tab-shell`, `.tab-readable` | Shell/scroll legacy; dos modelos de scroll y dos navegaciones. | `AppShell` + `.mc-caja` / `.mc-ventas` |
| `.caja-layout`, `.caja-page`, `.caja-page--venta`, `.caja-page--libro` | Layout de “dos páginas de cuaderno”, sin relación con la nueva jerarquía. | `.mc-caja__layout`, `.mc-caja__main`, `.mc-caja__rail` |
| `.caja-panel`, `.caja-card-header`, `.caja-card-title`, `.caja-card-subtitle` | Tarjeta editorial con padding fijo; no es el panel de cobro. | `.mc-cobro`, `.mc-ticket` |
| `.calc-display*` | LCD verde con gradiente `#eef6ec → #ddeddf`; hardcode y rol display en cifras. | `.mc-total` (Alder tabular, surface) |
| `.caja-voice`, `.mic-*`, `.sale-line*`, `.interpret-key`, `.transcript-note`, `.sample-phrases`, `.note-chip` | Lenguaje de “papelitos”, chips y mic 64; targets y jerarquía irregulares. | `.mc-composer*`, `.mc-button`, `.mc-chip` |
| `.draft-sheet*`, `.draft-item*`, `.draft-item__num`, `.qty-*`, `.price-input`, `.draft-add`, `.draft-empty` | Grid de 4 filas, radios 4–10 px, hardcodes; no escala a 320 sin deuda. | `.mc-ticket*` |
| `.checkout-key*`, `.cobrar-key`, `.sale-key-grid` | Total en “LCD” verde y tecla gigante; compite con el total principal. | `.mc-total`, `.mc-cta` |
| `.split-fields`, `.pay-line*`, `.fiado-customer*` | Wrappers con borde que duplican el borde del input; labels poco claros. | `.mc-field`, `.mc-cash`, `.mc-credit` |
| `.ledger*`, `.book-*`, `.debt-note*`, `.pending-strip*`, `.credit-*`, `.goal-*` | Otros módulos (fiado/corte/meta); no pertenecen a B. | No se usan |
| `.state-pending`, `.state-partial`, `.state-demo`, `.state-verified`, `.state-draft`, `.state-credit` | Demo y parcial casi idénticos; seis estados sin tokens de rol. | `.mc-badge--*` |
| `.home-*`, `.stamp-*`, `.paper-canvas`, `.scroll-progress`, `.shimmer`, `.blink`, `.motion-list` | Capa Inicio/home y movimiento decorativo; no aportan a la tarea. | `.mc-skeleton` si hace falta; sin `shimmer` |
| `#cfe3d4`, `#eef6ec`, `#ddeddf`, `#5c7264`, `#4e6457`, `#9dbba7`, `#fbfaf5`, `#f4f8ef`, `#fbfdf8`, `#b9cdbd` | Hex locales y gradientes; rompen la regla de tokens. | Tokens `--color-*` |
| `border-radius: 999px` en botones genéricos | Convierte cualquier acción en píldora; pierde jerarquía. | Radios 12/14/18/20; 999 solo badge/pill |
| `font-family: var(--font-display)` en `.calc-display__total`, `.checkout-key__total`, `.ledger tfoot td` | Hearth/Fraunces en cifras; HIG lo prohíbe. | Alder 600 tabular |
| `box-shadow` locales (19 valores) | Inconsistencia y ruido. | `--shadow-card` / `--shadow-lift` |
| `!important` y overrides de `html[data-text-zoom]` que ocultan contenido | Parches de una capa anterior; no se heredan. | Reglas de texto/espaciado en `caja.css` |

**Clases declaradas en JSX pero sin CSS** (no copiar ni asumir que existen): `.cta-primary`, `.paper-canvas`, `.tab-shell`, `.tab-readable`. Son deuda del monolito; no son un sistema.

### 6.2 Clases nuevas

**Caja:**

`.mc-caja`, `.mc-caja__layout`, `.mc-caja__main`, `.mc-caja__rail`, `.mc-composer`, `.mc-composer__row`, `.mc-composer__voice`, `.mc-composer__field`, `.mc-composer__actions`, `.mc-composer__samples`, `.mc-ticket`, `.mc-ticket__head`, `.mc-ticket__list`, `.mc-ticket__row`, `.mc-ticket__index`, `.mc-ticket__desc`, `.mc-ticket__qty`, `.mc-ticket__price`, `.mc-ticket__subtotal`, `.mc-ticket__remove`, `.mc-ticket__error`, `.mc-ticket__add`, `.mc-ticket__empty`, `.mc-cobro`, `.mc-cobro__head`, `.mc-total`, `.mc-total__label`, `.mc-total__amount`, `.mc-total__meta`, `.mc-methods`, `.mc-method`, `.mc-method__icon`, `.mc-method__label`, `.mc-cash`, `.mc-change`, `.mc-due`, `.mc-credit`, `.mc-digital`, `.mc-breakdown`, `.mc-breakdown__row`, `.mc-cta`, `.mc-cobro-bar`, `.mc-result`, `.mc-result__icon`, `.mc-result__title`, `.mc-result__amount`, `.mc-result__detail`, `.mc-result__actions`.

**Ventas:**

`.mc-ventas`, `.mc-ventas__summary`, `.mc-ventas__filters`, `.mc-filter`, `.mc-filter[aria-pressed="true"]`, `.mc-sales`, `.mc-sales__day`, `.mc-sales__list`, `.mc-sale`, `.mc-sale__main`, `.mc-sale__meta`, `.mc-sale__amount`, `.mc-sale__state`, `.mc-sale__detail`, `.mc-sales__empty`, `.mc-sales__more`, `.mc-sheet`, `.mc-sheet__header`, `.mc-sheet__body`.

**Compartidas nuevas:**

`.mc-badge` + `.mc-badge--paid|--cash|--pending|--credit|--demo|--partial|--error|--neutral`; `.mc-banner` + `.mc-banner--error|--attention|--info|--demo`; `.mc-field`, `.mc-field__label`, `.mc-field__control`, `.mc-field__help`, `.mc-field__error`; `.mc-button` + `.mc-button--primary|--secondary|--quiet|--danger`; `.mc-card`; `.mc-divider`; `.mc-toolbar`.

**No usar en páginas nuevas:** `.inicio-*` (salvo lo que el shell renderiza internamente), `.app-*`, `.topbar`, `.main-container`, `.caja-*`, `.draft-*`, `.checkout-*`, `.pay-*`, `.state-*`, `.home-*`, `.book-*`, `.ledger*`.

---

## 7 · Criterios visuales verificables y capturas

### 7.1 Criterios medibles

1. **Primer viewport.** En 1448×1086, 1366×768, 390×844 y 320×640:
   - `[data-mc="total"]`, `[data-mc="methods"]` y `[data-mc="confirm"]` tienen `getBoundingClientRect().top >= 0`, `bottom <= innerHeight - 16`, y no se solapan con `[data-mc="mobile-nav"]`.
   - `[data-mc="composer"]` tiene al menos 48 px visibles en 390/320; en 1448/1366, al menos el borde superior.
   - En 724×543 (200 %): total/método/CTA visibles; composer puede requerir scroll; sin scroll horizontal.
2. **Sin overflow.** `document.documentElement.scrollWidth === clientWidth` y `main.scrollWidth === main.clientWidth` en los cinco anchos + 200 %. El total, cambio, saldo e importes de fila cumplen `scrollWidth <= clientWidth` y no se parten antes del decimal.
3. **Tipografía.** Hearth solo en `h1`/marca; Alder en `input`, `button`, `[data-mc="amount"]`, badges; ningún importe usa `--font-display`; mínimo 12 px en texto esencial; `tabular-nums` en todos los importes.
4. **Contraste.** axe 0 violaciones serious/critical en normal y alto contraste; revisión manual de los pares de §2.2; los estados se distinguen sin color (icono + texto). Foco visible ≥3:1 contra su fondo.
5. **Targets.** Todo control interactivo mide ≥48×48 (área de hit, no solo icono); separación ≥8; el CTA mide 52 de alto; los métodos 56.
6. **Foco y teclado.** Orden: skip link → sidebar/topbar → mobile nav → main → composer → filas → métodos → campos → CTA. El foco no queda bajo la barra fija; al confirmar, va al título del resultado; Escape cierra hojas y devuelve el foco; los radios se mueven con flechas.
7. **Estados.** Los 14 estados de §4 existen y son distinguibles; verde solo en verificado; demo maíz + Flask; fiado terracota + Notebook; pendiente azul + Clock; efectivo neutro + Banknote; error rojo + Alert.
8. **Demo.** Sello DEMO visible en topbar a 1448/1366/390/320; bloque de simulación separado; ninguna acción demo es primaria; ninguna etiqueta demo dice “Pagado” ni “Entregado”.
9. **Ventas.** Cada fila muestra fecha, importe, estado, método y conceptos; los filtros se reflejan en URL; vacío y error son distintos; el detalle tiene foco atrapado y una sola acción primaria.
10. **Tokens.** `rg` no encuentra hex en `caja.css`/`ventas.css`; no hay `--inicio-*` en las páginas nuevas; no hay `!important`; no se usan clases de `barrio.css`; no se usan `.state-*`. `rg "inicio/inicio.css" web/src/app/caja web/src/components/caja` no debe devolver un import; si lo devuelve, es un puente temporal documentado, no la solución final.

### 7.2 Matriz de capturas obligatorias

**Viewports base:** 1448×1086, 1366×768, 390×844, 320×640. **Extra:** 724×543 (200 %) y alto contraste 1448/390.

| Estado | 1448 | 1366 | 390 | 320 | Extra |
|---|---:|---:|---:|---:|---|
| C1 Vacío | ✓ | ✓ | ✓ | ✓ | 200 %, HC |
| C2 Con conceptos | ✓ | ✓ | ✓ | ✓ | 200 %, HC |
| C3 Error de campo | ✓ | ✓ | ✓ | ✓ | — |
| C4 Efectivo insuficiente | ✓ | ✓ | ✓ | ✓ | 200 % |
| C5 Cambio | ✓ | ✓ | ✓ | ✓ | 200 % |
| C6 Fiado | ✓ | ✓ | ✓ | ✓ | HC |
| C7 Pendiente digital | ✓ | ✓ | ✓ | ✓ | 200 %, HC |
| C8 Demo | ✓ | ✓ | ✓ | ✓ | HC |
| C9 Pagado efectivo | ✓ | ✓ | ✓ | ✓ | — |
| C10 Pagado verificado | ✓ | ✓ | ✓ | ✓ | HC |
| C11 Confirmado con deuda | ✓ | ✓ | ✓ | ✓ | 200 %, HC |
| C12 Resultado (contact sheet C9–C11) | ✓ | ✓ | ✓ | ✓ | — |
| V1 Ventas con datos | ✓ | ✓ | ✓ | ✓ | 200 % |
| V2 Ventas vacío | ✓ | ✓ | ✓ | ✓ | — |
| V3 Ventas error | ✓ | ✓ | ✓ | ✓ | HC |
| V4 Detalle de venta | ✓ | ✓ | ✓ | ✓ | HC |

**Nombres:**

- `quality-reports/oleada-b/capturas/caja-c01-vacio-1448x1086.png`
- `.../caja-c05-cambio-390x844.png`
- `.../caja-c07-pendiente-200-724x543.png`
- `.../caja-c08-demo-hc-1448x1086.png`
- `.../ventas-v01-datos-320x640.png`

**Condiciones de captura:**

- Build de producción, servidor con `/api/health` del mismo SHA; no `next dev`.
- Base de datos/seed documentada por estado; no inventar datos en la UI. Para demo, `demoMode` activo y reset previo.
- `deviceScaleFactor=1`, viewport exacto, `wait_until="networkidle"`, 300 ms de asentamiento.
- Para estados con foco, capturar con `:focus-visible` en el control indicado.
- Para estados con scroll, capturar viewport (no full page) y, además, full page como complemento.
- Registrar `console` errors, `pageerror`, `scrollWidth`, `clientWidth`, bounding boxes de total/método/CTA/composer y resultado de axe en un JSON por captura.

### 7.3 Evidencia mínima por estado

Cada captura se acompaña de un JSON con:

```json
{
  "url": "/caja",
  "state": "c05-cambio",
  "viewport": { "width": 390, "height": 844 },
  "buildSha": "…",
  "demoMode": false,
  "metrics": {
    "scrollWidth": 390,
    "clientWidth": 390,
    "total": { "top": 152, "bottom": 208 },
    "methods": { "top": 224, "bottom": 280 },
    "confirm": { "top": 300, "bottom": 352 },
    "composer": { "top": 368, "bottom": 420 }
  },
  "axe": { "violations": 0, "serious": 0, "critical": 0 },
  "consoleErrors": []
}
```

No se declara “pasa” una captura sin estos datos; una imagen sin medición no es evidencia de primer viewport.

---

## 8 · Plan de Oleada B

### B0 · Prerrequisitos de fundación (sin cambio visual de producto)

**Objetivo:** que `/caja` y `/ventas` puedan usar el shell sin importar `inicio.css` y sin una segunda paleta.

1. **Extraer CSS de shell** de `inicio.css` a `components/shell/shell.css`:
   - `.inicio-shell`, `.inicio-main`, `.inicio-content` → clases base del shell (mantener alias `.inicio-*` para no romper Inicio).
   - `.inicio-sidebar*`, `.inicio-brand*`, `.inicio-nav*`, `.inicio-topbar*`, `.inicio-demo`, `.inicio-avatar`, `.inicio-skip`.
   - Reglas de foco y alto contraste del shell.
   - **Criterio:** `/inicio` conserva geometría y apariencia (captura diff); `/caja` puede montar `AppShell` sin importar `inicio.css`.
2. **Medir chrome del shell:** `ChromeMetrics` o variables `--mc-chrome-top/bottom` reales; usarlas para `scroll-padding`, sticky rail y `scroll-margin` de la barra fija. Si no se implementa, usar offsets documentados y no `var(--mc-chrome-top)` (hoy vale 0).
3. **Rutas:** reemplazar `app/ventas/route.ts` por `app/ventas/page.tsx`; crear `app/caja/page.tsx`; retirar el 404 de `/caja`. Mantener `/fiados`, `/corte`, `/metas`, `/pendientes` como alias 307 a `/?tab=`.
4. **PageHeader compacto:** modificador `mc-page-header--compact` (título 1.75–2.25rem, subtítulo 0.9375rem) sin cambiar Inicio.
5. **Primitivas compartidas:** extraer `Sheet`, `StatusBadge`/`PaymentStatus` y `paymentTruth` sin cambiar su lógica; tests de los 8 estados.
6. **Tokens de espacio/radio/foco/movimiento:** formalizar en `globals.css` los valores de §2.5; no cambiar hex.
7. **Decisión de `barrio.css`:** dejarlo global en B y usar namespace; o mover su import a la ruta legacy `/` en un commit separado con capturas de `/inicio` y `/pay`. No hacerlo junto con B1.

**Salida de B0:** shell portable, rutas listas, primitivas compartidas, sin cambios de dinero.

### B1 · `/caja` (2–3 días)

1. Montar `AppShell` + `PageHeader` + `mc-caja`.
2. Adaptar la lógica existente de `CajaApp` (draft, voz, texto, ticket, createOrder, payment, demo) sin reescribirla; modo `embedded` o adaptador que no renderice el shell legacy.
3. Implementar composer, ticket, total, métodos, efectivo/cambio, fiado, digital, CTA y resultado.
4. Implementar los 14 estados de §4.
5. Responsive: dos columnas ≥880 de contenedor; una columna debajo; barra fija ≤760.
6. Pruebas: unitarias de mapeo de intención → payload; E2E de los 7 caminos de §3.7; doble submit; error de red; restauración de borrador; fiado sin nombre; sobrepago.

**Gate:** `p0-venta` 66/0 (actualizado al nuevo DOM, conservando intención), checkout 19/19, sin doble cobro, sin cambios en `orders.ts`/webhook.

### B2 · `/ventas` (1–2 días)

1. Página server con `listOrders`/`countOrders` o `/api/orders`; sin endpoint nuevo.
2. Resumen de hoy desde `DailySummary`; lista agrupada por día; fila/card.
3. Filtros periodo/estado con URL; “Cargar más”.
4. Detalle en hoja; acciones de cobro reutilizando el flujo existente.
5. Estados vacío/error/loading/demo; no mezclar demo/real.
6. Pruebas: 4 filtros, paginación, fila sin conceptos, venta demo, venta fiado, venta pendiente, error de red, foco del detalle.

### B3 · Evidencia y cierre (1 día)

1. Matriz de capturas §7.2 completa.
2. axe normal/HC; teclado; 200 %; 320; contraste manual.
3. `rg` de tokens/clases prohibidas.
4. Actualizar `p0-venta`, `p0-shell` y `mobile-320` si cambian selectores; no debilitar aserciones.
5. `verify:fast`, `verify:static`; `verify:full --skip=tunnel,preflight` cuando el entorno lo permita.
6. Veredicto independiente; no declarar migrada una pantalla que siga enviando a legacy.

---

## 9 · Riesgos concretos

| ID | Severidad | Riesgo | Evidencia | Mitigación / gate |
|---|---|---|---|---|
| R1 | **Alta** | Dos pantallas de venta: `/` legacy y `/caja` nueva. | `app/page.tsx` sigue renderizando `CajaApp`; `/caja` no existe. | No enlazar `/caja` como primaria hasta tener paridad; decidir si `/` redirige a `/caja` al cerrar B; probar ambos caminos. |
| R2 | **Alta** | `AppShell` no es portable: depende de `inicio.css`. | `app-shell.tsx` usa `.inicio-*`; `shell.css` no estiliza sidebar/topbar/skip. | B0: extracción mecánica; si no se aprueba, importar `inicio.css` como puente documentado y no copiar su paleta. |
| R3 | **Alta** | Conflicto de rutas: `app/ventas/route.ts` y `app/ventas/page.tsx` no pueden coexistir. | `app/ventas/route.ts:1-6` es 307 a `/?tab=caja`. | Reemplazar el route handler por page en B0; actualizar pruebas de alias; no dejar dos handlers. |
| R4 | **Alta** | `caja-app.tsx` es un monolito de 8 228 líneas; B puede colisionar con otros carriles. | Shell, venta, cobro, fiado, corte y ayuda en un archivo. | Congelar el archivo; adaptador/`embedded` mínimo; no reescribir lógica; integración secuencial. |
| R5 | **Alta** | Semántica de método vs payload: la UI puede crear un remanente digital no elegido. | El motor deriva `digitalDue = total - cash - credit` (`orders.ts:328`). | Mapa §3.7; bloquear CTA si falta cubrir y no hay complemento; tests de los 7 caminos. |
| R6 | **Alta** | Primer viewport no se cumple por el chrome del shell. | Topbar 100 px desktop; header actual hasta 52 px; shell móvil puede mostrar sidebar como bloque. | Header compacto, sin KPIs, sin hero; medir `data-mc`; si el shell no cabe, corregir shell, no reducir tipografía. |
| R7 | **Alta** | Fiado sin nombre o sobrepago crea deuda incorrecta o se pierde. | `createOrder` exige nombre y bloquea sobrepago (`caja-app.tsx:1893-1907`). | Mantener validación; foco al campo; no limpiar; tests. |
| R8 | **Alta** | Demo/real y efectivo/verificado se confunden visualmente. | `.state-demo` y `.state-partial` casi idénticos; efectivo puede verse verde. | Tabla §2.3; verde solo pey; demo maíz + Flask; capturas HC y prueba con daltonismo. |
| R9 | **Media/Alta** | Pendiente digital se presenta como pagado al cerrar la hoja. | `confirmed` con deuda digital no es `paid`; la hoja puede cerrarse. | Resultado “Por cobrar” persistente; “No entregues”; el estado se lee del servidor, no del cliente. |
| R10 | **Media** | El historial filtra solo la página cargada y miente con “Todo”. | `/api/orders` no tiene filtros de fecha/estado (`api/orders/route.ts:50-70`). | “Cargar más”; etiquetar “en esta vista”; no mostrar totales globales; filtros de servidor en C. |
| R11 | **Media** | Demo y real se mezclan en el historial. | `/api/orders` en demo devuelve todo; en real filtra demo (`db.ts:1409-1423`). | Banner demo; sello por fila; no sumar demo a totales reales; prueba con ambas bases. |
| R12 | **Media** | `Sheet` y `StatusBadge` no son compartidos; se duplican. | Viven dentro de `caja-app.tsx`; `pending-payments.tsx` tiene otro mapeo. | Extraer en B0/B1; una sola tabla de estados; tests. |
| R13 | **Media** | Ayuda/Ajustes del sidebar salen de `/caja` a `/?ayuda=1` legacy. | `nav.ts:50-61`; `Sidebar` footer. | Hoja de ayuda de shell en B0 o documentar la salida; no crear rutas falsas. |
| R14 | **Media** | Targets pequeños o foco recortado en filas y barra fija. | Caja legacy tiene targets 28×28 y foco móvil sin outline. | 48 px; `scroll-margin`; probar teclado en 320/200 %; no `overflow:hidden` en ancestros del sticky. |
| R15 | **Media** | Texto al 200 % rompe el primer viewport o el total. | 320 xlarge ya es el peor caso; `AnimatedAmount` inserta `<wbr>`. | No animar total; compactar espacio, no fuente; probar `$1,000,000.00`; `nowrap`. |
| R16 | **Media** | Contratos de test desactualizados dan falso verde/rojo. | `p0-venta` y `p0-shell` esperan labels/selectores legacy. | Actualizar pruebas en el mismo PR; conservar intención; no borrar aserciones. |
| R17 | **Baja** | Assets raster con fondo crema o color fijo. | `assets/brand/README.md`: PNG sin alfa en el set original; iconos raster. | SVG masks para UI; PNG solo decorativo sobre crema; QR real, no ilustración. |
| R18 | **Baja** | `barrio.css` global pisa clases nuevas por especificidad. | Se importa en `layout.tsx:4`; reglas sin capa. | Namespace `mc-*`; no reutilizar `.state-*`/`.caja-*`; prueba de cascada. |

---

## 10 · Decisiones abiertas

1. **`/` durante B:** ¿sigue sirviendo `CajaApp` legacy o redirige a `/caja` al cerrar B? Recomendación: no enlazar `/caja` como primaria hasta que `p0-venta` y checkout estén verdes; al cerrar B, 307 de `/` a `/caja` y de `?tab=caja` a `/caja`, conservando `ayuda=1`.
2. **Nombres:** “Caja” = cobrar; “Ventas” = historial. Aprobarlo explícitamente para que la nav no vuelva a mentir.
3. **Mixto:** B crea efectivo+link y efectivo+fiado; **no** crea digital+fiado. Si producto quiere digital+fiado, es una decisión de alcance con pruebas de dinero.
4. **Ayuda/Ajustes:** hoja de shell vs salida a legacy. Si se queda legacy, documentar que `/caja` pierde contexto.
5. **`barrio.css`:** dejarlo global en B con namespace o scopearlo a `/` en un commit separado. No mezclar con B1.
6. **Monto máximo en total:** el motor acepta hasta `$1,000,000.00`; el diseño debe probar ese ancho a 320. Si no cabe, se reduce el clamp, no se recorta.

---

## 11 · Límites de este documento

- No se ejecutó el servidor ni un navegador: no hay capturas producidas ni comparación renderizada. Las métricas de primer viewport son objetivos de maqueta, no evidencia.
- No se tocó código, datos, configuración ni se hizo commit.
- Los contrastes se calcularon sobre valores declarados en `globals.css`; el contraste final depende del render, las fuentes y el modo de alto contraste.
- No se validó con lector de pantalla real, iOS/Safari, teclado virtual, HCM real ni PWA instalada. WCAG **no certificada**.
- No se modificó ningún contrato financiero. La implementación de B debe conservar `orders.ts`, `cash.ts`, `db.ts`, `payment-labels.ts`, webhook y `/pay/**`.

---

**Resumen para el orquestador:** B no es un rediseño del motor; es una capa de presentación sobre el motor existente. Primero hay que hacer portable el shell y resolver la semántica de método; después se monta la calculadora de Caja y el libro de Ventas. Si se intenta saltar B0, el resultado será una cuarta paleta y un shell roto. Si se intenta saltar el mapa de método, el resultado será una venta con deuda digital que nadie eligió.
