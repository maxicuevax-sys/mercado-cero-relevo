# Auditoría del sistema visual — Inicio (Cierre Fase 1)

**Reauditoría:** 2026-11-03 19:58 (America/Mexico_City)
**Rol:** `mc-sistema-diseno` · **Modo:** solo lectura (sin ediciones de código, sin commits)
**Repo:** `mercado-cero` · **Rama:** `design/mercado-cero-v2` · **HEAD:** `b8f127d85985fd519a0010128a1f42bf5346e24e`
**Servidor:** `http://localhost:3100` · `/api/health` → `ok: true`, `buildSha b8f127d85985fd519a0010128a1f42bf5346e24e`, uptime 220 s a las 19:58 (arranque ≈19:54:43)
**Referencia canónica:** `design-references/mercado-cero-rescate/00_REFERENCIA_CANONICA_INICIO_1448x1086.png` (1448×1086)
**Captura normal:** `quality-reports/mercado-cero-final/14_EVIDENCIAS/capturas/inicio-desktop-1448x1086-viewport.png` (19:55:57)
**Captura HC declarada:** `.../inicio-desktop-1448x1086-hc-viewport.png` (19:55:58)
**Variantes:** `.../14_EVIDENCIAS/variantes/` + `summary.json`
**Comparación:** `CIERRE_FASE_1/comparacion-1448.png`, `overlay-1448.png`, `diff-1448.png`

> **Esta versión reemplaza la auditoría anterior.** Las cifras y el veredicto previos quedan superados por esta reauditoría.

---

## 0. Veredicto actualizado

> ## **APROBADO CON LIMITACIONES**
>
> **Para calidad suficiente de Fase 1:** sí. No hay P0 ni P1; la pantalla es coherente, usable, sin overflow y con accesibilidad automática en verde. Los P1 anteriores (marca y jerarquía tipográfica) **bajaron a P2**: siguen siendo diferencias visibles de fidelidad, pero ya no bloquean el cierre.
>
> **Para paridad pixel-perfect:** **RECHAZADO**. Quedan diferencias P2/P3 medibles en ancho de contenido, papel picado, arte de sugerencia, color/icono del KPI 3, indentación del nav, tamaño visible de topbar/marca, escala tipográfica de apoyo y el breakpoint de 1340. No se puede declarar “paridad conseguida”.
>
> **Defecto de evidencia a corregir:** `inicio-desktop-1448x1086-hc-viewport.png` **no muestra alto contraste**: es prácticamente idéntica a la captura normal (diff máximo 10, 0 píxeles con diferencia >20). El modo HC sí funciona cuando se activa antes de la carga; la captura válida es `variantes/alto-contraste-1448x1086.png` o una nueva captura con forced-colors desde el contexto. Si el gate exige ese archivo, hay que reemplazarlo.

**Conteo:** P0 = 0 · P1 = 0 · P2 = 10 · P3 = 8.

---

## 1. Cambios verificados desde la revisión anterior

| Afirmación | Verificación real | Resultado |
|---|---|---|
| Mark del sidebar 76×76 | El **box CSS** es 76×76; la **tinta visible** es **56×53** (la referencia es 86×58) | Parcial: el box creció, pero el icono sigue 35 % más angosto que la referencia |
| Wordmark 38 px | `font-size: 2.375rem`, caja 152×70, tinta 150×64; referencia 154×79 | Ancho casi igual; **altura 15 px corta** (19 %) |
| Rayos 24 px | 24×24 CSS, caja DOM en `(183,127)`; referencia 23×28 en `(162,139)` | Tamaño correcto; **sigue 21 px a la derecha y 12 px arriba** |
| Sin placa blanca | La captura no tiene placa ni fondo blanco detrás del símbolo | **Cumple** |
| CTA hero 220×60, 20 px, centrado | Elemento 220×60, fuente 20 px, `justify-content:center`; texto centrado; botón alineado a la izquierda del bloque en `x=535` (la referencia empieza en `x=536`) | **Cumple** el tamaño declarado; no está centrado en el hero, pero sí el label dentro del botón |
| CTA sugerencia mínimo 200×56 | Desktop: 200×56. Mobile 390/320: **127×48** porque el media 760 pone `min-width:0` (`inicio.css:1197-1205`) | Cumple en desktop; **no es un mínimo global** |
| Topbar icon 46×46 | El **elemento** mide 46×46; la **tinta visible** es **36×33**; referencia 46×45 | Parcial: el icono sigue 22 % más chico a la vista |
| Nombre topbar 26 px | `1.625rem`; caja 254×29, tinta 249; referencia 324×48 (incluye chevron) | Mejoró; **sigue 22 % más angosto** que la referencia |
| KPI 2×2 ≤1340 | A 1341: 4 columnas de 251 px. A 1340: 2 columnas de 532 px | **Cumple el 2×2**, pero el mismo media también apila hero/pending y reduce el sidebar (ver F-09) |
| KPI con `$1,245.00` sin overflow | Probado en 1366, 1341, 1340, 1281, 1280, 1200, 1101, 1100, 390, 320 y xlarge: `scrollWidth == clientWidth` en todos; el valor cabe en su caja (p. ej. 1366: 215/215; 1341: 209/209; 1101: 371/371) | **Cumple**; no hay overflow horizontal |
| Checkmark corregido | `getComputedStyle(::after).content = "✓"`; la captura muestra el check correcto | **Cumple**; mojibake resuelto |
| Forced-colors activa `data-contrast=high` | Con `forced_colors="active"` antes de `goto`, `dataset.contrast = "high"`, shell blanco, hero negro, arte oculto; `axe` 0 | **Funciona en carga inicial**; ver F-10 sobre la captura `-hc` |
| Build final `b8f127d` desde árbol sucio | `git status`: 10 archivos modificados + nuevos sin commit; `/api/health` devuelve el SHA; servidor arrancó después del CSS (19:52:59) y antes de la captura (19:55:57) | **Build sucio**; la captura sí corresponde al proceso actual, pero no hay gate limpio |

