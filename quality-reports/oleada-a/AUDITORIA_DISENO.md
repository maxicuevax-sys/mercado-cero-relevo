# Auditoría de diseño — Oleada A

> **Rol:** `mc-sistema-diseno` · **Modo:** solo lectura (no se editó código ni se hicieron commits).
> **Repo:** `mercado-cero` · **Rama:** `design/oleada-a-fundacion` · **HEAD:** `62c3fed` · **Árbol:** limpio.
> **Fecha:** 3 de noviembre de 2026.
> **Alcance:** `web/src/app/globals.css`, `web/src/app/barrio.css`, `web/src/app/inicio/inicio.css`, `web/src/app/layout.tsx`, `web/src/components/*`, fuentes en `.font-staging/` y documentos de dirección (`HIG-DESIGN.md`, `GOAL-HIG.md`, `DESIGN-BARRIO.md`).
> **Método:** lectura estática, conteo de declaraciones, análisis de cascada y cálculo de contraste WCAG 2.2 sobre los valores declarados. No se ejecutó comparación renderizada: no hay navegador conectado a esta sesión. La validación visual final necesita el gate del §7.

---

## 0 · Veredicto ejecutivo

La fundación es viable, pero hoy **no existe un sistema de diseño: existen tres capas que se ignoran entre sí y una cuarta superficie de recibo**.

1. **`globals.css`** define 25 tokens de color (15 semánticos + 10 de compatibilidad: `--color-green`, `--color-terracotta`, etc.). Es la única fuente con valores “de sistema”.
2. **`barrio.css`** vuelve a declarar colores, radios, sombras y tipografía con 66 hex y 27 `rgb/rgba`; además contiene **dos capas visuales superpuestas** (“Amable y de barrio” y “Mercado 2026”), con **34 selectores base que se pisan a sí mismos**.
3. **`inicio.css`** define 11 tokens `--inicio-*` con valores distintos a los de `globals.css` y repite ~101 hex, 60 tamaños de letra y 23 radios. Es una cuarta paleta de facto.
4. **`checkout.css`** añade una quinta superficie con `#efe3d1`, `#f4ead8`, `#fffaf0`, `#fff8ea`, `#07382d` y tres variables **no definidas**: `--mesh-paper`, `--paper-fiber`, `--mesh-sheet`.

La dirección visual de Inicio sí está clara y aprobada: **crema, verde profundo, terracota, maíz, serif editorial y tarjetas cálidas**. La fundación no debe reinterpretarla: debe **nombrarla, congelarla y hacer que Caja la comparta sin perder su lenguaje de mostrador**.

**Recomendación:** A1 congela los valores actuales (salvo la corrección de contraste de §6.2) y sustituye Fraunces/Inter por Hearth/Alder con alias de compatibilidad. A3 extrae primitivas presentacionales y converge la paleta con aprobación visual. **No se crea un segundo dashboard ni una tercera shell.**

### Hallazgos priorizados

| Prioridad | Hallazgo | Evidencia | Sección |
|---|---|---|---|
| **P0** | No hay una fuente única de tokens: `globals`, `barrio`, `inicio` y `checkout` declaran valores en paralelo. | 25 tokens globales, 11 `--inicio-*`, 66 + 101 hex | §1, §2 |
| **P0** | `barrio.css` contiene dos capas visuales superpuestas. | 34 selectores base con propiedades en conflicto; 86 selectores repetidos | §1.10 |
| **P0** | Hearth/Alder no están integradas; el layout sigue cargando Fraunces/Inter. | `layout.tsx:2,10-25`; `.font-staging/` excluido | §3.5 |
| **P1** | `accent` y `green` son el mismo hex y se usan como categorías distintas en el gráfico de pagos. | `caja-app.tsx:4675` vs `4682` | §1.2 |
| **P1** | 53 tamaños de letra y 18 radios sin escala. | 90 + 60 declaraciones de `font-size`; 41 + 23 `border-radius` | §1.3, §1.5 |
| **P1** | Inicio define una paleta completa distinta a la de Caja. | `inicio.css:5-15` | §1.2 |
| **P1** | `#5c7264` sobre `#ddeddf` falla AA (4.26:1). | `barrio.css:1703` | §6.2 |
| **P1** | Estados y componentes duplicados: `StatusBadge`, `STATUS`, `statusLabel`, KPIs, empty states, progress. | `caja-app.tsx:7236`, `pending-payments.tsx:21-40`, `inicio/page.tsx:249-292` | §1.7, §4 |
| **P1** | `Sheet` depende de `.app-shell` para `inert`; no es portable a Inicio. | `caja-app.tsx:7623` | §4.1 |
| **P2** | `checkout.css` referencia tres variables inexistentes y una cuarta paleta. | `checkout.css:57,67,162` | §1.2, §6.4 |
| **P2** | La documentación HIG contradice los valores del código. | `HIG-DESIGN.md:129-143` vs `globals.css:5-21` | §1.11 |

---

## 1 · Inventario de tokens actuales

### 1.1 Cascada real y carga de CSS

| Archivo | Se importa en | Bytes | gzip | Alcance real |
|---|---|---:|---:|---|
| `web/src/app/globals.css` | `layout.tsx:3` | 21 290 | 6 322 | Todas las rutas |
| `web/src/app/barrio.css` | `layout.tsx:4` | 46 926 | 8 070 | Todas las rutas, aunque solo Caja usa sus clases |
| `web/src/app/inicio/inicio.css` | `inicio/page.tsx:33` | 28 431 | 4 991 | Solo `/inicio` |
| `web/src/app/checkout.css` | `pay/[id]/page.tsx:5` y success/not-found | 15 435 | 3 409 | Solo `/pay/**` |

Consecuencia: `/inicio` carga `globals + barrio + inicio` ≈ **19.4 KiB gzip** y `/pay/**` carga `globals + barrio + checkout` ≈ **17.8 KiB gzip**. `/inicio` no usa ni una clase de `barrio.css`; `/pay/**` solo comparte nombres sueltos de sello/estado y tampoco necesita el archivo completo. El presupuesto de HIG §18 (“mostrador bajo 16 KiB gzip”) se cumple en Caja (14.4 KiB) pero no en las otras rutas.

**Cascada:** `globals` → `barrio` → CSS de ruta. Las reglas de `barrio.css` e `inicio.css` son CSS sin capa (`unlayered`), así que **ganan a las utilidades de Tailwind aunque se declaren antes**. Ejemplo concreto: `ScreenHeading` aplica `text-[1.75rem]` (`screen-heading.tsx:29`), pero `.screen-heading__title` (`barrio.css:261`) lo sobrescribe con `clamp(1.9rem, 1.4rem + 1.5vw, 2.7rem)`. Cualquier intento de tokenizar tipografía debe respetar ese orden o las utilidades dejarán de funcionar.

### 1.2 Color

#### Núcleo semántico (`globals.css:5-21`)

| Token | Valor | Uso | Nota |
|---|---|---|---|
| `--color-canvas` | `#f9f6ee` | Fondo de app | Caja y checkout |
| `--color-surface` | `#fffdf7` | Tarjetas, hojas | |
| `--color-surface-2` | `#f2ebdf` | Campos agrupados, filas | |
| `--color-ink` | `#1f2622` | Texto principal | 14.31:1 en canvas |
| `--color-ink-2` | `#515b54` | Texto secundario | 6.54:1 en canvas |
| `--color-placeholder` | `#6b6256` | Placeholder | 5.05:1 en surface-2 |
| `--color-control-border` | `#687369` | Bordes de control | 4.86:1 en surface (≥3:1) |
| `--color-separator` | `#e0d6c7` | Hairlines | 1.4:1: solo decorativo |
| `--color-accent` | `#0f3d36` | Acción primaria, marca | 11.17:1 en canvas |
| `--color-accent-press` | `#0a332c` | Pressed | |
| `--color-success` | `#0a5039` | Pago verificado por pey | No usar en demo/fiado/pendiente |
| `--color-attention` | `#8f2d1c` | Fiado, pendiente, demo | 8.06:1 en surface |
| `--color-danger` | `#8a281b` | Error/destructivo | 8.60:1 en surface |
| `--color-info` | `#293b68` | Información neutra | |
| `--color-focus` | `#0e6f5a` | Anillo de foco | 5.65:1 en canvas |

#### Capa de compatibilidad (`globals.css:24-33`)

| Token | Valor | Relación |
|---|---|---|
| `--color-line` | `#e0d6c7` | **Duplicado exacto** de `separator` |
| `--color-green` | `#0f3d36` | **Duplicado exacto** de `accent` |
| `--color-green-deep` | `#0a332c` | **Duplicado exacto** de `accent-press` |
| `--color-green-soft` | `#e2f3e7` | Tono de éxito suave |
| `--color-terracotta` | `#c1492e` | Tono cálido distinto de `attention` |
| `--color-terracotta-deep` | `#8f2d1c` | **Duplicado exacto** de `attention` |
| `--color-terracotta-soft` | `#fbe9e6` | Fondo de fiado/error |
| `--color-saffron` | `#f2c768` | Maíz de marca |
| `--color-saffron-soft` | `#fff0d2` | Fondo de pendiente |
| `--color-blue-soft` | `#e9ecf3` | Fondo informativo |

**Colisión semántica real:** `caja-app.tsx:4675` pinta el segmento “Efectivo” con `bg-accent` y `caja-app.tsx:4682` pinta “Digital verificado por pey” con `bg-green`. Ambos valen `#0f3d36`: **el gráfico de “Cómo te pagaron” muestra dos categorías del mismo color**. No es un detalle estético; rompe la lectura de la verdad del dinero.

Otras colisiones:
- `--color-success` (`#0a5039`) y `--color-green` (`#0f3d36`) son verdes distintos con nombres que invitan a confundirlos. El primero está reservado a pago verificado; el segundo es marca/acción.
- `--color-attention` y `--color-terracotta-deep` son el mismo valor con dos nombres.
- `--color-terracotta` (`#c1492e`) no es `attention`; se usa como acento cálido (por ejemplo `globals.css:867` en `scroll-progress`). Si se aliasa a `attention`, cambia el tono.

#### Paleta paralela de Inicio (`inicio.css:5-15`)

