# HIG-AUDIT — Línea base de Mercado Cero

> **Fecha:** 31 de octubre de 2026.
> **Código auditado:** commit `4d33a46` (`baseline: Mercado de papel antes de HIG`), tag `pre-hig`.
> **Skill:** `apple-hig`, commit `620071d8bae04bc18839fb3553d50aa5b8052f71`, snapshot del 25 de octubre de 2026.
> **Servidor:** `npm start` en `http://localhost:3000`.
> **Herramientas:** Playwright (Chromium), axe-core 4.10.2, Lighthouse 13.6.0.
> **Regla:** no se modificó la UI en esta fase. Las capturas y el JSON viven en `demo/hig-before/`.

---

## 1 · Resumen ejecutivo

La app ya tiene una base sólida: **no hay scroll horizontal** en 360/390/768/1280, **no hay texto visible menor a 12 px**, **no hay controles sin nombre accesible**, el contraste por defecto pasa axe/Lighthouse y el flujo de dinero no se tocó. Eso no es poco.

Pero la interfaz actual **no pasa una adaptación HIG seria** por cinco razones:

1. **El texto al 200% rompe la pantalla.** La home y el checkout se solapan, se cortan y cambian el viewport. Es un bloqueante de accesibilidad, no un detalle.
2. **La guía y el overlay de pago no manejan el foco.** El foco se queda detrás del diálogo, Tab recorre la página de fondo, Escape no cierra la guía y el overlay de pago no tiene `role="dialog"`. Un usuario de teclado o lector de pantalla no puede operar la confirmación.
3. **La tarea principal no está primero.** A 360×800, `#caja` empieza en `top: 765`; el primer viewport es marca, foto y hero. La comerciante tiene que saltar para cobrar.
4. **El papel y los sellos compiten con los datos.** Grano, halftone, borde de recibo, sellos rotados y hero editorial dan identidad, pero también ruido y una jerarquía que no es la de una herramienta de mostrador.
5. **La semántica de color y de estado no es confiable.** Terracota se usa para marca, fiado, demo y error; el token `--color-yellow` es el mismo terracota; demo y pagado comparten el mismo lenguaje de éxito verde. La comerciante no debería tener que leer un sello para saber si el dinero es real.

**Decisión:** no se pasa a F2 sin resolver estos cinco puntos en el contrato de diseño. El resto son hallazgos mayores, pero no bloquean la demo de noviembre.

---

## 2 · Cómo se midió

| Vista | 360×800 | 390×844 | 768×1024 | 1280×800 |
|---|---|---|---|---|
| Home, guía, checkout | ✅ | ✅ | ✅ | ✅ |
| Flujo completo (caja, cobro, pago, fiado, verificación, corte, meta) | ✅ | — | — | ✅ |
| Texto al 200% | ✅ | ✅ | ✅ | ✅ |
| Checkout al 200% | ✅ | — | — | — |
| axe-core | ✅ | ✅ | ✅ | ✅ |
| Lighthouse | ✅ mobile | — | — | — |

**Limitaciones declaradas:** no se probó VoiceOver ni Safari iOS; no hay teléfono físico; NVDA no se ejecutó; el 200% del checkout solo se midió a 360; el teclado se recorrió parcialmente (10–12 Tabs por pantalla). Todo eso queda como **NOT EXECUTED**, no como aprobado.

---

## 3 · Métricas base

| Vista | scroll | texto <12 | texto <14 | texto <17 | targets <44 | axe | Escape en guía |
|---|---:|---:|---:|---:|---:|---:|---|
| 360 | 360/360 | 0 | 3 | 210 | 9 | 0 | ❌ |
| 390 | 390/390 | 0 | 3 | 210 | 8 | 0 | ❌ |
| 768 | 768/768 | 0 | 3 | 212 | 8 | 0 | ❌ |
| 1280 | 1280/1280 | 0 | 3 | 208 | 8 | 0 | ❌ |

- Los 3 textos `<14 px` son créditos de fotos a **12.8 px**; no hay texto menor a 12 px.
- Los targets `<44 px` son, sobre todo, **inputs de 40 px de alto**, el enlace “Fotos: créditos” de 18 px y un botón de 39 px.
- `#caja` empieza en `top: 765` a 360×800: solo se ven 35 px antes del pliegue.
- **Lighthouse mobile:**
  - Caja: performance **85**, LCP **3.4 s**, CLS **0.002**, TBT **320 ms**.
  - Checkout: performance **71**, LCP **2.7 s**, CLS **0.497**, TBT **230 ms**.