### 1.1 Re-captura Playwright

Se re-capturó `/inicio` con Playwright/Chromium a 1448×1086 y se midió el DOM. La geometría principal coincide con `summary.json` y con la captura final: `sidebar 236`, `topbar 100`, 4 KPI de 269×200, hero 538×304, pending 573×304, sugerencia 1129×211, CTA 220×60. El PNG no es byte-idéntico al entregado (diferencias de antialias de texto; la marca y el topbar sí son idénticos), pero no hay desplazamiento de layout.

---

## 2. Resultado por los 10 puntos

| # | Punto | Resultado | Severidad |
|---|---|---|---|
| 1 | Marca | Sin placa; mark visible 56×53 vs 86×58; wordmark 150×64 vs 154×79; rayos mal ubicados | P2 |
| 2 | Hero | Arte sin banda; registradora completa; CTA 220×60 con protagonismo suficiente | P3 residual |
| 3 | Sugerencia | Lupita/tableta completas; corte inferior de 9 px con franja crema; CTA desktop 200×56 | P2 |
| 4 | Sidebar | Plantas/bolsa completas; sin halo/banda; fondo verde; arte oculto a ≤820 px de alto | P3 |
| 5 | Tipografía | H1 52 px; anclas CTA/topbar mejoradas; apoyo sigue 10–30 % más chico; notas 11–14 px | P2 (antes P1) |
| 6 | Composición | 4 KPI, hero/pending alineados; sin tarjetas nuevas; ancho derecho/picado cortos; 1340 apila todo | P2 |
| 7 | Paleta/bordes/radios/sombras | Coherente; verde más claro; KPI 3/4 comparten rosa | P2/P3 |
| 8 | Iconografía | Kit consistente + 2 lucide + check; mismo checklist para dos significados; estilo plano | P2/P3 |
| 9 | CSS | Duplicaciones menores; tres bugs de layout; HC con colores hardcodeados; media 1340 sobredimensionado | P2/P3 |
| 10 | Defectos | P0 0 · P1 0 · P2 10 · P3 8 | — |

---

### 1. Marca del sidebar

**¿Se eliminó la placa blanca?** **Sí.** El símbolo crema está directamente sobre el verde; no hay placa, círculo ni fondo blanco. Es una mejora real.

**¿Se parece a la referencia y guarda proporciones?**

| Elemento | Referencia | App | Diferencia |
|---|---|---|---|
| Mark (tinta) | 86×58 en `(79,30)` | **56×53** en `(90,34)` | 35 % más angosto, 9 % más bajo; aspecto 1.48 vs 1.06 |
| Wordmark (tinta) | 154×79 | **150×64** | Ancho casi igual; **19 % más bajo** |
| Rayos | 23×28 en `(162,139)` | **24×24** en `(183,127)` | Tamaño correcto; **21 px a la derecha, 12 px arriba** |
| Separador | No existe | `border-bottom` 1 px (`inicio.css:76`) | Línea extra |

- El **box** del mark es 76×76, como se declaró, pero el SVG tiene padding interno: la tinta visible es 56×53. La referencia visible es 86×58. El icono sigue viéndose **más chico y cuadrado** que el toldo ancho de la referencia.
- El wordmark ya casi iguala el ancho de referencia (150 vs 154), pero su bloque es 15 px más bajo: `line-height: 0.92` comprime las dos líneas (`inicio.css:96-103`). La referencia tiene más aire vertical.
- El rayo de 24 px está bien de tamaño, pero se coloca **entre las dos líneas / sobre la línea superior**, no junto a “Cero” como en la referencia. En la captura se lee como una flecha pequeña al costado del wordmark.
- El icono sigue siendo una versión plana del símbolo (sin volumen ni sombra). La marca se reconoce, pero no es fiel al detalle de la referencia.
- El separador bajo la marca no está en la referencia; añade una línea horizontal.