| Token Inicio | Valor | Equivalente global | Diferencia |
|---|---|---|---|
| `--inicio-paper` | `#fbf3e7` | `--color-canvas` `#f9f6ee` | Más cálido/rosado |
| `--inicio-surface` | `#fdf3e4` | `--color-surface` `#fffdf7` | Más melocotón |
| `--inicio-green` | `#004b3c` | `--color-green` `#0f3d36` | Más esmeralda/saturado |
| `--inicio-green-deep` | `#003f31` | `--color-green-deep` `#0a332c` | Más oscuro |
| `--inicio-ink` | `#1d241f` | `--color-ink` `#1f2622` | Casi idéntico |
| `--inicio-ink-2` | `#4d5851` | `--color-ink-2` `#515b54` | Casi idéntico |
| `--inicio-clay` | `#b33d24` | `--color-terracotta` `#c1492e` | Más oscuro |
| `--inicio-maize` | `#f2c768` | `--color-saffron` `#f2c768` | Idéntico |
| `--inicio-border` | `#e5d6c3` | `--color-separator` `#e0d6c7` | Casi idéntico |
| `--inicio-border-soft` | `#ede1d1` | — | Nuevo |
| `--inicio-focus` | `#004b3c` | `--color-focus` `#0e6f5a` | Distinto |

Inicio no consume ningún token de color global: su shell declara `font-family: var(--font-inter)` (`inicio.css:22`) y todos sus colores salen de `--inicio-*` o de literales. Es un tema completo, no una variante.

#### Cuarta superficie: checkout

`checkout.css` mezcla tokens globales (`--color-accent`, `--color-ink-2`) con literales propios (`#efe3d1` línea 56, `#f4ead8` 127, `#fffaf0` 153/176/408/431, `#fff8ea` 356/409/468/630, `#07382d` 465/627) y referencia `--mesh-paper`, `--paper-fiber`, `--mesh-sheet` que **no están definidas en ningún archivo del repo**. El navegador descarta esos `background-image`; el recibo pierde el mesh y la fibra que HIG §18 describe. Es deuda adyacente, pero cualquier cambio de tokens globales la afecta.

### 1.3 Tipografía

| Aspecto | Estado actual |
|---|---|
| Familias | `Inter` (UI/cuerpo) + `Fraunces` (display), cargadas con `next/font/google` en `layout.tsx:2,10-25`. |
| Variables | `--font-inter`, `--font-fraunces`; `--font-sans` y `--font-display` en `globals.css:35-37`. |
| Tamaños | **53 valores distintos** entre los tres archivos: 16 declaraciones en `globals`, 90 en `barrio`, 60 en `inicio`. |
| Pesos | 400, 500, 600, 700, 800. `800` aparece en `.inicio-demo` (`inicio.css:279`) y en el check de la tarea (`657`); no hay 900. |
| Line-height | 1.02, 1.04, 1.05, 1.08, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5 + valores fijos en `rem`/`px`. |
| Tracking | `-0.035em`, `-0.03em`, `-0.025em`, `-0.02em`, `-0.015em`, `-0.01em`, `0`, `0.005em`, `0.02em`, `0.04em`, `0.12em`. |
| Features | `body { font-feature-settings: "ss01" on, "cv11" on; }` (`globals.css:111`). Son features de Inter; Hearth/Alder no las declaran. |
| Cifras | `.tabular` (`globals.css:351`), `.ledger td/tfoot`, `.home-kpi__value`, `.inicio-kpi__value`, `.screen-heading__subtitle`, etc. `font-variant-numeric: tabular-nums`. |
| Referencias directas a Fraunces | `inicio.css:97, 240, 318, 375, 526, 596, 741`; `barrio.css` usa `var(--font-display)` en 15 lugares. |
| Referencias directas a Inter | `inicio.css:22`; `globals.css:35`. |

**Problema de escala:** no hay una escala; hay 53 decisiones locales. Los tamaños más frecuentes en `barrio.css` son `0.75rem` (25 veces), `0.8125rem` (16), `1rem` (7), `0.875rem` (7). En `inicio.css` conviven `1.1875rem`, `1.0625rem`, `1.375rem`, `1.5625rem`, `1.625rem`, `1.875rem`, `2.125rem`, `2.375rem` y cinco `clamp()` distintos. El resultado se ve coherente por repetición manual, no por sistema.

**Conflicto de rol ya instalado:** `.calc-display__total` (`barrio.css:1707`), `.checkout-key__total` (`1833`), `.draft-item__num` (`543`) y `.ledger tfoot td` usan o heredan display/serif para cifras. HIG §4.2 dice “No usar Fraunces para cifras” y SOURCE.md reserva Hearth para marca/editorial y Alder para importes. Es deuda que A3 debe corregir, no A1 (ver §5.3).

### 1.4 Espaciado

No existe ningún token de espacio. Los valores salen de 32 medidas distintas; las más usadas:

`8px` (55), `12px` (42), `10px` (29), `6px` (28), `4px` (27), `2px` (24), `14px` (23), `18px` (18), `7px` (16), `16px` (12), `20px` (11), `5px` (10), `9px` (9), `24px` (7), `22px` (5), `36px` (4).

HIG §4.3 propone base 4 pt (`4 8 12 16 20 24 32 40 48`), pero el código usa 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 18, 22, 26, 28, 30, 34, 36. No hay `--space-*` ni `--tap`.

### 1.5 Radios

**18 valores distintos** entre los tres archivos: `0, 3px, 4px, 6px, 8px, 9px, 10px, 12px, 14px, 16px, 18px, 20px, 22px, 26px, 50%, 999px, 9999px, inherit`.

- Caja: tarjetas `18px`, campos `14px`, teclas `10px`, hoja `20px`, píldoras `999px`.
- Inicio: KPI `22px`, hero `26px`, pendientes/sugerencia `22px`, móvil `16/18/20px`, CTA `12px`/`999px`, iconos `14px`.
- No hay `--radius-*`; HIG §4.3 propone `8/12/16/20` pero no se implementó.

### 1.6 Sombras

**13 sombras distintas.** `globals.css` define `--shadow-card` y `--shadow-lift` (`45-48`), pero `barrio.css` declara 19 `box-shadow` con valores propios y `inicio.css` repite `0 2px 8px rgb(31 38 34 / .04/.045)` tres veces (`415, 572, 714`).

Ejemplos:
- `barrio.css:202` `0 2px 8px rgb(0 0 0 / .12)`.
- `barrio.css:229` `0 10px 24px -18px rgb(0 0 0 / .5)`.
- `barrio.css:1731` `0 10px 22px -14px rgb(15 61 54 / .75)`.
- `barrio.css:1849` `0 2px 0 rgb(10 51 44 / .22)`.
- `barrio.css:2070` `0 -10px 28px -22px rgb(31 38 34 / .5)`.
- Teclas: `--mc-key-shadow: none` y `--mc-key-shadow-press: none` (`barrio.css:11-12`), pero luego se usan sombras `inset` manuales en `.mic-button:active` (`402`) y en `html[data-text-zoom="large"] .mic-button` (`1339`).

### 1.7 Estados

`barrio.css:2251-2281` define seis estados:

| Clase | Fondo | Texto | Contraste | Uso |
|---|---|---|---:|---|
| `.state-pending` | `#fff0d2` | `#725012` | 6.49 | Pendiente, esperando confirmación |
| `.state-partial` | `#e9ecf3` | `#293b68` | 9.25 | Pago parcial |
| `.state-demo` | `#e9ecf3` | `#293b68` + borde `#687369` | 9.25 | Demo |
| `.state-verified` | `#e2f3e7` | `#0a5039` | 8.20 | Pagado/verificado |
| `.state-draft` | `#f2ebdf` | `#515b54` + borde `#d8cfc0` | 5.96 | Borrador, sin link |
| `.state-credit` | `#fbe9e6` | `#8f2d1c` | 6.99 | Fiado |

Observaciones:
- **`state-demo` y `state-partial` son casi idénticos**: mismo fondo y mismo texto; solo cambia un borde de 1 px. En una app donde “demo ≠ real” es una regla de negocio, el tratamiento visual no debería depender de un hairline. A3 debe dar a demo una textura/tono propio (maíz o trama diagonal) manteniendo texto + icono.
- No existe `state-danger` ni `state-info`; los errores se componen a mano con `border-danger`, `text-danger`, `bg-terracotta-soft`, y a veces con `text-attention`. Ejemplos: `caja-app.tsx:6462` (error con `text-attention`) frente a `caja-app.tsx:6253` (error con `text-danger`).
- El copy de estados vive en `lib/payment-labels.ts:27-56` (`PAYMENT_STATES`), correctamente separado. El problema es solo la presentación: `StatusBadge` (`caja-app.tsx:7236`), `STATUS` de `pending-payments.tsx:21-40` y `statusLabel` (`caja-app.tsx:7302`) duplican el mapeo estado→clase/icono.

### 1.8 Foco

| Contexto | Regla | Archivo |
|---|---|---|
| Global | `outline: 3px solid var(--color-focus); offset 2px; radius 6px` | `globals.css:193-197` |
| `main#main` | 3px, offset 4px | `globals.css:78-81` |
| Sobre accent | `outline-color: #fff` | `globals.css:199-201` |
| Sidebar/topbar Caja | `outline-color: #fffdf7` | `barrio.css:2184-2187` |
| Checkout method | 3px, offset 2px en `:focus-within` | `globals.css:259-262` |
| Inicio | 3px `--inicio-focus`, offset 2px | `inicio.css:779-782` |
| Inicio sidebar/hero | `outline-color: #fffdf7` | `inicio.css:784-787` |
| Alto contraste | `outline-color: #000` / `#fff` | `globals.css:189-191`, `inicio.css:1456-1468` |

No hay tokens de anillo (`--focus-width`, `--focus-offset`, `--focus-color-on-dark`). Los valores 3/2/4 se repiten en cinco lugares.

### 1.9 Duplicación y hardcodes

| Archivo | Hex | `rgb/rgba` | `font-size` | `border-radius` | `box-shadow` |
|---|---:|---:|---:|---:|---:|
| `globals.css` | 51 (23 son overrides de alto contraste) | 13 | 16 | 2 | 0 (define 2 tokens) |
| `barrio.css` | 66 | 27 | 90 | 41 | 19 |
| `inicio.css` | 101 (59 son `#000/#fff`, mayoría de alto contraste) | 8 | 60 | 23 | 4 |