---

## 4 · Hallazgos

### HIG-01 · Bloqueante · Los diálogos no atrapan ni devuelven el foco

- **Superficie:** Guía (`HelpDialog`, `caja-app.tsx:2510`) y confirmación de pago (`PaidOverlay`, `caja-app.tsx:3063`).
- **Evidencia:** `demo/hig-before/audit.json` → `helpInitialFocus`, `helpFocus`, `paidInitialFocus`, `paidFocus`; capturas `help-360.png`, `paid-360.png`.
- **Qué pasa:**
  - Al abrir la guía, el foco sigue en “Abrir guía”, **fuera** del diálogo. Tab recorre “Cobrar ahora”, el micrófono y las frases de ejemplo, todos detrás del overlay.
  - `Escape` **no cierra** la guía (`helpClosedWithEscape: false`).
  - El overlay de pago **no tiene `role="dialog"`** (`paidDialogs: 0`); el foco está en `BODY` y Tab va a “Nuevo cobro”, “Cerrar” y “Registrar abono”, detrás del overlay.
  - axe marca `region` (moderate, 7 nodos) en el overlay de pago: el contenido no está dentro de un landmark.
- **Tema HIG:** [Modality](https://developer.apple.com/design/human-interface-guidelines/modality), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [VoiceOver](https://developer.apple.com/design/human-interface-guidelines/voiceover).
- **Corrección:** un solo patrón de sheet/dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, foco al primer control o al título, trampa de foco, `Escape` para cerrar, foco de vuelta al disparador y contenido dentro de `main`/landmark. El overlay de pago debe anunciar el estado con `aria-live` o mover el foco al título.
- **Check:** abrir guía → foco dentro; Tab no sale; Escape cierra; foco vuelve a “Abrir guía”. Pagar → foco en el sheet; Tab no sale; cerrar → foco vuelve a “Cobrar”.

### HIG-02 · Bloqueante · El texto al 200% rompe la home y el checkout

- **Superficie:** Home, checkout.
- **Evidencia:** `home-360-text200.png`, `home-1280-text200.png`, `checkout-360-text200.png`; `audit.json` → `homeText200.clippedText`.
- **Qué pasa:**
  - A 360, la marca se parte en varias líneas, la ficha de comerciante muestra “A / C” en vertical, el hero se corta y la tab bar solapa “Corte” y “Camino”.
  - El checkout al 200% expande `innerWidth` a **457**, corta el total (“$120.0…”), trunca “Antojitos…” y deja 18 bloques de texto recortados.
  - El documento sigue midiendo 360/360 porque `overflow-x-hidden` esconde el problema; el test de scroll horizontal por sí solo no lo detecta.
- **Tema HIG:** [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout).
- **Corrección:** escala tipográfica semántica en `rem`, contenedores que crecen, prohibición de alturas fijas en texto, truncado solo para datos secundarios y reflujo real a 200%. Probar home, sheet, checkout y éxito.
- **Check:** a 200% no hay texto recortado, solapado ni acciones perdidas; el ancho de layout sigue siendo el del viewport; captura y medición.

### HIG-03 · Mayor · La tarea principal empieza debajo del pliegue

- **Superficie:** Home 360/390.
- **Evidencia:** `#caja` top **765 px** en viewport de 800; `home-360-fold.png`.
- **Qué pasa:** el primer viewport es marca, ficha, hero y foto. “Cobrar ahora” es un ancla, pero la caja real no está a la vista. La comerciante tiene que entender que el botón salta a otra parte.
- **Tema HIG:** [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles), [Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout).
- **Corrección:** Caja como destino inicial. La marca y la foto se mueven a una bienvenida/ayuda o a la parte inferior; la voz y el pedido son el primer viewport. Si se conserva el hero, que no ocupe más de una franja y que la caja empiece antes de 400 px.
- **Check:** a 360×800, el control de voz y el inicio de la caja son visibles sin scroll; “Cobrar” no necesita un salto.

### HIG-04 · Mayor · El papel y los sellos compiten con los datos

- **Superficie:** Home, caja, cobro, fiado, corte, meta, éxito.
- **Evidencia:** `globals.css` (`.grain`, `.halftone`, `.receipt-edge`, `.stamp`, `.stamp-in`), capturas `home-360-fold.png`, `payment-360.png`, `paid-360.png`.
- **Qué pasa:** grano fijo, foto halftone, bordes de recibo, sellos rotados y tipografía editorial conviven con cifras y estados. La identidad es fuerte, pero la jerarquía no siempre distingue “marca” de “dato” y “acción”.
- **Tema HIG:** [Branding](https://developer.apple.com/design/human-interface-guidelines/branding), [Color](https://developer.apple.com/design/human-interface-guidelines/color), [Motion](https://developer.apple.com/design/human-interface-guidelines/motion).
- **Corrección:** retirar estas metáforas de la ruta transaccional; conservar una sola foto y una sola frase editorial fuera del cobro. La identidad se expresa en el mark 0, el verde y el copy, no en cada tarjeta.
- **Check:** `grep` de `receipt-edge|halftone|stamp|grain` en UI de producción = 0; una sola foto en el producto, fuera de la ruta de cobro.

### HIG-05 · Mayor · La navegación son anclas disfrazadas de tabs

- **Superficie:** Bottom nav.
- **Evidencia:** `caja-app.tsx:960-985`; `aria-current` no existe en el proyecto; el desktop no tiene navegación equivalente.
- **Qué pasa:** Caja/Fiado/Corte/Camino son enlaces a secciones de una página larga. No conservan estado por destino, no exponen el destino actual a tecnologías de asistencia y en desktop desaparecen.
- **Tema HIG:** [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout).
- **Corrección:** cuatro destinos reales con estado y scroll propios; `aria-current="page"` en el activo; en desktop, sidebar o navegación equivalente. Si se mantiene una sola página, llamarla “índice de secciones”, no tab bar.
- **Check:** cambiar de destino y volver conserva estado; el activo se anuncia; desktop tiene la misma estructura.

### HIG-06 · Mayor · El color no tiene una semántica única

- **Superficie:** Estados, badges, fiado, errores, demo.
- **Evidencia:** `globals.css:14-18` (`--color-terracotta`, `--color-yellow` con el mismo valor), usos de terracota en `StatusBadge`, fiado, demo y errores.
- **Qué pasa:** terracota significa marca, atención, fiado, demo y error a la vez. `--color-yellow` no es amarillo. El estado depende del contexto y del texto, no de un rol estable.
- **Tema HIG:** [Color](https://developer.apple.com/design/human-interface-guidelines/color), [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback).
- **Corrección:** tokens semánticos: `accent` (verde), `success` (solo pago real), `attention` (fiado/pendiente/demo), `danger` (error/destructivo), `info`; estados con texto + icono + forma.
- **Check:** ningún componente usa terracota para dos significados; demo y real no comparten token de éxito; contraste medido.

### HIG-07 · Mayor · El cobro móvil es un panel largo, no una tarea enfocada

- **Superficie:** `PaymentPanel` en compacto.
- **Evidencia:** `payment-360.png`, `link-360.png`; el panel aparece debajo de la caja y contiene QR, link, aviso, botones demo y “Cerrar cobro”.
- **Qué pasa:** el cobro es el momento de mayor consecuencia y se presenta como una tarjeta más en una página larga, sin una entrada/salida modal clara. El usuario puede perder el contexto o tocar “Cerrar” sin un contrato de qué pasa.
- **Tema HIG:** [Modality](https://developer.apple.com/design/human-interface-guidelines/modality), [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets), [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons).
- **Corrección:** sheet de cobro en compacto: monto, estado, QR/link, un primario, un secundario, salida explícita; el estado se conserva al cerrar. En regular, columna inline.
- **Check:** abrir/cerrar el cobro conserva el pedido; un solo primario; no hay dos “cerrar” con efectos distintos.

### HIG-08 · Mayor · El feedback crítico vive en toasts que tapan contenido

- **Superficie:** Toast, pago, errores.
- **Evidencia:** `Toast` (`caja-app.tsx:3146`), `showToast` con 4 s; captura `mobile-360-corte.png` de la corrida anterior mostraba el error sobre el corte.
- **Qué pasa:** el toast es la vía principal para errores y confirmaciones; se superpone al contenido y desaparece. No hay un estado durable junto a la acción. El cambio de “pendiente” a “pagado” no tiene `aria-live` ni foco.
- **Tema HIG:** [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback), [Loading](https://developer.apple.com/design/human-interface-guidelines/loading), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).
- **Corrección:** banner inline para errores/estados; toast solo para lo no crítico; `role="status"`/`aria-live` para el estado del pago; no tapar la acción que el usuario necesita.
- **Check:** error de verificación visible junto al campo; pago confirmado anunciado; el toast no cubre un CTA.

### HIG-09 · Mayor · La tipografía no tiene roles semánticos ni cuerpo HIG

- **Superficie:** Toda la app.
- **Evidencia:** 210 bloques de texto `<17 px` a 360; cuerpo y labels en `text-sm` (14 px); títulos en Fraunces; captions 12.8 px.
- **Qué pasa:** hay una escala visual, pero no una escala semántica: el mismo `text-sm` se usa para cuerpo, labels, metadatos y botones. El cuerpo de 14 px es pequeño para una herramienta de mostrador y para la adaptación HIG (body 17 pt).
- **Tema HIG:** [Typography](https://developer.apple.com/design/human-interface-guidelines/typography).
- **Corrección:** roles `display/title/headline/body/callout/footnote/caption`; body 17 px, footnote 13 px, caption 12 px solo no esencial; Fraunces solo marca/hero.
- **Check:** medición de tamaños por rol; 200% sin pérdida; labels no se confunden con cuerpo.

### HIG-10 · Mayor · Targets de 40 px y un enlace de 18 px

- **Superficie:** Inputs, tabs, créditos.
- **Evidencia:** `audit.json` → `under44`: inputs 40 px, tabs 40 px, “Fotos: créditos” 18 px, un botón de 39 px.
- **Qué pasa:** la mayoría de los botones cumplen 44, pero los campos y tabs no; el enlace de créditos es un target de 18 px. En una mano y con prisa, 40 px es menos tolerante.
- **Tema HIG:** [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).
- **Corrección:** 44×44 mínimo en todo control interactivo; inputs con altura 44; tabs con área de 44; créditos dentro de un enlace con padding.
- **Check:** `under44Count = 0` en todas las superficies y viewports.

### HIG-11 · Mayor · El checkout no tiene `h1` y tiene CLS 0.497

- **Superficie:** `/pay/[id]`.
- **Evidencia:** axe `page-has-heading-one` (moderate, 1 nodo); Lighthouse checkout: performance 71, LCP 2.7 s, CLS **0.497**.
- **Qué pasa:** la página no tiene un encabezado de nivel 1; el contenido principal se desplaza casi medio viewport durante la carga, probablemente por el intercambio de fuentes (`display: swap`). En un pago, la inestabilidad visual es desconfianza.
- **Tema HIG:** [VoiceOver](https://developer.apple.com/design/human-interface-guidelines/voiceover), [Typography](https://developer.apple.com/design/human-interface-guidelines/typography), [Loading](https://developer.apple.com/design/human-interface-guidelines/loading).
- **Corrección:** `h1` con el nombre del comercio o “Pagar pedido”; `size-adjust`/fallback de fuentes, preload o `display: optional` para el checkout; reservar el espacio del layout.
- **Check:** axe 0; CLS <0.1; LCP <2.5 s; el total no se mueve.

### HIG-12 · Mayor · El reset de demo es una acción de desarrollador en el header

- **Superficie:** Header.
- **Evidencia:** `caja-app.tsx:700-708`; botón de refresh junto a la ficha y la guía; no hay confirmación.
- **Qué pasa:** un toque accidental borra el estado de la demo en medio de una venta. Es una acción destructiva y no pertenece al mismo nivel que “Guía”.
- **Tema HIG:** [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons), [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts), [Modality](https://developer.apple.com/design/human-interface-guidelines/modality).
- **Corrección:** moverlo a un sheet “Modo demo” con confirmación explícita (“Reiniciar datos de demo”) y consecuencias; en producción, ocultarlo.
- **Check:** no se puede resetear con un solo toque; la confirmación explica qué se pierde.

### HIG-13 · Mayor · La voz y el chime no se pueden silenciar

- **Superficie:** Caja, pago, consultas.
- **Evidencia:** `speak()` usa `speechSynthesis` en venta, pago y consulta; `playChime()` en pago; no hay control de mute.
- **Qué pasa:** la app habla y suena en un mercado ruidoso, frente al cliente, sin una forma de apagarlo. La alternativa visual existe, pero falta control.
- **Tema HIG:** [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility), [Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio), [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback).
- **Corrección:** “Silenciar voz” persistente en el header o en ajustes; recordar la preferencia; el estado visual sigue siendo la fuente de verdad.
- **Check:** silenciar detiene `speechSynthesis` y el chime; la confirmación visual permanece; la preferencia sobrevive a la recarga.

### HIG-14 · Menor · El acordeón de la guía no expone su estado

- **Superficie:** Guía.
- **Evidencia:** `caja-app.tsx:2584-2596`; no hay `aria-expanded` ni `aria-controls`.
- **Qué pasa:** un lector de pantalla no sabe si una pregunta está abierta o cerrada.
- **Tema HIG:** [Disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls), [VoiceOver](https://developer.apple.com/design/human-interface-guidelines/voiceover).
- **Corrección:** `aria-expanded`, `aria-controls`, región con `id`; el chevron es decorativo.
- **Check:** axe 0; el estado se anuncia al abrir/cerrar.

### HIG-15 · Menor / no ejecutado · Safe area inferior no está implementada

- **Superficie:** Bottom nav.
- **Evidencia:** `caja-app.tsx:960`; no hay `env(safe-area-inset-bottom)` ni `viewport-fit=cover` en el proyecto.
- **Qué pasa:** en un iPhone con home indicator, la tab bar puede quedar demasiado cerca del borde. No se probó en dispositivo; es una hipótesis de layout, no un defecto confirmado.
- **Tema HIG:** [Layout](https://developer.apple.com/design/human-interface-guidelines/layout), [Designing for iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios).
- **Corrección:** `padding-bottom: max(12px, env(safe-area-inset-bottom))`; `viewport-fit=cover` si se quiere full-bleed; probar en iPhone real.
- **Check:** la tab bar no se solapa con el home indicator; **NOT EXECUTED** hasta tener dispositivo.

---

## 5 · Lo que sí pasa

- **Sin scroll horizontal** en 360/390/768/1280 y en los estados del flujo completo.
- **Sin texto visible <12 px**; los únicos 12.8 px son créditos de fotos.
- **Sin controles sin nombre accesible** (`unnamedCount = 0`).
- **axe 0** en home, guía y checkout pagado; **1 moderate** en checkout inicial (`h1`); **1 moderate** en overlay de pago (`region`).
- **Contraste por defecto:** Lighthouse 100 accesibilidad; no hay violaciones de contraste en axe.
- **`prefers-reduced-motion`** existe y desactiva animaciones/scroll suave.
- **Privacidad del micrófono:** `getUserMedia` se pide al pulsar, no al cargar.
- **Targets del checkout:** 0 menores a 44 px (tras la corrección de tipografía).
- **Flujo de dinero:** no se tocó; el contrato 27/27 se re-ejecuta en F5/F6, no en esta fase.

---

## 6 · Prioridades para F2

| Prioridad | Hallazgos | Qué debe quedar en `HIG-DESIGN.md` |
|---|---|---|
| **P0** | HIG-01, HIG-02 | Contrato de sheet/dialog con foco, Escape, retorno y `aria-live`; escala tipográfica con reflujo 200% |
| **P1** | HIG-03, HIG-04, HIG-05, HIG-06, HIG-07, HIG-08, HIG-09, HIG-10, HIG-11, HIG-12, HIG-13 | Shell task-first, tabs/destinos, tokens semánticos, sheet de cobro, feedback inline, tipos/targets, checkout `h1`/CLS, reset seguro, mute |
| **P2** | HIG-14, HIG-15 | ARIA del acordeón; safe area en dispositivo |

---

## 7 · Lo que no se ejecutó

- VoiceOver en macOS/iOS; NVDA en Windows.
- Safari iOS y Chrome Android en dispositivo físico.
- Safe area real y comodidad táctil.
- 200% del checkout a 390/768/1280 (solo 360).
- Flujo completo de teclado más allá de 10–12 Tabs por pantalla.
- Performance en un Android de gama media real.
- Prueba con persona ajena (F6).
- Webhook 27/27 en esta fase (se re-ejecuta en F5/F6).

Estos puntos se reportan como **NOT EXECUTED**, no como aprobados. La ausencia de evidencia no es evidencia de que estén bien.

---

## 8 · Veredicto

La app está lista para una demo funcional, pero **no está lista para decir que sigue HIG**. La distancia no es cosmética: hay dos bloqueantes de accesibilidad, una tarea principal fuera del primer viewport y una semántica de confianza que mezcla demo, fiado y error.

**Siguiente paso:** F2 — escribir `HIG-DESIGN.md` con el sistema “Mostrador claro” y resolver P0/P1 antes de tocar un componente. No se implementa nada en F1.