**Conclusión:** la placa blanca se eliminó y el bloque mejoró, pero **las proporciones de tinta y la posición del rayo siguen siendo aproximadas**. P2 (antes P1): no bloquea Fase 1, sí impide paridad.

---

### 2. Hero

**¿El arte está integrado sin banda/seam?** **Sí.** El PNG del hero es alfa (41.7 % transparente) y no hay rectángulo de fondo ni cambio de verde alrededor de la registradora. El borde derecho del bloque de arte corta la mesa en `x≈528`; la referencia en `x≈537` (9 px antes). No hay banda visible.

**¿La tabla/registradora están completas?** **La registradora sí:** papel, cuerpo, 10 teclas, base, tablero y mantel están presentes. **La mesa está recortada por el borde del arte** como en la referencia; no falta ninguna pieza, pero el título de la app empieza a **8 px** de la mesa (la referencia deja 23 px). Es un problema de aire/crop, no de piezas.

**¿El CTA tiene protagonismo y no se solapa?** **No se solapa** y ahora tiene protagonismo suficiente:

| CTA hero | Referencia | App |
|---|---|---|
| Tamaño | ≈251×70 | **220×60** |
| Fuente | ≈22 px | **20 px** |
| Posición | `x≈536`, `y≈671` | `x=535`, `y=646` |
| Texto | — | Centrado dentro del botón (`justify-content:center`) |
| Aire inferior | ≈68 px | ≈94 px |

El CTA ya es un botón primario claro; la diferencia de 31×10 px es residual (P3). El botón no está centrado en el hero, pero sí su etiqueta, y su `x=535` coincide con la referencia `x≈536`; no lo considero defecto.

**Conclusión:** arte integrado, registradora completa, CTA sin solape y con protagonismo suficiente. Queda el aire de 8 px contra la mesa y el +6.7 % de escala del raster (P3).

---

### 3. Sugerencia

**¿Lupita/tableta están completas?** **Sí en horizontal:** cara, torso, brazo, mano y tableta completa. **El corte inferior persiste:** el arte mide 330×191, la tarjeta 211 px y el `padding-bottom` de 8 px (`inicio.css:701-726`) hace que el arte termine en `y≈1018` mientras la tarjeta termina en `y≈1027`. Quedan **9 px de franja crema** y la figura se corta antes del borde. La referencia sangra el arte hasta el borde de la tarjeta; aquí se lee como figura flotando/cortada.

**¿Fondo integrado?** **Sí.** El PNG tiene alfa (31.9 % transparente), no hay rectángulo de fondo ni borde vertical; la superficie de la tarjeta se mantiene a la izquierda del arte.

**¿Línea o borde extraño?** **Sí:** el corte inferior del arte con la franja crema. El borde de 1 px de la tarjeta es normal. No hay halo alrededor de Lupita.

**CTA de sugerencia:** desktop **200×56** (fuente 18 px), referencia ≈224×64. Está cerca y tiene buen protagonismo. En mobile, el media 760 anula `min-width` y queda **127×48** a 390/320; si el “mínimo 200×56” era global, no se cumple.

**Conclusión:** ilustración completa e integrada, pero el corte inferior es un defecto visible P2; el CTA desktop es suficiente (P3 residual).

---

### 4. Sidebar: plantas/bolsa, halo, fondo

**Plantas y bolsa:** completas al mismo grado que la referencia; la maceta y la bolsa se cortan por los bordes del sidebar/viewport, como en el canónico. No falta ninguna parte más allá del recorte de pantalla.

**¿Halo o banda?** **No se detectó halo.** El PNG es RGB con su propio verde (`#013a2d`) y una máscara superior de 24 px (`inicio.css:187-197`); la transición medida en `x=210`, de `y=740` a `y=820`, es suave: `(2,66,53) → (0,62,48) → (0,59,45) → (0,58,44)`. No hay salto de banda. El verde del arte coincide con el degradado inferior.

**Fondo verde:** sí, con degradado `#064b3e → #003f31`. La app es ligeramente más clara/teal que la referencia (`(2,66,53)` vs `(0,61,46)` a `y=700`), pero dentro de la familia (P3).

**Responsive:** a `max-height: 820px` el arte se oculta (`inicio.css:1287`) y el sidebar se compacta. En 1366×768 **no aparecen plantas/bolsa**, por lo que la firma visual no se conserva en laptop (P3).

---

### 5. Tipografía y jerarquía

**H1:** 52 px, caja 410×53, tinta 403×50; referencia 433×51. Es 7 % más angosto por el `letter-spacing: -0.035em` (`inicio.css:379`). Tamaño correcto; ancho no fiel.