**Duplicados exactos de token:** `line=separator`, `green=accent`, `green-deep=accent-press`, `terracotta-deep=attention`. Cuatro pares que deberían ser alias, no valores independientes.

**Hardcodes repetidos en `barrio.css`:**
- `#fffdf7` 19 veces (sidebar, topbar, botones, teclas).
- `#cfe3d4` 4 veces (texto secundario del sidebar/topbar).
- `#dce9df` 2 veces.
- `#4e6457` 2 veces y `#5c7264` 1 vez (metadatos del LCD).
- `#f4f8ef` 2 veces, `#fbfdf8` 1, `#fbfaf5` 1, `#b9cdbd` 1, `#9dbba7` 1.

**Hardcodes en TSX:** solo dos, pero significativos:
- `caja-app.tsx:3110` `text-[#725012]` para el icono de “Por cobrar”.
- `caja-app.tsx:7966` `border-[#d5e5d7] bg-[#f4f8ef]` en un bloque de ayuda/demo.

**Sombras recreadas:** Inicio no usa `--shadow-card`; repite `0 2px 8px rgb(31 38 34 / .04)` en `.inicio-kpi` (415), `.inicio-pending` (572) y `.inicio-suggestion` (714). Caja sí usa `--shadow-card`, pero también tiene 19 sombras locales.

**Variables no definidas en checkout:** `--mesh-paper`, `--paper-fiber`, `--mesh-sheet` (ver §1.2). No es un token mal nombrado: no existe en el repo.

### 1.10 La deuda estructural de `barrio.css`: dos capas en un archivo

`barrio.css` tiene 391 selectores, 274 únicos y **86 selectores repetidos**. El análisis de bloques base (excluyendo `@media`) encuentra **34 selectores con propiedades en conflicto**, es decir, declaraciones que la segunda capa pisa y que hoy son código muerto o, peor, intención perdida.

Los casos más claros:

| Selector | Primera declaración | Segunda declaración | Efecto |
|---|---|---|---|
| `.caja-panel` | `326`: `border:0; border-radius:0; box-shadow:none; background:transparent; padding:0` | `1659`: `border:1px solid separator; background:surface; padding:14px` | La primera capa es invisible; la tarjeta real es la segunda. |
| `.draft-item` | `531`: grid de 4 filas, sin tarjeta | `1876`: `border + radius 14 + background surface + padding 9` | Cambia el layout y el material. |
| `.qty-key` / `.qty-input` / `.price-input` | `586-630`: borde 1.5, radio 4, fondo translúcido | `1896-1902`: borde 1, radio 10, `surface-2` | Campos con dos lenguajes. |
| `.pay-line` | `687`: borde 1.5, radio 4, `rgba(255,250,240,.6)` | `1918`: borde 1, radio 14, `#fbfaf5` | Igual. |
| `.draft-add` | `642`: radio 3, `rgba(...)`, color ink-2, peso 700 | `1904`: radio 12, `#fbfdf8`, color green, peso 600 | Igual. |
| `.ledger th/td` | `852`: `--mc-ledger-step` + `--mc-rule` | `1944`: `34px` + `separator` | El token queda muerto. |
| `.pending-strip__row` | `1030`: `padding 7px 10px`, borde dashed | `1984`: `padding 9px 14px`, borde solid | Igual. |
| `.checkout-key__total` | `777`: `1.85rem`, ink | `1833`: `2rem`, green | Igual. |
| `.credit-list-card` | `1642`: `surface` | `1993`: gradiente `#f4f8ef → #fffdf7` | Igual. |

No todo es basura: hay 55 selectores con conflicto total, y muchos están dentro de `@media` (responsive intencional). Pero **34 conflictos en la capa base** son deuda real. La segunda capa “Mercado 2026” se añadió al final sin retirar la primera; hoy nadie sabe cuál es la fuente de verdad.

### 1.11 Documentación desalineada

`HIG-DESIGN.md` §4.1 declara una paleta que **no coincide con el código**:

| Token | HIG | Código actual |
|---|---|---|
| `--color-canvas` | `#F3ECE0` | `#f9f6ee` |
| `--color-accent` | `#0A5B42` | `#0f3d36` |
| `--color-attention` | `#9C4E2B` | `#8f2d1c` |
| `--color-danger` | `#A9241C` | `#8a281b` |
| `--color-info` | `#2F5D8A` | `#293b68` |
| UI | Manrope | Inter |

Además, HIG §4.3 dice “sin sombra en tarjetas normales”, mientras la capa 2026 usa `--shadow-card` y sombras cálidas en todas las tarjetas. No se puede mantener una “fuente de verdad” documental que contradice el CSS. A1 debe corregir la doc o marcarla como histórica.

---

## 2 · Arquitectura única de tokens

### 2.1 Principios

1. **Un solo archivo declara valores.** `globals.css` es la fuente de verdad. `barrio.css`, `inicio.css` y `checkout.css` solo consumen `var(--token)` y declaran layout/estructura.
2. **Dos roles, no dos sistemas.** `--mc-brand-*` es identidad (Inicio aprobado); `--color-*` es operación (Caja). Un valor puede aparecer en ambos roles solo como alias, nunca como literal repetido.
3. **A1 congela la apariencia.** Ningún valor cambia de hex en A1, salvo la corrección de contraste `#5c7264 → #4e6457` de §6.2; solo cambia el nombre y el lugar donde vive.
4. **La compatibilidad es explícita y temporal.** Las variables viejas (`--color-green`, `--font-fraunces`, `--inicio-*`, `--mc-rule`, etc.) se mantienen como alias marcados `@deprecated`.
5. **Las primitivas son presentacionales.** Ningún componente de `components/ui/*` importa datos, rutas o `getDashboardData`. Eso evita el “segundo dashboard”.

### 2.2 Capas y fuente de verdad

| Capa | Archivo | Contenido permitido |
|---|---|---|
| 1. Tokens de sistema | `web/src/app/globals.css` | Hex, familias, tamaños, espacios, radios, sombras, foco, movimiento. |
| 2. Base/reset | `web/src/app/globals.css` | `body`, tipografía base, foco global, alto contraste, reduced motion. |
| 3. Shell de Caja | `web/src/app/barrio.css` | Selectores de Caja y layout; solo `var()`. |
| 4. Shell de Inicio | `web/src/app/inicio/inicio.css` | Selectores de Inicio y layout; solo `var()`. |
| 5. Recibo público | `web/src/app/checkout.css` | Máscaras/perforaciones propias; colores por token. |
| 6. Primitivas | `web/src/components/ui/*` | DOM + clases; sin valores crudos. |

**Regla de oro:** si un selector de `barrio.css` o `inicio.css` necesita un color nuevo, se añade el token en `globals.css`; no se escribe el hex en la hoja de ruta. La única excepción son las máscaras y gradientes decorativos de `checkout.css`, que deben declarar sus paradas con tokens.

**Mecánica de Tailwind v4:** mantener `@theme` para los tokens que deben generar utilidades (`bg-surface`, `text-ink`, `font-display`, `text-sm`). Los tokens de espacio, radio, sombra, foco y movimiento pueden vivir en `:root` porque no necesitan una utilidad propia; si se ponen en `@theme`, Tailwind generará clases que nadie usa y aumentará el CSS.

**Cuidado con los alias de color:** `bg-green`, `text-green`, `bg-green-soft`, `bg-terracotta-soft`, `bg-line`, `bg-saffron-soft` se usan decenas de veces. Si `--color-green` se mueve de `@theme` a `:root`, Tailwind deja de generar `bg-green` y la app pierde estilos. Por eso, en A1 los alias de color que aún generan utilidades **se quedan en `@theme`** apuntando al token nuevo (`--color-green: var(--color-accent)`), y solo se retiran cuando `rg` demuestre que no queda ninguna clase `bg-green`/`text-green`. Los alias que no generan utilidades (fuentes, espacio, radio) van en `:root`. El alto contraste debe sobrescribir los mismos nombres en `html[data-contrast="high"]`, no crear una segunda familia de tokens.

### 2.3 Nombres propuestos

```css
/* Identidad (Inicio aprobado) */
--mc-brand-paper
--mc-brand-surface
--mc-brand-green
--mc-brand-green-deep
--mc-brand-ink
--mc-brand-ink-2
--mc-brand-clay
--mc-brand-maize
--mc-brand-border
--mc-brand-border-soft

/* Operación (Caja) */
--color-canvas / surface / surface-2 / ink / ink-2
--color-placeholder / control-border / separator
--color-accent / accent-press / on-accent
--color-success / attention / danger / info
--color-focus / focus-on-dark
--color-disabled
--color-rule / color-margin

/* Tipografía */
--mc-font-brand / --mc-font-ui / --mc-font-numeric
--mc-text-display-xl / display-lg / display / display-sm
--mc-text-title-1 / title-2 / title-3
--mc-text-headline / body / callout / subhead / footnote / caption / micro

/* Espacio, radio, sombra, foco, movimiento */
--mc-space-1..16
--mc-radius-control / field / card / panel / hero / sheet / pill
--mc-shadow-card / panel / sheet / key / key-press
--mc-focus-width / offset / radius
--mc-motion-fast / base / slow
```

No se propone una capa de “primitivos crudos” separada (`--mc-paper-100`, etc.) para A1: añade indirección sin beneficio inmediato y obliga a tocar dos niveles en cada ajuste. Los valores semánticos son la fuente; si A3 converge la paleta, se cambia el valor semántico una vez.

### 2.4 Compatibilidad y deprecación