**Anclas mejoradas:**

| Elemento | Referencia | App | Estado |
|---|---|---|---|
| H1 | 52 / 433 ancho | 52 / 403 ancho | Aproximado |
| KPI label | ~22 | 19 | Bajo |
| KPI value | ~48 | 42 | Bajo |
| Pendientes título | ~40 | 34 | Bajo |
| Tarea | ~24 | 19 | Bajo |
| “Ver todos” | ~20 | 16 | Bajo |
| Topbar nombre | ~30 | **26** | Mejoró; aún bajo |
| Topbar dirección | 18 | 16 | Bajo |
| CTA hero | ~22 | **20** | Casi |
| Cuerpo sugerencia | ~28 | 17 | Muy bajo |
| Kicker “Sugerencia” | 34 serif | 14 sans | Muy bajo |

**¿Quedan notas diminutas?** **Sí:**
- `.inicio-kpi__note` = **14 px** (`inicio.css:470-476`).
- `.inicio-task__badge` = **11 px** (`inicio.css:667-678`).
- `.inicio-pending__fixture` = **13 px** (`inicio.css:694-699`).
- `.inicio-suggestion__kicker` = **14 px** (`inicio.css:732-737`).
- En mobile: nota KPI **12 px**, badge **10 px**, fixture **12 px** (`inicio.css:1064-1069,1151-1167`).

Las notas son legibles y `axe` no reporta fallos de contraste, pero siguen siendo pequeñas frente a los valores de 42 px y a la escala de la referencia. La jerarquía del topbar/CTA mejoró; la base de apoyo sigue plana.

**Conclusión:** P1 anterior **baja a P2**. Ya no bloquea Fase 1; sigue impidiendo paridad tipográfica.

---

### 6. Composición

| Verificación | Resultado | Evidencia |
|---|---|---|
| 4 KPI en fila a 1448 | **Cumple** | 4 columnas de 269 px, `y=260` |
| Hero/pending alineados a 1448 | **Cumple** | Ambos `y=492`, `h=304` |
| Sugerencia inferior | **Cumple** | `y=816`, ancho 1129 |
| Sin tarjetas nuevas | **Cumple** | 4 KPI + hero + pending + sugerencia |
| Ancho derecho | **No cumple** | Contenido 1129; borde derecho 1389 vs 1424; margen 59 vs 24 |
| Papel picado con sangrado | **No cumple** | Visible 950..1388 vs 985..1447; el elemento mide 926..1389 y no llega al viewport |
| Nav del sidebar | **No cumple** | icono x=26 / label x=61 vs referencia x=36 / x=93 |
| Breakpoint 1340 | **Cumple 2×2, pero apila todo** | 1341: 4 KPI + 2 columnas; 1340: 2×2 + una columna |
| 1366 | **Parcial** | 4 KPI; hero 280 vs pending 301 (no iguales) |
| 1280 | **Parcial** | 2×2 + una columna; CTA hero en y=794, casi fuera de 800 |

**El defecto principal sigue siendo el ancho:** `.inicio-content` mantiene `max-width: 1129px` y `margin-left: 24px`, sin margen derecho automático (`inicio.css:323-340`). A 1448 faltan 27 px de ancho y sobran ≈59 px de margen derecho. Esto reduce las KPI a 269 px (vs ~278) y hace que el papel picado se corte en 1389 en vez de sangrar a 1447.

**Breakpoint 1340 — nuevo efecto colateral:** el media `@media (max-width:1340px)` (`inicio.css:818-846`) no solo pone 2×2 los KPI; también:
- reduce el sidebar de 236 a 210 px;
- convierte `.inicio-content` a una columna;
- apila hero y pending;
- cambia la altura del hero a 280 px.

Resultado medido: a 1341 hay 4 KPI y 2 columnas (`bodyHeight 1019`); a 1340 hay 2×2 y una columna (`bodyHeight 1521`). El CTA del hero queda en `y=795` a 1340×800 y en `y=794` a 1280×800: **el botón “Registrar” queda al borde o debajo del fold**. Si el objetivo era solo evitar overflow de KPI, conviene separar el 2×2 de KPI del apilado hero/pending; si el apilado es intencional, es una decisión responsive que cuesta el CTA en laptop.

**Sin tarjetas nuevas:** correcto. “DEMO”, “Ejemplo” y la nota de fixture son estados de verdad demo, no tarjetas.

---

### 7. Paleta, bordes, radios y sombras

**Coherencia:** alta. Crema, verde, terracota y maíz están presentes; el papel picado aporta los acentos cálidos; el “DEMO” usa terracota. No hay colores fuera de familia.

**Desviaciones:**
- **Verde más claro/teal:** app `#004b3c` `(0,75,60)`; referencia medida ≈`#014230` `(1,66,48)`. Diferencia de 9–12 unidades (P3; puede incluir perfil de color).
- **KPI 3/4 comparten rosa:** `inicio.css:449-457` asigna `#fbe9e6` a “Por cobrar” y “Meta del mes”. La referencia usa **maíz** para “Por cobrar” y rosa para “Meta”. La secuencia correcta es verde → maíz → maíz → rosa (P2).
- **Bordes/radios:** `#ede1d1` muy cerca; KPI 22, hero 26, pending 22, sugerencia 22; referencia ~22–28. Correcto.
- **Sombras:** la app usa `0 2px 8px` con 4–4.5 % de opacidad; la referencia tiene sombra casi imperceptible y textura de papel. La app se ve un poco más “digital”, sin romper la coherencia (P3).
- **Textura:** fondo plano; la referencia tiene grano de papel. P3.

---

### 8. Iconografía

**¿Un solo sistema?** **Casi.**
- El kit de `web/src/assets/inicio/icons/` es consistente: 24×24, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.8"`, linecaps redondos (14 iconos de UI; el sol de bienvenida es una ilustración aparte de 196×196).
- Se mezclan **2 lucide** (`ChevronDown`, `Plus`) con stroke 2 px (`page.tsx:6`), frente a 1.8 del kit. A 17–20 px la diferencia es menor.
- El check de tarea es un glifo CSS `content: "\2713"` (`inicio.css:649-659`), ahora correcto. No es un SVG, pero se ve bien.
- La marca, el hero, Lupita, las plantas y el sol son ilustraciones; es una capa intencional.

**Problemas de consistencia/fidelidad:**
1. **Estilo plano vs dimensional:** la referencia usa iconos con volumen y sombra; la app usa line icons de 1.8 px. Es un cambio de lenguaje visual en todo el sistema, no un accidente puntual (P2).
2. **Semántica:** `iconPendientes` (lista con checks) se usa para el KPI **“Por cobrar”** (`page.tsx:275`) y para el título **“Pendientes”** (`page.tsx:317`). La referencia usa un icono distinto para cada uno (calendario/reloj para por cobrar; portapapeles para pendientes). P2.
3. **Sol:** el `sol-bienvenida.svg` es un sol **sonriente**; la referencia es un disco naranja con rayos, sin cara. Además el sol visible mide 57×56 vs 88×88. P3/P2 de tono.
4. **Sugerencia:** se perdió el destello/rayos que acompañaba a “Sugerencia” en la referencia; ahora es solo un kicker de texto (P3).

**Conclusión:** internamente hay un sistema dominante y dos excepciones menores; **no es una mezcla caótica**. Frente a la referencia, es plano y más ligero.

---

### 9. CSS: duplicados, overrides y bugs

**Respuesta corta:** sigue habiendo duplicación/fragmentación, pero **no encontré una contradicción efectiva a 1448** que rompa la pantalla. Los bugs que sí impactan el render son: ancho del contenido, anclaje del papel picado, padding inferior del arte y el media 1340 sobredimensionado.

#### 9.1 Duplicaciones / fragmentación

| Líneas | Selector / bloque | Problema |
|---|---|---|
| `493-505` y `805-807` | `.inicio-hero { grid-template-columns: 269px minmax(0,1fr) }` | Declaración idéntica repetida en el media 1101–1400 |
| `804-816` | media 1101–1400 | Baja `.inicio-hero h2` a `2.5rem`; hay un salto 40 → 44.96 px al pasar a 1401 |
| `818-846` | media ≤1340 | **No solo KPI 2×2**: sidebar 210, una columna, hero/pending apilados |
| `848`, `1208`, `1469` | `@media (max-width:760px)` | **Tres bloques** para el mismo breakpoint (el segundo para xlarge; el tercero para HC) |
| `1258-1307` | media `max-height:820` | Oculta el arte del sidebar y baja hero/pending a 280; en 1366 pending sigue en 301 |
| `1469-1479` | HC mobile + `forced-colors` | El bloque de `forced-colors` solo aplica `forced-color-adjust:none`; el tema depende del script inline (`layout.tsx:66`), no del CSS |
| `667-678`, `694-699` | badge/fixture con colores hardcodeados | No se sobrescriben en `data-contrast=high`; quedan clay en HC |
| `13` | `--inicio-border` | Token definido y no usado |

No hay un override del mismo scope con valor distinto que esté ganando de forma accidental; la cascada es coherente. El costo es de mantenimiento (≈1569 líneas para una pantalla) y de los efectos colaterales del media 1340.

#### 9.2 Reglas que causan defectos visuales