| Actual | Nuevo | A1 |
|---|---|---|
| `--color-line` | `--color-separator` | alias |
| `--color-green` | `--color-accent` | alias |
| `--color-green-deep` | `--color-accent-press` | alias |
| `--color-terracotta-deep` | `--color-attention` | alias |
| `--color-terracotta` | `--mc-warm-500` (nuevo) | conservar valor `#c1492e`; no aliasar a attention |
| `--color-saffron` | `--mc-brand-maize` | alias (mismo valor) |
| `--color-saffron-soft` | `--color-maize-soft` | alias (mismo valor) |
| `--color-blue-soft` | `--color-info-soft` | alias (mismo valor) |
| `--inicio-paper` | `--mc-brand-paper` | alias |
| `--inicio-surface` | `--mc-brand-surface` | alias |
| `--inicio-green` | `--mc-brand-green` | alias |
| `--inicio-green-deep` | `--mc-brand-green-deep` | alias |
| `--inicio-ink` | `--mc-brand-ink` | alias |
| `--inicio-ink-2` | `--mc-brand-ink-2` | alias |
| `--inicio-clay` | `--mc-brand-clay` | alias |
| `--inicio-maize` | `--mc-brand-maize` | alias |
| `--inicio-border` | `--mc-brand-border` | alias |
| `--inicio-border-soft` | `--mc-brand-border-soft` | alias |
| `--inicio-focus` | `--mc-brand-green` | alias exacto en A1; A3 decide si el foco global pasa a `--color-focus` |
| `--font-inter` | `--font-alder` | alias |
| `--font-fraunces` | `--font-hearth` | alias |
| `--mc-rule` | `--color-rule` | alias (mismo rgba) |
| `--mc-margin` | `--color-margin` | alias (mismo rgba) |
| `--mc-ledger-step` | `--mc-space-ledger` | alias (34px) |
| `--mc-key-shadow` | `--mc-shadow-key` | alias (`none`) |
| `--mc-key-shadow-press` | `--mc-shadow-key-press` | alias (`none`) |

**Salida de deprecación:** un alias se elimina cuando `rg` no encuentre su nombre en `web/src` y las capturas A3 estén firmadas. No se eliminan en A1.

### 2.5 Recomendación de paleta: qué se conserva y qué se converge

No se debe “unificar por unificar” en A1. La decisión de valor es visual y necesita aprobación. La propuesta es:

- **Identidad:** se conserva la paleta de Inicio (`#fbf3e7`, `#004b3c`, `#b33d24`, `#f2c768`) porque es la dirección aprobada y la que sostiene las ilustraciones y el wordmark.
- **Operación:** Caja conserva sus neutros (`#f9f6ee`, `#fffdf7`, `#1f2622`, `#515b54`, `#687369`) porque están medidos para turnos largos y contraste.
- **Convergencia A3:** los roles de acción de Caja (`accent`/`attention`) se acercan a la marca **solo si la comparación visual lo aprueba**. La matriz de contraste favorece el clay de Inicio: `#fffdf7` sobre `#b33d24` = **5.72:1**, frente a **4.85:1** sobre `#c1492e`. El verde de Inicio (`#004b3c`) también da mejor margen que el de Caja (`#0f3d36`) sobre fondos claros.
- **Lo que no se hace:** dejar que `--color-green` y `--color-accent` sigan siendo dos nombres para el mismo hex y se usen como categorías distintas. En A1 se aliasan; en A3 se elige uno.

**Si el equipo decide una sola paleta en A1**, la secuencia segura es: primero `accent` (verde), después `attention`/`clay`, al final `canvas`/`surface`. Nunca al revés: el canvas afecta todas las sombras y los bordes calculados.

---

## 3 · Tipografía Hearth / Alder

### 3.1 Reparto de roles

| Rol | Familia | Selectores actuales | Decisión |
|---|---|---|---|
| Marca / wordmark | **Hearth 600** | `.app-sidebar .brand-name` (`barrio.css:149`), `.inicio-brand__name` (`inicio.css:96`) | Hearth |
| Saludo / hero editorial | **Hearth 600** | `.inicio-greeting h1` (`374`), `.inicio-hero h2` (`525`), `.home-greeting` (`1487`), `.home-sale__title` (`1582`) | Hearth |
| Título de página / sección | **Hearth 600** | `.screen-heading__title` (`261`), `.inicio-pending h2` (`595`), `.inicio-suggestion h2` (`739`) | Hearth |
| Título de tarjeta grande | **Hearth 600** | `.caja-card-title` (`1671`, `338`), `.goal-card-title` (`2008`) | Hearth si ≥1.25rem |
| Título de tarjeta pequeño | **Alder 600** | `.draft-sheet__title` (`516`), `.book-title h2` (`834`), `.debt-note__head h2` (`917`), `.pending-strip__title` (`994`) | Alder |
| Cuerpo / UI | **Alder 400/500** | `body` (`globals.css:105`), labels, nav, botones, formularios | Alder |
| Importes / tablas / cifras | **Alder 600 tabular** | `.calc-display__total` (`1707`), `.checkout-key__total` (`1833`), `.ledger tfoot td` (`895`), `.inicio-kpi__value` (`459`) | Alder (corregir en A3) |
| Badges / sellos | **Alder 700** | `.state-*`, `.inicio-demo`, `.inicio-task__badge` | Alder |

**Regla operativa:** Hearth solo si el elemento es marca, saludo, título editorial o título de sección ≥1.25rem. Todo lo que sea control, tabla, importe, estado, campo, botón, navegación o título de tarjeta pequeño va en Alder. Esto evita el error de "cambiar Fraunces por Hearth en los 15 lugares" sin distinguir roles.

### 3.2 Escala propuesta

Base: HIG §4.2 (17/24 body, 13/18 footnote, 12/16 caption) + los tamaños reales de Inicio. Se pasa de 53 valores a 17 roles (14 de texto + 3 numéricos).

| Token | Tamaño / línea | Peso | Familia | Uso | Equivalente actual |
|---|---|---|---|---|---|
| `--mc-text-display-xl` | `clamp(1.875rem, 1.3rem + 2.4vw, 3.25rem)` / `1.02` | 600 | Hearth | H1 de Inicio | `3rem–3.25rem` (`inicio.css:376`) |
| `--mc-text-display-lg` | `clamp(2rem, 1.6rem + 1.2vw, 2.875rem)` / `1.05` | 600 | Hearth | Hero H2 | `2.5–2.875rem` (`527`) |
| `--mc-text-display` | `clamp(1.9rem, 1.4rem + 1.5vw, 2.7rem)` / `1.05` | 600 | Hearth | Título de página Caja | `barrio.css:263` |
| `--mc-text-display-sm` | `2.125rem` / `1.08` | 600 | Hearth | Sección Inicio | `2.125rem` (`597`, `742`) |
| `--mc-text-title-1` | `1.75rem` / `1.1` | 600 | Hearth | Sheet/título grande | `1.75rem` |
| `--mc-text-title-2` | `1.375rem` / `1.2` | 600 | Hearth | Tarjeta/título | `1.375rem` |
| `--mc-text-title-3` | `1.25rem` / `1.25` | 600 | Alder | Tarjeta pequeña | `1.25rem` |
| `--mc-text-headline` | `1.0625rem` / `1.35` | 600 | Alder | Fila/campo destacado | `text-sm` (17px) |
| `--mc-text-body` | `1.0625rem` / `1.5` | 400 | Alder | Cuerpo | `body` 17/1.45 |
| `--mc-text-callout` | `1rem` / `1.3` | 400 | Alder | Filas densas | `1rem` |
| `--mc-text-subhead` | `0.9375rem` / `1.35` | 500 | Alder | Metadata importante | `0.9375rem` |
| `--mc-text-footnote` | `0.8125rem` / `1.35` | 500 | Alder | Ayuda, labels | `0.8125rem` |
| `--mc-text-caption` | `0.75rem` / `1.35` | 500 | Alder | Solo no esencial | `0.75rem` |
| `--mc-text-micro` | `0.6875rem` / `1.2` | 700 | Alder | Badges; nunca acciones | `0.6875rem` |
| `--mc-numeric-xl` | `clamp(1.75rem, 1.2rem + 1.6vw, 2.625rem)` / `1` | 600 | Alder tabular | KPI | `inicio.css:461` |
| `--mc-numeric-lg` | `2rem` / `1.05` | 600 | Alder tabular | Total grande | `barrio.css:1835` |
| `--mc-numeric` | `1.0625rem` / `1.3` | 600 | Alder tabular | Importes de fila | `text-sm` |

**Mapeo de los tamaños más repetidos:**

| Actual | Token | Acción |
|---|---|---|
| `0.6875rem` (11px) | `micro` | Solo badges; subir a 12px si es texto legible |
| `0.75rem` (12px) | `caption` | Directo |
| `0.8125rem` (13px) | `footnote` | Directo |
| `0.875rem` (14px) | `footnote`/`subhead` | Elegir por rol |
| `0.9375rem` (15px) | `subhead` | Directo |
| `1rem` (16px) | `callout` | Directo |
| `1.0625rem` (17px) | `body`/`headline` | Directo |
| `1.125rem` (18px) | `headline`/`title-3` | Redondear |
| `1.1875rem` (19px) | `title-3` | Redondear a 20 |
| `1.25rem` (20px) | `title-3` | Directo |
| `1.375rem` (22px) | `title-2` | Directo |
| `1.5rem` (24px) | `title-1`/`numeric-lg` | Según rol |
| `1.75rem` (28px) | `title-1` | Directo |
| `1.875rem` (30px) | `display-sm` | Redondear |
| `2.125rem` (34px) | `display-sm` | Directo |
| `2.375rem` (38px) | `display-lg` | Redondear |
| `2.5rem` (40px) | `display-lg` | Directo |
| `3.25rem` (52px) | `display-xl` | Directo |

### 3.3 Pesos, line-height y tracking

- **Hearth:** 600 para todo lo display. 500 solo si una prueba visual muestra que 600 pesa demasiado en H1. Nunca 700/800: la axis existe, pero el contraste se logra por tamaño, no por grosor.
- **Alder:** 400 cuerpo; 500 metadata/captions; 600 labels, botones, headlines y cifras; 700 solo `strong`, badges y sellos. Eliminar el 800 de `.inicio-demo` (`inicio.css:279`) y del check de tarea (`657`): 700 es suficiente.
- **Line-height:** display 1.02–1.08; títulos 1.1–1.25; cuerpo 1.5; labels 1.25–1.35; cifras 1.0–1.1. No mezclar `px` y `rem` en la misma escala.
- **Tracking:** display-xl `-0.035em`; display-lg `-0.03em`; display `-0.025em`; títulos `-0.015em`; headline `-0.01em`; cuerpo `0`; caption `0.01em`; sellos en mayúsculas `0.08em` (hoy `.inicio-demo` usa `0.12em` y `stamp--demo` usa `0.12em`; a 11–12px es demasiado abierto).
- **Síntesis:** `font-synthesis: none;` en `body` para impedir negritas/cursivas falsas. No hay `italic` en el código actual, así que no hay coste.
- **Features:** eliminar `"ss01" on, "cv11" on` (`globals.css:111`); son de Inter y no aportan en Hearth/Alder. Dejar `font-kerning: normal;` y las ligaduras por defecto.