| Líneas | Regla | Efecto medido |
|---|---|---|
| `323-340` | `.inicio-content { width: calc(100% - 48px); max-width: 1129px; margin-left: 24px; }` | A 1448 termina en 1389 y deja ≈59 px de margen derecho; la referencia deja 24 |
| `339,347-355` | `overflow-x: clip` + `.inicio-picado { right:0; width:463px }` | El papel picado se ancla al contenido (1389), no al viewport (1448); no sangra |
| `701-726` | sugerencia `padding-bottom:8px` + arte `align-self:end` | El arte termina 9 px antes del borde de la tarjeta; queda franja crema |
| `449-457` | KPI 3 y 4 con el mismo `#fbe9e6` | “Por cobrar” pierde el maíz de la referencia |
| `123-147` | nav `padding:0 12px`, gap 12, icono 23 | Label en x=61 vs 93 de la referencia; pill 208×52 vs ~216×56 |
| `221-247` | topbar icon 46, name 26 | El elemento mide 46, pero la tinta visible es 36×33; nombre 249 vs 324 |
| `516-523` | hero content `padding:34px 10px 20px 6px` | El título queda a 8 px del arte (referencia 23) |
| `1287-1307` | `max-height:820` + `min-height:280` | 1366: hero 280 vs pending 301; no quedan igualados |
| `470-476` | `.inicio-kpi__note { min-height:2.6em }` | Reserva dos líneas en todas; las notas de una línea dejan hueco |
| `667-678`, `694-699` | colores hardcodeados | Quedan clay en `data-contrast=high`; el resto del tema es B/N |

#### 9.3 Lo que el CSS resuelve bien

- Sidebar 236 y topbar 100 coinciden con la referencia a 1448.
- 4 KPI, hero/pending y sugerencia: estructura correcta.
- Foco visible, `prefers-reduced-motion`, alto contraste y tamaños de texto grande/muy grande implementados.
- Sin scroll horizontal en ninguna de las anchuras probadas.
- `axe` 0 violaciones en normal y en forced-colors (verificado con Playwright).

---

### 10. Defectos restantes y severidad

#### P0 — ninguno

No hay solapamiento de CTA, no hay contenido crítico cortado a 1448, no hay scroll horizontal ni violaciones automáticas de accesibilidad.

#### P1 — ninguno

Los dos P1 anteriores **bajaron a P2**:
- **F-01 marca:** el bloque de marca mejoró (box 76, wordmark ancho casi igual); el mark visible 56×53 y el rayo desubicado siguen siendo diferencias de fidelidad, no un bloqueo.
- **F-02 tipografía:** CTA 20, topbar 26, KPI 42 y H1 52 dan anclas suficientes; el apoyo sigue pequeño, pero la pantalla es legible y coherente.

#### P2 — defectos visibles de fidelidad/composición

| ID | Hallazgo | Evidencia |
|---|---|---|
| **F-01** | Marca: mark visible 56×53 vs 86×58; wordmark 150×64 vs 154×79; rayos 21 px a la derecha/12 px arriba; separador extra | Captura; `inicio.css:76,82-114`; `brand-shop-cream.svg` |
| **F-02** | Tipografía de apoyo 10–30 % menor; notas 11–14 px; tareas 19 vs ~24; cuerpo sugerencia 17 vs ~28 | `summary.json`; captura; `inicio.css:470-476,667-678,694-699,732-753` |
| **F-03** | Contenido 1129 vs 1156; borde derecho 1389 vs 1424; margen 59 vs 24 | Playwright; `summary.json`; `inicio.css:323-340` |
| **F-04** | Papel picado no sangra: visible 950..1388 vs 985..1447 (elemento 926..1389) | Medición; `inicio.css:339,347-355` |
| **F-05** | Arte de Lupita cortado: 330×191, tarjeta 211, padding-bottom 8; 9 px de franja crema | Captura; `inicio.css:701-726` |
| **F-06** | KPI 3 “Por cobrar” en rosa y con checklist; referencia maíz + calendario; KPI 3/4 comparten rosa | `inicio.css:449-457`; `page.tsx:275,317` |
| **F-07** | Nav a la izquierda: icono x=26/label x=61 vs 36/93; pill 208×52 vs ~216×56 | Playwright; `inicio.css:123-147` |
| **F-08** | Topbar visible: icono 36×33 vs 46×45; nombre 249 vs 324; dirección 130×13 vs 168×17 | Playwright + captura; `inicio.css:221-263` |
| **F-09** | Media 1340 apila todo (no solo KPI): 1341 4 KPI/2 columnas, 1340 2×2/1 columna; `bodyHeight 1019 → 1521`; CTA a y=794–795 en 1280/1340×800 | Playwright 1341/1340/1280; `inicio.css:818-846` |
| **F-10** | `-hc-viewport.png` no es HC: diff máximo 10, 0 píxeles >20; el tema sí funciona al cargar con forced-colors; la captura válida es `variantes/alto-contraste-1448x1086.png` (19:50) o la re-captura Playwright forzada de esta auditoría (19:58, CSS final) | Diff de PNGs; `audit_capture.py:227` (emula después de cargar); `layout.tsx:66` |

#### P3 — pulido / higiene

| ID | Hallazgo | Evidencia |
|---|---|---|
| **F-11** | CTA hero 220×60 vs 251×70 y sugerencia 200×56 vs 224×64: suficiente, no idéntico | Playwright; captura |
| **F-12** | En mobile el CTA de sugerencia queda 127×48 (390/320), no 200×56 | Playwright; `inicio.css:1197-1205` |
| **F-13** | 1366: hero 280 vs pending 301; no igualados | Playwright; `summary.json` laptop |
| **F-14** | Verde más claro/teal; sombras y textura de papel ligeramente distintos | Medición de píxeles |
| **F-15** | Sol visible 57×56 vs 88×88; sol sonriente no canónico | Captura; `sol-bienvenida.svg` |
| **F-16** | A 320 el nombre del topbar pasa a dos líneas y el chevron queda colgando; sin overflow | Playwright 320 |
| **F-17** | KPI 2×2 con filas de 196/200 px; alturas desiguales por 4 px | Playwright 1340/1280 |
| **F-18** | CSS: hero grid duplicado, tres bloques 760, HC con badge/fixture clay, token muerto, `forced-colors` depende del script inline | `inicio.css:13,805-807,848,1208,1469,1475-1479`; `layout.tsx:66` |

---

### 10.1 Nuevos hallazgos de esta reauditoría

- **La captura `-hc` no es HC (P2, evidencia):** el modo funciona, pero el archivo entregado es indistinguible del normal. La captura válida es `variantes/alto-contraste-1448x1086.png` (19:50) o la re-captura Playwright forzada de esta auditoría (19:58, CSS final).
- **El media 1340 apila todo el dashboard (P2):** no solo los KPI; a 1280×800 el CTA “Registrar” queda en `y=794` y no se ve completo sin scroll.
- **El 2×2 de KPI tiene filas desiguales (P3):** 196/200 px a 1340; 196/199 a 1280/1200.
- **A 320 el nombre del topbar ocupa dos líneas (P3):** no hay overflow, pero el chevron/address quedan apretados.
- **Los “76/46 px” declarados son cajas, no tinta visible (P2/P3):** mark visible 56×53; topbar icon visible 36×33.
- **El mínimo 200×56 del CTA de sugerencia no es global (P3):** en 390/320 queda 127×48.
- **El checkmark ya está corregido (pass):** no hay mojibake; el pseudo-elemento computa `"✓"`.
- **No aparecieron nuevos overflows ni textos cortados** con `$1,245.00` en las anchuras probadas; sí persisten los defectos visuales P2/P3 listados.

---

## 3. Fiel vs aproximado

### Fiel / suficiente

- **Placa blanca eliminada**; marca crema sobre verde.
- **Estructura:** sidebar 236, topbar 100, 4 KPI en fila a 1448, hero/pending 492/304, sugerencia al pie, sin tarjetas nuevas.
- **Arte del hero y sidebar integrados** (alfa, sin banda/halo); CTAs sin solape.
- **CTA con protagonismo suficiente:** 220×60, 20 px, label centrado; sugerencia 200×56 desktop.
- **KPI sin overflow** en 1448, 1366, 1341, 1340, 1281, 1280, 1200, 1101, 1100, 390, 320 y xlarge; sin scroll horizontal.
- **Checkmark correcto** (`✓`), sin mojibake.
- **Forced-colors funciona en carga inicial** y `axe` 0 en normal y forced.
- **Paleta, bordes y radios** en la familia correcta.
- **Accesibilidad automática:** 0 violaciones en las 10 variantes y en la prueba forzada.

### Aproximado (no fiel)

- Marca: mark visible 56×53, wordmark 19 % más bajo, rayo mal ubicado, separador extra.
- Tipografía: apoyo 10–30 % menor; notas 11–14 px.
- Topbar: icono visible 36×33; nombre/dirección más pequeños.
- Nav: contenido 27–32 px a la izquierda, iconos 23 vs ~28, pill más bajo.
- Composición: ancho 1129 vs 1156; margen derecho 59 vs 24; papel picado sin sangrado.
- Sugerencia: arte 9 px arriba del borde, con corte visible.
- KPI 3 en rosa/checklist en vez de maíz/calendario.
- Iconografía plana vs dimensional.
- 1340: layout completo apilado y CTA bajo el fold en 1280×800.

### No fiel

- Proporciones de la marca.
- Jerarquía tipográfica de apoyo.
- Ancho derecho/papel picado.
- Corte inferior del arte de sugerencia.
- Color/icono de “Por cobrar”.
- Evidencia `-hc` (archivo incorrecto, no el producto).

---

## 4. ¿Los P1 anteriores siguen bloqueando?