### 3.4 Cifras tabulares

SOURCE.md confirma que **ninguna familia declara `tnum`**, pero todos los dígitos tienen el mismo avance (Hearth 639 unidades, Alder 535). Por tanto:

- Correcto: `font-variant-numeric: tabular-nums lining-nums;`.
- Innecesario/incorrecto: `font-feature-settings: "tnum"`; no hay feature que activar.
- Mantener `.tabular` (`globals.css:351`) y aplicarlo a **todo** importe visible, no solo a los que hoy lo tienen.
- `CurrencyAmount` debe llamar a `formatMxn`/`formatCompactMxn`; no reimplementar `Intl`.
- `AnimatedAmount` parte el string en `"."` e inserta `<wbr>` (`animated-amount.tsx:43-49`). Con Alder, probar que `$1,245.00` no parte antes del decimal en 320 px; si ocurre, usar `white-space: nowrap` en tamaños pequeños y permitir el corte solo en display.
- Hearth **no** se usa para importes. Los totales de Caja que hoy usan `--font-display` se corrigen en A3 (§5.3).

### 3.5 Carga con `next/font/local`

Propuesta (no aplicada):

```tsx
// web/src/app/layout.tsx
import localFont from "next/font/local";

const hearth = localFont({
  src: "../assets/fonts/hearth-variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-hearth",
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: "Times New Roman",
  preload: true,
});

const alder = localFont({
  src: "../assets/fonts/alder-variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-alder",
  fallback: ["Segoe UI", "Roboto", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
  preload: true,
});
```

```tsx
<html
  lang="es-MX"
  suppressHydrationWarning
  className={`${hearth.variable} ${alder.variable} h-full antialiased`}
>
```

En `globals.css`:

```css
--font-sans: var(--font-alder), "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-display: var(--font-hearth), "Iowan Old Style", Georgia, "Times New Roman", serif;
--font-numeric: var(--font-alder), "Segoe UI", Roboto, Arial, sans-serif;
```

Puntos verificados contra `web/node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`:

- `next/font/local` acepta `weight: "100 900"` para una variable.
- `src` es relativo al archivo que llama a `localFont`; desde `app/layout.tsx`, `../assets/fonts/` apunta a `web/src/assets/fonts/`.
- `adjustFontFallback` para local acepta `"Arial"`, `"Times New Roman"` o `false`; el default es `"Arial"`. Para Hearth hay que declarar `"Times New Roman"` o el fallback se medirá con métricas de Arial y aumentará el CLS.
- `fallback` no tiene default; declararlo evita depender del stack del navegador.
- `preload` es `true` por defecto. Dos archivos de ~26 KiB = ~53 KiB; es aceptable, pero se mide.

**Logística:** `.font-staging/` está excluido por `.git/info/exclude:7`. Los WOFF2 no están versionados. A1 debe copiarlos a `web/src/assets/fonts/`, renombrarlos sin corchetes (`hearth-variable.woff2`, `alder-variable.woff2`) y commitear también `Hearth-OFL.txt`, `Alder-OFL.txt` y `SOURCE.md`. Los corchetes en el nombre original complican rutas y URLs; renombrar es una mejora, no un cambio de licencia.

### 3.6 Fallbacks y cobertura de glifos

- **Hearth:** `Georgia`, `Times New Roman`, `serif`. Es la caída más cercana en métricas y en tono editorial.
- **Alder:** `Segoe UI`, `Roboto`, `Arial`, `sans-serif`. En Windows/macOS el fallback inmediato es Segoe UI/SF; no usar `Inter` como fallback porque ya no se carga.
- **Glifos a probar explícitamente:** `×` (`pending-payments.tsx:66`, `caja-app.tsx` resúmenes), `·` (separadores de copy), `—`/`–` (rangos), `“”`/`’`, `…`, `ñ Ñ á é í ó ú ü ¿ ¡`, `$ % €`, `# / @`.
- SOURCE.md demuestra un subconjunto (español, `$`, `%`, `€`, importes), pero **no** demuestra `×`, `·`, `—` ni comillas tipográficas. Si faltan, el navegador hará fallback por glifo y mezclará familias en la misma línea. El test `document.fonts.check("16px <familia>", "2 × 3 · $1,245.00 — ñ¿¡")` debe pasar antes de A3.
- No usar Hearth en textos que contengan esos símbolos si no están cubiertos; Alder es la familia de la interfaz y de los resúmenes de pedido.

---

## 4 · Componentes reutilizables mínimos

### 4.1 Inventario y decisión

| Primitiva | Dónde vive hoy | Extraíble sin reescribir | Riesgo | Decisión |
|---|---|---|---|---|
| **Button** | 15 patrones primarios (`bg-accent px-`) y 40 secundarios (`border border-separator bg-surface px-`) en `caja-app`, `pending-tasks`, `closing-checklist`. | Sí, como clases/variantes; no tocar las teclas de calculadora. | Alto: 1 122 `className` en `caja-app`. | A3, empezando por `pending-tasks` y `closing-checklist`. |
| **Card** | `.book-sheet` (`barrio.css:1642`), `.caja-panel` (`1659`), `.inicio-kpi` (`405`), `.inicio-pending` (`564`), `.inicio-suggestion` (`701`), `.credit-row` (`1997`). | Sí: el DOM es un `section/div/article` con borde, radio, fondo y sombra. | Medio: radios 18/22/26 y padding 14/16/18/20. | A3 con `className` para conservar la clase actual. |
| **MetricCard** | `.inicio-kpi` (`inicio/page.tsx:250-292`), `.home-kpi` (`caja-app.tsx:3090-3125`), métricas de `BusinessOverview` (`4652-4658`). | Sí: mismo patrón icono + label + valor + nota. | Medio: los tonos de Inicio son `nth-child` (`inicio.css:444-457`). | **Primera extracción A3**; sustituir `nth-child` por `tone`. |
| **SectionHeader** | `ScreenHeading` (`screen-heading.tsx`), cabecera de `PendingPayments` (`pending-payments.tsx:136`), `ActivityList` (`6444`), `CreditList` (`6642`), `GoalCard` (`6177`), `Inicio` pendientes (`inicio/page.tsx:313`). | Sí, como cabecera de tarjeta; no fusionar con `ScreenHeading` (page-level). | Bajo: solo DOM y tipografía. | A2/A3. |
| **CurrencyAmount** | `AnimatedAmount` (`animated-amount.tsx`), 137 llamadas a `formatMxn` en `caja-app`, 50 usos de `.tabular`. | Sí: envolver `formatMxn` + `tabular` + tamaño. | Bajo. | **Primera extracción**; no cambia texto ni cálculos. |
| **PaymentStatus** | `StatusBadge` (`caja-app.tsx:7236`), `STATUS` (`pending-payments.tsx:21-40`), `statusLabel` (`7302`), `PAYMENT_STATES` (`lib/payment-labels.ts`). | Sí: centralizar estado→label/clase/icono. | **Alto**: es la verdad visual del dinero. | A3 con tests de todos los estados; no cambiar copy. |
| **EmptyState** | Inicio pendientes (`page.tsx:335`), `ActivityList` (`6468`), `CreditList` (`6671`), `GoalCard` (`6162`), `ClosingChecklist` (`650`), `PendingPayments` (`175`). | Sí: título + cuerpo + acción + ilustración opcional. | Bajo/medio. | A3; empezar por las variantes de solo texto. |
| **Modal** | `Sheet` (`caja-app.tsx:7594-7735`), usado 7 veces. | Sí: mover a `components/ui/sheet.tsx` sin tocar el focus trap. | Alto por a11y, no por diseño. | A3; añadir `inertTarget` configurable (`.app-shell` hoy). |
| **FormField** | `PendingTasks` (`pending-tasks.tsx:598-723`), `.control-frame` de Caja (`caja-app.tsx:3888, 5483, 6209, 6868`), `CreditPaySheet` (`6753+`). | Sí: label + control + ayuda + error + contador + prefijo. | Medio: campos compuestos (conteo de efectivo) no encajan. | A3; empezar por `pending-tasks`. |
| **SearchField** | **No existe.** No hay `type="search"` ni pantalla de búsqueda en el repo. | **No extraer todavía.** | N/A. | Diferir hasta que exista una superficie de búsqueda real. |
| **TaskRow** | Inicio (`inicio/page.tsx:323-332`, `inicio.css:620-685`), `ClosingChecklist` (`393-447`), `PendingTasks` (`838-926`). | Sí, presentacional con slots de acción. | Medio: unas filas son estáticas y otras mutan. | A3; empezar por Inicio + ClosingChecklist. |
| **ProgressIndicator** | Inicio meta (`inicio/page.tsx:288-290`, `inicio.css:478-491`), `GoalCard` (`6193-6205`). | Sí: track + barra + `role=progressbar` opcional. | Bajo. | A3. |

### 4.2 Qué se puede extraer sin reescribir

**Inicio (piloto ideal, 367 líneas):**

- `inicio/page.tsx:249-292` → `MetricCard` con `icon`, `label`, `value`, `note`, `tone`. Mantener `className="inicio-kpi"` para no tocar CSS. Mover los tonos de `nth-child` a `data-tone`.
- `inicio/page.tsx:312-344` → `SectionHeader` + `TaskRow` + `EmptyState`. Mantener `inicio-pending__head`, `inicio-task`, `inicio-task__check`, etc.
- `inicio/page.tsx:346-362` → `SectionHeader` + `ButtonLink` (variante `brandOutline`). Mantener `inicio-suggestion__cta`.
- `inicio/page.tsx:295-310` → `Card` + `ButtonLink` (variante `maizePill`). Mantener `inicio-hero__*`.
- `inicio/page.tsx:288-290` → `ProgressIndicator` decorativo (`aria-hidden`), porque el porcentaje ya está en texto.

**Caja (sin tocar los monolitos):**

- `caja-app.tsx:7594-7735` → mover `Sheet` tal cual a `components/ui/sheet.tsx`. No reescribir el focus trap.
- `caja-app.tsx:7236-7300` → `PaymentStatus`; eliminar el `STATUS` local de `pending-payments.tsx`.
- `caja-app.tsx:4652-4658` → `MetricCard`/`Stat` para las métricas de `BusinessOverview`; hoy son divs `border-t` repetidos.
- `caja-app.tsx:6444-6471` → `SectionHeader` + `EmptyState` de `ActivityList`.
- `caja-app.tsx:6642-6694` → `MetricCard` (saldo) + `EmptyState` de `CreditList`.
- `caja-app.tsx:6193-6205` → `ProgressIndicator` con `role=progressbar`.
- `pending-tasks.tsx:598-723` → `FormField`; `pending-tasks.tsx:838-926` → `TaskRow` con slot de acciones.
- `closing-checklist.tsx:393-447` → `TaskRow`; `650-654` → `EmptyState`.
- `pending-payments.tsx:136-225` → `SectionHeader` + `PaymentStatus` + `CurrencyAmount`; no reescribir la lógica de expansión.

**No extraer en A3 (o dejar para después):**

- `CajaPanel` (`3264-3983`): 36 props y estado de venta; no es una primitiva.
- `PaymentPanel` (`4025-4476`): lógica de cobro; solo se le inyectan `PaymentStatus`/`CurrencyAmount`.
- `CashCloseCard` (`4985-6046`): máquina de estados de corte; solo `FormField` en los campos simples.
- `PaidSheet` (`7737-7923`): lógica de verdad del pago; solo usa `Sheet`.
- `AppSidebar`/`TopBar`/`MobileTabBar` (`7384-7592`): shell de Caja; no compartir con Inicio todavía.
- `.interpret-key`, `.qty-key`, `.cobrar-key`, `.draft-add`, `.note-chip`: teclas y papelitos con identidad propia; no son `Button` genéricos.
- `Ledger`: tabla contable con semántica propia; no es una `Table` genérica.

### 4.3 Orden de extracción

1. `CurrencyAmount` (bajo riesgo, 137 llamadas potenciales).
2. `SectionHeader` (bajo riesgo, solo DOM).
3. `ProgressIndicator` (bajo riesgo, accesible).
4. `EmptyState` (bajo riesgo, variantes de texto).
5. `MetricCard` (medio; resuelve los `nth-child` de Inicio).
6. `PaymentStatus` (medio/alto; probar los 8 estados y demo/efectivo/fiado/pey).
7. `TaskRow` (medio; acciones como slot).
8. `FormField` (medio; no envolver campos compuestos).
9. `Button`/`Card` (alto; 1 122 clases en `caja-app`; hacerlo con una función de variantes, no con un componente rígido).
10. `Sheet` (mover, no reescribir).

### 4.4 Guardarraíl contra el “segundo dashboard”

- Las primitivas no importan `@/lib/dashboard`, `@/lib/goals` ni `@/lib/tasks`.
- `MetricCard` recibe valores y `ReactNode`; no lee datos.
- `/inicio` sigue siendo la vista editorial; `/` sigue siendo la caja operativa. No se comparte la shell ni el estado.
- `CajaBook` (`caja-app.tsx:3070-3260`) no se elimina ni se convierte en `/inicio`: es la libreta dentro de Caja. La primitiva `MetricCard` unifica su presentación, no su ruta ni su fuente de datos.

---

## 5 · Dirección visual: qué debe preservarse

### 5.1 Inicio (dirección aprobada)

| Elemento | Valor actual | Regla |
|---|---|---|
| Fondo | `--inicio-paper: #fbf3e7` (`inicio.css:5`) | No cambiar en A1. |
| Superficie | `--inicio-surface: #fdf3e4` (`6`) | No cambiar; las tarjetas se separan por borde/sombra, no por contraste de fondo. |
| Verde | `#004b3c` (`7`) | Marca, sidebar, hero, CTA outline. |
| Verde profundo | `#003f31` (`8`) | Gradiente del sidebar (`68`). |
| Tinta | `#1d241f` (`9`) / `#4d5851` (`10`) | Texto y secundario. |
| Terracota | `#b33d24` (`11`) | Kicker, demo, acentos. |
| Maíz | `#f2c768` (`12`) | Rayos del wordmark, CTA del hero (`551`), nav activo (`144`). |
| Bordes | `#e5d6c3` / `#ede1d1` (`13-14`) | Hairlines; no sustituir por `separator` sin revisar el tono. |
| Sidebar | 236px, mark 76px, wordmark 2.375rem, nav 52px/1.125rem/500 | `inicio.css:57-197`. |
| Topbar | 100px, `#fbefe2` (`210`), nombre 1.625rem, dirección 1rem | `203-321`. |
| KPIs | 4 columnas ≥1340, 2 debajo; tarjeta 22px, padding 18/20, icono 44px, valor clamp 28–42, nota 14px | `396-476`, `819-847`. |
| Hero | 269px + contenido, radio 26px, H2 46px, CTA maíz 60px | `493-562`. |
| Pendientes | Tarjeta 22px, filas 64px, checkbox 24px, badge 11px, hora 16px | `564-699`. |
| Sugerencia | Arte 330px, radio 22px, H2 34px, CTA outline 56px | `701-777`. |
| Sombras | `0 2px 8px rgb(31 38 34 / .04)` | `415`, `572`, `714`. |
| Ilustraciones | registradora, Lupita, papel picado, plantas, sol | No tocar. |
| Foco | 3px `#004b3c` | `779-792`. |

**Cambio permitido en A1:** solo la familia tipográfica. Hearth sustituye a Fraunces; Alder sustituye a Inter. Se conservan tamaños, pesos, tracking, colores, radios, sombras y composición.

### 5.2 Mapeo Hearth/Alder en Inicio

- **Hearth:** `.inicio-brand__name` (97), `.inicio-topbar__name` (240), `.inicio-avatar` (318), `.inicio-greeting h1` (375), `.inicio-hero h2` (526), `.inicio-pending h2` (596), `.inicio-suggestion h2` (741).
- **Alder:** `body` del shell (22), nav (132), topbar address (260), KPI top/value/note (423/461/473), hero p/CTA (536/553), task rows (626/662/682), suggestion body/CTA (750/768), demo badge (272-282), botones.
- **Riesgo de wordmark:** `Mercado<br>Cero` a 2.375rem con Hearth puede cambiar el ancho de línea y el punto de quiebre. Probar a 236px de sidebar y a 210px (breakpoint 1340, `820`). Si Hearth es más ancha, reducir el tracking antes que el tamaño.
- **Riesgo de H1:** `text-wrap: balance` + Hearth a 52px. Verificar que “¡Buen día, Lupita!” no pase a 3 líneas a 390px; si pasa, el problema es el tamaño/clamp, no la familia.
- **Riesgo de KPI:** el valor `$1,245.00` es Alder 600 tabular; no debe recortarse a 320px. Probar el peor caso `$1,245,000.00` y `100%`.

### 5.3 Caja: qué se preserva y qué se corrige

**Se preserva en A1:**

- Sidebar verde 15.5rem, marca “Mercado Cero”, tagline, arte del puesto.
- Topbar 64px, surface, comerciante/dirección.
- Main padding `22px clamp(16px, 2.4vw, 36px) 48px`.
- LCD verde con gradiente `#eef6ec → #ddeddf`, etiqueta, total, hint.
- Draft sheet, key grid, ledger, debt note, pending strip.
- Tarjetas radio 18px, borde separator, `--shadow-card`.
- Movimiento y foco actuales.

**Se corrige en A3 (no A1):**

- `.calc-display__total` (`barrio.css:1707`) y `.checkout-key__total` (`1833`) pasan de display a **Alder 600 tabular**. Es la corrección de rol que pide SOURCE/HIG: Hearth no va en cifras.
- `.draft-item__num` (`543`) pasa de display a Alder 700/600 tabular.
- Los títulos pequeños (`.draft-sheet__title`, `.book-title h2`, `.debt-note__head h2`, `.pending-strip__title`) pasan a Alder 600 si se confirma que Hearth a 16–19px pierde legibilidad.
- `state-demo` recibe un tratamiento propio (maíz/trama) para no confundirse con `state-partial`.
- El gráfico “Cómo te pagaron” deja de usar `bg-accent` y `bg-green` como categorías distintas; se usan `accent` y `success` (o patrones), no dos alias del mismo hex.

**No se toca en A1:** ninguna estructura de Caja, ningún texto, ninguna lógica de dinero. A1 es un cambio de fuentes y de nombres de tokens.

---

## 6 · Riesgos de regresión

### 6.1 Visual

| Riesgo | Evidencia | Mitigación |
|---|---|---|
| Hearth cambia el quiebre de H1/H2 y wordmark | 53 tamaños, `text-wrap: balance` (`barrio.css:436`), wordmark a 2.375rem (`inicio.css:98`) | Baseline de bounding boxes; probar 320/390/768/1024/1366/1448; no cambiar tamaños en A1. |
| Alder cambia el ancho de labels de tab bar y botones | `.mobile-tab-label` clamp 12–13 (`globals.css:485-489`), botones `min-h-12` con texto 17px | Medir `scrollWidth <= clientWidth`; no truncar labels; probar 200%. |
| Los importes se parten antes del decimal | `AnimatedAmount` inserta `<wbr>` (`animated-amount.tsx:43-49`) | Probar `$1,245.00` y `$1,245,000.00` a 320; `white-space: nowrap` en `CurrencyAmount` pequeño. |
| Cambia el alto de filas del ledger | `.ledger` altura fija 34px (`barrio.css:854`, `1946`) y Alder puede tener otra línea base | No fijar alto en A1; si hay recorte, ajustar line-height, no la fila. |
| El hero de Inicio pierde el ajuste fino | `.inicio-hero` 269px + H2 46px (`inicio.css:498-531`) | Revisar que el texto no invada la ilustración; probar 1366 y 1024. |