**No.** Ambos bajan a **P2**:
- **Marca:** el box de 76, el wordmark de 38 y el rayo de 24 están aplicados; el bloque ya no se ve “diminuto” como antes. Queda la tinta del icono (56×53 vs 86×58) y la posición del rayo. Es fidelidad, no bloqueo.
- **Tipografía:** el CTA de 20 y el topbar de 26 mejoran las anclas; el H1 sigue en 52 y los KPI en 42. El apoyo sigue pequeño. Es fidelidad, no bloqueo.

**No hay P0 ni P1 nuevos.** Las limitaciones para cerrar Fase 1 son P2/P3 y están listadas. Si el gate exige paridad pixel-perfect, siguen siendo suficientes para **RECHAZAR** esa paridad; para **calidad de Fase 1**, el sistema es aprobable con limitaciones.

---

## 5. Qué corregir para subir de nivel (no aplicado)

1. **Ancho/picado (F-03/F-04):** `max-width` ~1156 y margen derecho 24; anclar el papel picado al viewport/main para que llegue a 1448.
2. **Sugerencia (F-05):** quitar el `padding-bottom` del arte o compensarlo con `margin-bottom:-8px` para que sangre al borde.
3. **KPI 3 (F-06):** fondo maíz y un icono de calendario/reloj distinto del checklist.
4. **Nav/topbar (F-07/F-08):** padding horizontal ~28, gap icono-label ~20, iconos ~28, pill ~216×56; topbar icon visible ~46 (recortar viewBox o subir el img) y nombre ~30.
5. **Marca (F-01):** subir el mark visible a ~86×58 (box ~115 o viewBox ajustado) y colocar los rayos a la altura de “Cero”; quitar el separador.
6. **Tipografía (F-02):** subir tareas a ~22–24, cuerpo de sugerencia a ~20–24, notas a ≥14 y badges a ≥12; revisar el tracking del H1.
7. **Responsive (F-09/F-13):** separar el 2×2 de KPI del apilado hero/pending; no convertir todo el layout a una columna a 1340 si se quiere conservar el CTA en 1280×800; igualar hero/pending a 1366.
8. **HC (F-10/F-18):** recapturar `-hc-viewport` con forced-colors activo **antes** de `goto` (o recargar tras `emulate_media`), y añadir overrides HC para `.inicio-task__badge` y `.inicio-pending__fixture`.
9. **CSS (F-18):** consolidar los tres bloques 760, eliminar el grid duplicado del hero y retirar `--inicio-border` si no se usa.

---

## 6. NOT RUN / límites de esta auditoría

- **No ejecuté** `npm run verify:fast`, `verify:static`, `verify:full` ni `verify:evidence`.
- **Sí ejecuté Playwright** (Chromium) a 1448×1086, 1366×768, 1341×800, 1340×800, 1281×800, 1280×800, 1200×800, 1101×800, 1100×800, 390×844, 320×640, xlarge 1448/390 y forced-colors 1448/390; con inyección de `$1,245.00` en los KPI. **No** son capturas dentro del repo; son verificación de esta auditoría.
- **Sí ejecuté axe** en normal y forced-colors (0 violaciones). No ejecuté la suite completa de 10 variantes de nuevo; leí `summary.json` y los JSON de variantes.
- **No verifiqué un HEAD limpio.** El buildSha coincide con `b8f127d`, pero el build se generó desde árbol sucio (10 modificados + nuevos). El `latest.json` existente es de `9206ea1` (`dirty:false`), no de este build.
- **La captura final normal** es del proceso actual (captura 19:55:57, servidor 19:54:43, CSS 19:52:59), pero **la captura `-hc` no es HC**; se explica en F-10.
- **No probé** Safari/Firefox, lectores de pantalla, hover/focus completos ni las rutas destino de los enlaces. Solo Chromium y los estados capturados.
- **No medí** perfil de color de los PNG; las diferencias de verde/crema pueden incluir gestión de color.
- **No validé** los assets contra hashes del manifiesto.

---

## 7. Conclusión final

Inicio **ya no tiene la placa blanca**, la marca creció, el CTA del hero y el de sugerencia tienen tamaño suficiente, el topbar mejoró, el checkmark está corregido y el modo forzado funciona cuando se activa correctamente. **No hay P0 ni P1**: los dos P1 anteriores son ahora P2. La pantalla es coherente, usable y sin overflow; `axe` está en 0.

**Pero no es paridad pixel-perfect.** Siguen visibles el ancho derecho corto, el papel picado sin sangrado, el corte inferior de Lupita, el KPI 3 en rosa/checklist, la indentación del nav, el tamaño visible de topbar/marca, la escala de apoyo y el salto de layout a 1340 con el CTA bajo el fold en 1280×800. Además, el archivo `-hc-viewport.png` no evidencia el alto contraste.

**Veredicto: APROBADO CON LIMITACIONES para calidad de Fase 1; RECHAZADO para paridad pixel-perfect.** No se declara “paridad conseguida”.