### 6.2 Contraste

| Par | Ratio | Veredicto |
|---|---:|---|
| `#1f2622` / `#f9f6ee` | 14.31 | Pasa AAA |
| `#515b54` / `#f9f6ee` | 6.54 | Pasa AA |
| `#6b6256` / `#f2ebdf` | 5.05 | Pasa AA |
| `#687369` / `#fffdf7` | 4.86 | Pasa AA y ≥3:1 para control |
| `#fffdf7` / `#0f3d36` | 11.86 | Pasa AAA |
| `#fffdf7` / `#b33d24` | 5.72 | Pasa AA |
| `#fffdf7` / `#c1492e` | 4.85 | Pasa AA por 0.35; evitar texto pequeño |
| `#8f2d1c` / `#fffdf7` | 8.06 | Pasa AAA |
| `#8a281b` / `#fffdf7` | 8.60 | Pasa AAA |
| `#f2c768` / `#0f3d36` | 7.55 | Pasa AAA; **nunca sobre blanco** (`1.57`) |
| `#f2c768` / `#004b3c` | 6.34 | Pasa AA |
| **`#5c7264` / `#ddeddf`** | **4.26** | **Falla AA para texto normal** (`barrio.css:1703`) |
| `#5c7264` / `#eef6ec` | 4.70 | Pasa en el extremo claro del gradiente, falla en el oscuro |
| `#7d8a80` / `#fdf3e4` | 3.29 | Pasa como borde no textual (≥3:1) |
| `#725012` / `#fff0d2` | 6.49 | Pasa AA |
| `#293b68` / `#e9ecf3` | 9.25 | Pasa AAA |
| `#0a5039` / `#e2f3e7` | 8.20 | Pasa AAA |
| `#515b54` / `#f2ebdf` | 5.96 | Pasa AA |
| `#8f2d1c` / `#fbe9e6` | 6.99 | Pasa AA |

**Acciones:**
- Corregir `#5c7264` a `#4e6457` (5.25 sobre `#ddeddf`) o a `--color-ink-2` (6.12 sobre `#e2f3e7`). Es un cambio de 1 token, no de layout.
- No usar maíz como texto sobre surface/canvas; solo sobre verde.
- `#fffdf7` sobre `#c1492e` pasa por poco; si se unifica a clay `#b33d24`, mejora a 5.72. Si se mantiene terracota, no usar para texto <14px.
- En alto contraste, los alias `--inicio-*` deben apuntar a tokens que también se sobrescriban. Si `--inicio-paper` es `var(--mc-brand-paper)` y el bloque `html[data-contrast=high]` solo redefine `--inicio-paper`, el valor no llegará a los hijos que usen `--mc-brand-paper`. Hay que sobrescribir el token de marca, no solo el alias.
- Revisar `forced-color-adjust: none` en `.inicio-shell` (`inicio.css:1477`): desactiva los colores del sistema en modo de contraste forzado. Es una decisión existente; si se mantiene, debe probarse en Windows High Contrast.

### 6.3 Carga de fuentes

| Riesgo | Consecuencia | Mitigación |
|---|---|---|
| Dejar `Fraunces`/`Inter` en `layout.tsx` | Se sirven 2 familias de Google self-hosted + 2 locales; doble payload y FOUT innecesario | Eliminar el import de `next/font/google` en A1. |
| Fallback de Hearth medido con Arial | CLS en H1/H2 | `adjustFontFallback: "Times New Roman"` + `fallback` serif. |
| Nombre con corchetes `Hearth[wght].woff2` | URL encoding/404 en build | Renombrar a `hearth-variable.woff2` / `alder-variable.woff2`. |
| Preload de ambos = 53 KiB | Competencia con LCP en 3G | Medir LCP; si molesta, `preload:false` para Hearth y dejar Alder (cuerpo) preload. |
| Glifos `×`, `·`, `—` ausentes | Fallback por glifo y líneas mezcladas | Test de cobertura y `document.fonts.check`. |
| Fuente sin licencia versionada | Incumplimiento OFL | Commitear `Hearth-OFL.txt` y `Alder-OFL.txt`. |
| `font-weight: 800` en Hearth | El axis llega a 900, pero el diseño no lo necesita; puede verse más pesado que Fraunces | Usar 600 en Hearth; 700 máximo en Alder. |
| `font-feature-settings` de Inter | No-op o resultados raros | Quitar `ss01`/`cv11`; dejar `font-kerning`. |

### 6.4 CSS duplicado y cascada

| Riesgo | Evidencia | Mitigación |
|---|---|---|
| `barrio.css` tiene dos capas | 34 selectores base con propiedades en conflicto; `.caja-panel` definido en 326 y 1659 | A3: retirar la primera capa o marcar la segunda como única; no añadir una tercera. |
| `barrio.css` se carga en Inicio y checkout | `layout.tsx:4`; no hay clases de Caja en `/inicio`. `barrio.css:19-22` también apaga el `background-image` de `body`. | A3: mover el import a `web/src/app/page.tsx` después de mover ese `body` a globals; si no, Inicio/checkout heredan los radiales de `globals.css:92-103`. |
| Las reglas sin capa ganan a Tailwind | `.screen-heading__title` vs `text-[1.75rem]` | No introducir `@layer components` sin probar; documentar el orden. |
| Alto contraste duplicado por selector | `inicio.css:1310-1474` (~164 líneas) repite hero, KPI, tareas, CTA | A3: sobrescribir tokens semánticos, no cada selector; dejar solo las excepciones estructurales (ocultar arte, hero a una columna). |
| Alias `--inicio-*` y `--mc-brand-*` divergen | Alto contraste y `forced-colors` | Un solo token de marca; el alias no debe ser el punto de override. |
| Checkout con variables indefinidas | `--mesh-paper`, `--paper-fiber`, `--mesh-sheet` | Definirlas en globals o eliminarlas; no dejar `background-image` inválido. |

### 6.5 Gobernanza

| Riesgo | Evidencia | Mitigación |
|---|---|---|
| La doc contradice el código | HIG §4.1 vs `globals.css`; HIG dice Manrope, código usa Inter | `DESIGN-TOKENS.md` generado desde globals; HIG §4.1 marcado como histórico. |
| Un agente future añade otro hex | 66 + 101 hardcodes actuales | `scripts/token-contract.mjs` en `verify:fast` o `test:tokens`. |
| Se inventa `SearchField` sin uso | No hay `type="search"` | No crearlo hasta que exista una pantalla de búsqueda. |
| Se duplica el dashboard | `CajaBook` y `/inicio` comparten KPIs | Primitivas presentacionales; rutas y datos separados. |

---

## 7 · Plan de implementación A1 / A3

### A1 — Fundación (sin cambio de layout)

**Objetivo:** una sola fuente de tokens, Hearth/Alder cargadas, cero cambios de estructura y cero cambios de color (salvo la corrección de contraste aprobada). Duración estimada: 1–2 días.

| # | Archivo | Cambio | Evidencia |
|---|---|---|---|
| 1 | `web/src/assets/fonts/` | Copiar `Hearth[wght].woff2` y `Alder[wght].woff2`; renombrar a `hearth-variable.woff2` / `alder-variable.woff2`; copiar OFL y SOURCE. Verificar SHA-256 contra SOURCE.md. | `sha256sum` |
| 2 | `web/src/app/layout.tsx` | Sustituir `next/font/google` por `next/font/local`; definir `hearth`/`alder`; `html` con ambas variables; eliminar `Fraunces`/`Inter`. | build + red |
| 3 | `web/src/app/globals.css` | Añadir capa `--mc-brand-*`, `--color-on-accent`, `--color-disabled`, `--color-rule`, `--color-margin`; tokens de tipo/espacio/radio/sombra/foco; alias de compatibilidad; `font-synthesis: none`; quitar `ss01/cv11`; alto contraste sobre tokens de marca. | token contract |
| 4 | `web/src/app/inicio/inicio.css` | Cambiar los 11 valores de `:root` por alias a `--mc-brand-*`; cambiar 7 `var(--font-fraunces)` por `var(--font-hearth)` y `var(--font-inter)` por `var(--font-alder)`; sustituir `#fffdf7` repetidos por `--color-on-accent`; mantener el resto. | geometría + capturas |
| 5 | `web/src/app/barrio.css` | Sustituir los hardcodes repetidos (`#fffdf7` ×19, `#cfe3d4` ×4, `#dce9df` ×2, `#4e6457`/`#5c7264`) por tokens; convertir `.state-*` a variables `--state-*`; corregir `#5c7264` a `#4e6457`; no cambiar selectores ni layout. | contraste + capturas |
| 6 | `web/src/app/checkout.css` | Opcional/aprobado: definir o eliminar `--mesh-paper`, `--paper-fiber`, `--mesh-sheet`; mapear `#efe3d1`, `#f4ead8`, `#fffaf0`, `#fff8ea`, `#07382d` a tokens. Es un fix de integridad del recibo, no de layout; si se aplica, exige captura de `/pay/[id]`. | build + recibo |
| 7 | `docs`/`HIG-DESIGN.md` | Añadir `DESIGN-TOKENS.md` con la tabla de tokens; marcar §4.1 como histórica o actualizarla a los valores reales. | revisión |
| 8 | `web/scripts/token-contract.mjs` | Gate de grep: hex/font-family/radius/shadow fuera de `globals.css` (con excepciones de alto contraste y máscaras). | `npm run test:tokens` |

**A1 no hace:**
- No extrae componentes.
- No cambia clases ni DOM.
- No mueve `barrio.css` de `layout.tsx`.
- No cambia radios, sombras, paddings ni colores de marca (salvo la corrección de contraste).
- No toca la lógica de pagos, fiado, corte ni demo.

**Salida A1:** same layout, new typefaces, one token source, old names as aliases. Si una captura muestra un cambio de color, es un bug de alias.

### A2 — Puente opcional (si A1 deja tiempo)

Extraer solo las primitivas de bajo riesgo y usarlas **solo en Inicio**:

1. `CurrencyAmount`
2. `SectionHeader`
3. `ProgressIndicator`
4. `EmptyState`

No tocar Caja. Esto valida la API de las primitivas con 367 líneas de Inicio antes de entrar al archivo de 8 228 líneas.

### A3 — Composición y convergencia

**Objetivo:** primitivas compartidas, Caja e Inicio con el mismo lenguaje, deuda CSS reducida. Duración estimada: 3–5 días.

| # | Archivo | Cambio | Evidencia |
|---|---|---|---|
| 1 | `web/src/components/ui/currency-amount.tsx` | `CurrencyAmount` sobre `formatMxn` + `tabular`; tamaños `sm/md/lg/xl`; `animate` opcional. | unit/snapshot |
| 2 | `web/src/components/ui/section-header.tsx` | `SectionHeader` card-level; `ScreenHeading` sigue page-level. | capturas |
| 3 | `web/src/components/ui/payment-status.tsx` | `PaymentStatus` con `PAYMENT_STATES`; elimina `STATUS` y `statusLabel` duplicados. | tests de estados |
| 4 | `web/src/components/ui/metric-card.tsx` | `MetricCard` para Inicio y `home-kpi`; tonos por prop, no `nth-child`. | capturas |
| 5 | `web/src/components/ui/empty-state.tsx` | Variantes `plain/dashed/error/illustrated`. | capturas |
| 6 | `web/src/components/ui/task-row.tsx` | `TaskRow` presentacional con slots. | capturas |
| 7 | `web/src/components/ui/progress-indicator.tsx` | `ProgressIndicator` con `role=progressbar` opcional. | axe |
| 8 | `web/src/components/ui/form-field.tsx` | `FormField` con label/hint/error/contador/prefijo. | teclado |
| 9 | `web/src/components/ui/sheet.tsx` | Mover `Sheet` sin reescribir; `inertTarget` configurable. | axe/teclado |
| 10 | `web/src/components/ui/button.tsx` + `card.tsx` | Variantes; teclas de calculadora fuera. | capturas |
| 11 | `web/src/app/inicio/page.tsx` + `inicio.css` | Migrar KPI, pendientes, sugerencia y hero a primitivas; conservar clases. | capturas |
| 12 | `web/src/components/caja-app.tsx` | Migrar Sheet, StatusBadge, métricas, ActivityList, CreditList, GoalCard, PendingTasks, ClosingChecklist, PendingPayments. | capturas + dinero |
| 13 | `web/src/app/barrio.css` | Retirar la primera capa muerta; unificar radios/espaciados; mover import a `page.tsx`; mover `body` a globals. | CSS budget |
| 14 | `globals.css` | Converger paleta si se aprueba; eliminar alias deprecados. | contraste + capturas |

**A3 no hace:**
- No fusiona `/inicio` con `/`.
- No cambia la verdad de los estados (solo su presentación).
- No reescribe `CajaPanel`, `PaymentPanel` ni `CashCloseCard`.

### Criterios de aceptación visual

#### A1

- [ ] `/inicio`, `/?tab=caja`, `/?tab=fiado`, `/?tab=corte`, `/?tab=meta`, `/?tab=pendientes` y `/pay/[id]` renderizan sin error.
- [ ] No hay scroll horizontal a 320, 390, 768, 1024, 1366 ni 1448.
- [ ] Los bounding boxes de contenedores no cambian más de **2 px**; el número de líneas de H1/H2/botones no aumenta.
- [ ] Ningún KPI, total, label de tab o CTA se recorta (`scrollWidth <= clientWidth`).
- [ ] Los colores computados de canvas/surface/ink/accent/attention/danger no cambian (salvo `#5c7264 → #4e6457`).
- [ ] `document.fonts.status === "loaded"`; Hearth 600 y Alder 400/600/700 disponibles.
- [ ] El build solo incluye los dos WOFF2 locales; no quedan archivos de Fraunces/Inter en `_next/static/media`.
- [ ] CLS < 0.02 en `/inicio` y `/`; LCP no peor que baseline +10%.
- [ ] axe serious/critical = 0; contraste del §6.2 sin fallos nuevos.
- [ ] 200% text, alto contraste y forced-colors sin pérdida de contenido.
- [ ] `npm run verify:fast` y `npm run verify:static` en verde.

#### A3

- [ ] Las 11 primitivas del inventario existen y se usan en al menos una pantalla cada una; `SearchField` no se creó.
- [ ] Inicio y Caja comparten `MetricCard`, `CurrencyAmount`, `SectionHeader`, `PaymentStatus`, `EmptyState`, `TaskRow` y `ProgressIndicator` sin duplicar markup.
- [ ] `PaymentStatus` cubre draft/confirmed/payment_pending/partially_paid/paid/demo_paid/fulfilled/cancelled + fiado abierto/saldado + efectivo/pey/demo.
- [ ] `state-demo` es visualmente distinto de `state-partial` (no solo un borde).
- [ ] El gráfico “Cómo te pagaron” usa colores/patrones distinguibles para efectivo, pey, declarado y demo.
- [ ] `.calc-display__total`, `.checkout-key__total`, `.draft-item__num` y `.ledger` usan Alder tabular, no Hearth.
- [ ] `barrio.css` no tiene conflictos base de token (excluyendo `@media`); los 34 actuales quedan en 0 para propiedades tokenizadas.
- [ ] `rg '#[0-9a-fA-F]{3,8}'` en `barrio.css`/`inicio.css` devuelve 0 fuera del bloque de alto contraste.
- [ ] `rg 'font-family:\\s*[^v]'` en `barrio.css`/`inicio.css` devuelve 0.
- [ ] CSS gzip no sube más de 5% por ruta; `/inicio` y `/pay` dejan de cargar `barrio.css`.
- [ ] Capturas A3 firmadas a 1440/1366/1024/768/390/320 y 200%; las diferencias son intencionales y documentadas.
- [ ] `npm run verify:full` + evidencia `ok:true`, `gitAtStart.dirty:false`, `verify:evidence` PASS.

---

## 8 · Anexos

### A. Mapa rápido de archivos y selectores

| Archivo | Zonas a tocar en A1 | Zonas a tocar en A3 |
|---|---|---|
| `layout.tsx` | 2, 10-25, 58 | — |
| `globals.css` | 3-49, 51-59, 90-112, 163-201, 351-353 | 193-201 (tokens de foco), 163-187 (alto contraste) |
| `inicio.css` | 4-25, 96-103, 239-247, 317-321, 374-382, 525-531, 595-601, 739-746, 1310-1324 | 444-457 (nth-child), 1310-1474 (alto contraste) |
| `barrio.css` | 7-13, 122-230 (blanco sidebar), 1567-1598, 1687-1723, 1725-1752, 1801-1815, 1843-1854, 2118-2155, 2251-2281 | 326-342 vs 1659-1663, 531-640 vs 1876-1928, 687-737 vs 1918-1928, 754-816 vs 1817-1854, 846-902 vs 1934-1991 |
| `checkout.css` | 52-69, 127, 153-162, 356, 409, 465-468, 627-630 | Todos los tokens del recibo |
| `caja-app.tsx` | 3110, 7966 | 7594-7735 (Sheet), 7236-7300 (StatusBadge), 4652-4658, 6444-6471, 6642-6694, 6193-6205 |
| `pending-payments.tsx` | — | 21-40, 136-225 |
| `pending-tasks.tsx` | — | 598-723, 838-926 |
| `closing-checklist.tsx` | — | 393-447, 650-654 |
| `inicio/page.tsx` | — | 249-292, 295-344, 346-362 |

### B. Pares de contraste mínimos para el gate

```
ink / canvas                 14.31  PASS
ink-2 / canvas                6.54  PASS
placeholder / surface-2       5.05  PASS
control-border / surface      4.86  PASS (>=3)
on-accent / accent           11.86  PASS
on-accent / brand-clay        5.72  PASS
attention / surface           8.06  PASS
danger / surface              8.60  PASS
maize / brand-green           6.34  PASS
maize / surface               1.57  FAIL (prohibido)
calc-meta / lcd-bottom        4.26  FAIL (corregir)
state-pending / state-pending 6.49  PASS
state-partial / state-partial 9.25  PASS
state-verified / state-verified 8.20 PASS
state-draft / state-draft     5.96  PASS
state-credit / state-credit   6.99  PASS
```

### C. Comandos de verificación propuestos

```bash
cd web
npm run verify:fast
npm run verify:static
npm run test:tokens          # nuevo gate de contrato
npm run typecheck
npm run lint
```

Para la evidencia visual:

```bash
# Capturas base y A1/A3 con Playwright o el script E2E existente
# Viewports: 1440x900, 1366x768, 1024x768, 768x1024, 390x844, 320x568
# Rutas: /inicio, /?tab=caja, /?tab=fiado, /?tab=corte, /?tab=meta, /?tab=pendientes, /pay/[id]
```

Comprobaciones de DOM sugeridas:

```js
document.documentElement.scrollWidth <= window.innerWidth
el.scrollWidth <= el.clientWidth
getComputedStyle(el).fontFamily
document.fonts.status === "loaded"
document.fonts.check("600 32px <familia-hearth>", "¡Buen día! $1,245.00")
document.fonts.check("16px <familia-alder>", "2 × 3 · $1,245.00 — ñ¿¡")
```

### D. Decisiones que necesitan aprobación humana antes de A3

1. **¿La paleta canónica es la de Inicio o la de Caja?** Recomendación: Inicio para identidad; Caja para neutros operativos. No fusionar `canvas`/`surface` sin capturas.
2. **¿Los totales grandes de Caja pasan a Alder en A3?** Recomendación: sí, por HIG/SOURCE; implicar un cambio visual deliberado en el LCD y el checkout.
3. **¿`state-demo` recibe maíz/trama?** Recomendación: sí; hoy comparte el 95% del tratamiento con `state-partial`.
4. **¿Se mueve `barrio.css` fuera de `layout.tsx`?** Recomendación: sí en A3, después de mover `body` a globals; ahorra 8 KiB gzip en `/inicio` y `/pay`.
5. **¿Se elimina la primera capa de `barrio.css`?** Recomendación: sí, pero con captura comparativa; hay 34 conflictos base y 86 selectores repetidos.

---

*Fin de la auditoría. No se modificó ningún archivo de código.*
