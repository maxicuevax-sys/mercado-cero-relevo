# GOAL — Skills aplicadas a Mercado Cero

> Reformulado con **be-ambitious**: *más profundo, no más grande.*
> Este goal no trata de instalar diez repos. Trata de elegir las skills que muevan la aguja y demostrar su efecto en la app real.
> El contrato del producto vive en **`GOAL.md`**. El plan diario vive en **`PLAN-8-DIAS.md`**.

---

## 1 · La misión (una frase)

Usar las skills correctas para que Mercado Cero **se vea, se sienta y se demuestre** como un producto de pagos confiable —sin agregar módulos nuevos— y llegar al **7 de noviembre** con una demo que una persona ajena pueda operar sin ayuda.

La meta no es “tener más skills”. Es que cada skill deje un artefacto verificable: una pantalla mejor, un plan más claro, una prueba que pasa o un video que respalda la demo.

### Baseline medido (30 oct 2026, Lighthouse sobre `localhost:3000`)

| Métrica | Valor | Lectura |
|---|---|---|
| Accesibilidad | **96 / 100** | Ya es alta; el único fallo es contraste de color |
| Best practices | **100 / 100** | Sin errores de seguridad/consola en la carga |
| SEO | **100 / 100** | Metadatos correctos |
| Fallo principal | Contraste de color | Corregir sin romper la paleta paper/ink/terracotta |

El baseline no se inventa: se midió. La meta es mantener ≥ 90 y arreglar el contraste, no perseguir un 100 cosmético.

---

## 2 · Qué haría un top profesional (be-ambitious)

### 2.1 Lo que haría y no estamos pidiendo

1. **Auditar la app real antes de instalar nada.** Capturar la app corriendo en desktop y en un teléfono de 360 px, revisar consola, red, accesibilidad y los estados vacío/carga/error. La skill se elige después de ver el problema, no antes.
2. **Elegir 4 capas de trabajo por leverage, no 10 repos por moda.** Diseño, planificación, simplificación y rendimiento. Cada skill debe responder: ¿qué pantalla o decisión mejora?, ¿con qué evidencia lo demuestro?, ¿qué dejo de hacer para que quepa?
3. **Escribir el contraargumento.** Si la UI se ve más “premium” pero el flujo tarda más, confunde el estado pendiente o mete una tarjeta más, se revierte. La belleza sin claridad no cuenta.

### 2.2 La materia prima

- La app corriendo en `http://localhost:3000` y el túnel, no mockups.
- `web/src/app/globals.css` (tokens reales: paper, ink, green, terracotta, Fraunces + DM Sans).
- `web/src/components/caja-app.tsx` y las rutas de `web/src/app/api`.
- Capturas reales, consola del navegador, red, DOM, SQLite (`data/mercado-cero.db`), `npm run build` y `scripts/webhook-contract.mjs`.
- Los `SKILL.md` locales en `C:\Users\Elitebook 840 G8\.agents\skills\...`, no la imagen de estrellas.

### 2.3 Métodos y herramientas

- **UI UX Pro Max** → sistema visual, mobile-first, accesibilidad, componentes.
- **Impeccable** → `critique`, `distill`, `quieter`, `onboard`, `polish`, `harden` sobre la app existente.
- **design-taste-frontend / anti-slop** → inspección en navegador real, look-and-fix, prohibición de patrones genéricos de IA.
- **Superpowers** (`writing-plans`, `executing-plans`, `verification-before-completion`) → plan incremental y puertas de verificación.
- **Ponytail** → revisión lean, código muerto, simplificación.
- **Addy Osmani** (`frontend-ui-engineering`, `performance-optimization`, `code-review-and-quality`) → accesibilidad, responsive, rendimiento en teléfonos modestos.
- **Archify** (opcional) → un diagrama de arquitectura para el pitch/README.

### 2.4 Qué, fuera de nosotros, demuestra que está bien

- **Una persona ajena** completa: crear venta → generar link/QR → ver pendiente → confirmar pago → cerrar caja → apartar para una meta, **sin ayuda y en menos de 3 minutos**.
- **Un teléfono real de 360 px**: sin scroll horizontal, botones de al menos 44 px, texto legible con una mano.
- **Lighthouse** en la pantalla principal: accesibilidad ≥ 90, sin errores de consola, sin layout shift grave.
- **La demo grabada** y el runbook: si el internet o el banco fallan, hay respaldo.
- **El contrato del dinero** sigue en 27/27 y el build sigue limpio.

**Pasa** si el desconocido termina el flujo y las métricas se cumplen. **Falla** si la UI se ve mejor pero el flujo se entiende menos, o si la demo solo funciona en el desktop del desarrollador.

---

## 3 · Auditoría de las 10 skills (potencial real)

| Skill / repo | Qué aporta de verdad | Potencial en Mercado Cero | Decisión | Artefacto verificable |
|---|---|---|---|---|
| **Superpowers** (obra/superpowers) | Planificación, ejecución incremental, revisión y verificación | Alto: el proyecto ya está avanzado; evita que el pulido se vuelva caos | **Usar** las skills locales de planificación y verificación | Este goal + puertas de build/test/demo |
| **Ponytail** (DietrichGebert/ponytail) | Cambio mínimo, revisión senior, menos código | Alto: la app creció; hay que quitar ruido, no agregar capas | **Usar** al final, sobre los módulos nuevos | Revisión con hallazgos y código eliminado |
| **UI UX Pro Max** (nextlevelbuilder) | Sistema de diseño, patrones móviles, accesibilidad, estilos | Alto: define la capa visual que el jurado sí percibe | **Usar** como base del sistema y las pantallas | `DESIGN-SPEC.md` + capturas antes/después |
| **Graphify** | Grafo de código y dependencias | Medio/bajo: el código es pequeño; no necesitamos un grafo para navegarlo | **Omitir** salvo que un refactor lo justifique | — |
| **Caveman** | Compresión de tokens / estilo telegráfico | Bajo para el producto; sirve para documentos internos, no para la UI | **Omitir** del producto | — |
| **Addy Osmani Skills** | Calidad frontend, rendimiento, pruebas, accesibilidad | Alto: la demo corre en teléfonos modestos y con internet irregular | **Usar** para performance/accesibilidad | Checklist + métricas de Lighthouse/trace |
| **Understand Anything** | Comprensión de codebases | Bajo: se solapa con Graphify y con `explore` | **Omitir** | — |
| **Awesome Claude Skills** | Colección de skills | Bajo: no es un método, es un catálogo | **Omitir** | — |
| **Archify** | Diagramas de arquitectura, flujo y estados | Medio: un diagrama claro ayuda en el pitch y el README | **Opcional**, un solo diagrama | SVG/HTML que coincida con el código |
| **Impeccable** | Criticar, destilar, pulir, onboard, endurecer | Alto: es la capa de refinamiento de la app existente | **Usar** como auditoría de diseño | Informe de crítica + capturas finales |

### Selección final (6, no 10)

1. **UI UX Pro Max** — sistema visual y pantallas móviles.
2. **Impeccable** — crítica y pulido de la app real.
3. **design-taste-frontend / anti-slop** — la capa que elimina lo genérico de IA.
4. **Superpowers** — planificación y verificación.
5. **Ponytail** — simplificación y revisión lean.
6. **Addy Osmani** — accesibilidad y rendimiento.

**Opcional:** Archify para un diagrama del pitch.
**Fuera:** Graphify, Caveman, Understand Anything y Awesome Claude Skills. No porque sean malas, sino porque no atacan el cuello de botella de esta semana.

---

## 4 · Qué significa “instalar” aquí

- La skill **be-ambitious ya está instalada** en `C:\Users\Elitebook 840 G8\.agents\skills\be-ambitious`.
- El entorno ya expone `ui-ux-pro-max`, `impeccable`, `design-taste-frontend`, `ponytail`, `graphify`, `archify`, `writing-plans`, `executing-plans`, `verification-before-completion`, `frontend-ui-engineering` y `performance-optimization`.
- **No se clonan los 10 repos ni se corre `npm install -g` a ciegas.** Instalar duplicados añade ruido, dependencias y riesgo. Si falta una skill concreta, se lee su `SKILL.md` y se instala solo esa.
- Las estrellas de la imagen no son evidencia de calidad para este proyecto. La evidencia es la app corriendo y el `SKILL.md` real.

---

## 5 · Plan realista (30 oct → 7 nov)

| Día | Foco | Skill | Entregable verificable |
|---|---|---|---|
| **Hoy 30 oct** | Baseline: capturas desktop/360 px, consola, Lighthouse, inventario de pantallas y tokens | UI UX Pro Max + Impeccable | `DESIGN-SPEC.md` + capturas “antes” |
| **31 oct** | Flujo core: hero, voz, pedido, cobro, pendiente/pagado; anti-slop | UI UX Pro Max + anti-slop | Capturas “después”, 360 px sin scroll horizontal |
| **1 nov** | Mi negocio, corte de caja, Mi camino, guía/onboarding | Impeccable (`distill`, `onboard`, `polish`) | Un desconocido completa el flujo |
| **2 nov** | Accesibilidad y rendimiento en teléfono modesto | Addy Osmani | Lighthouse ≥ 90 en accesibilidad; sin errores de consola |
| **3 nov** | Validación de campo: 3–6 comerciantes; observar, no pitchear | Superpowers (plan) + investigación | Lista de 3 fricciones y cambios aplicados |
| **4 nov** | Revisión lean: código muerto, duplicación, estados | Ponytail | Hallazgos resueltos; build y 27/27 |
| **5 nov** | Runbook, video de respaldo, QR impreso, pitch | Superpowers + Impeccable | Video de 3 min y runbook |
| **6 nov** | 5 ensayos cronometrados; preguntas adversariales; congelar código | verification-before-completion | Demo < 3 min, sin tocar código después de las 9 pm |
| **7 nov** | Evento | — | Demo en vivo + respaldo |

---

## 6 · Criterios de pase/fallo

### UX / anti-slop

- [ ] Una persona ajena completa el flujo sin ayuda en **< 3 min**.
- [ ] No hay scroll horizontal a **360 px**.
- [ ] Botones principales ≥ **44 px**; texto secundario legible.
- [ ] Cada estado de pago es inequívoco: **pendiente ≠ pagado ≠ fiado**.
- [ ] Sin gradientes morado-azul, sin chatbot genérico, sin glassmorphism decorativo, sin tarjetas dentro de tarjetas sin función.
- [ ] La identidad se siente México contemporáneo, no folclor decorativo ni dashboard de IA.

### Accesibilidad / rendimiento

- [ ] Lighthouse accesibilidad **≥ 90** en la pantalla principal (baseline: 96).
- [ ] Corregir el fallo de contraste detectado en el baseline.
- [ ] Navegación por teclado y foco visible en los controles principales.
- [ ] `prefers-reduced-motion` respetado.
- [ ] Sin errores de consola en el flujo core.
- [ ] La app es usable en un teléfono de gama media con red lenta; si no se puede medir, se reporta.

### Dinero / demo

- [ ] Build limpio.
- [ ] Webhook **27/27**.
- [ ] Pago real de $0.01 **o** demo claramente etiquetada; nunca un simulado presentado como banco.
- [ ] Video de respaldo y runbook listos.
- [ ] Cero afirmaciones de custodia, acceso a cuentas familiares o pronósticos inventados.

---

## 7 · El encargo reformulado (be-ambitious)

```text
Quiero que Mercado Cero se vea y se sienta como un producto de pagos confiable, no como
una demo de IA, sin agregar módulos nuevos. Trabaja desde la app real: `globals.css`,
`caja-app.tsx`, las rutas API, capturas en desktop y 360 px, consola, red, Lighthouse y
SQLite. No empieces por instalar diez repos.

Elige solo estas capas: UI UX Pro Max para el sistema visual y móvil; Impeccable para
criticar, destilar y pulir la app existente; design-taste-frontend/anti-slop para eliminar
patrones genéricos con inspección en navegador real; Superpowers para planear y verificar;
Ponytail para simplificar; Addy Osmani para accesibilidad y rendimiento. Omite Graphify,
Caveman, Understand Anything y Awesome Claude Skills salvo que un problema concreto lo
justifique. La skill be-ambitious ya está instalada; no la dupliques.

Audita primero, propone después. Cada cambio debe dejar evidencia: captura antes/después,
medición o prueba. No rehagas la app desde cero, no agregues features y no sacrifiques
claridad por estética.

Se considera logrado solo si: (a) una persona ajena completa venta → cobro → confirmación →
corte → apartado en menos de 3 minutos sin ayuda; (b) a 360 px no hay scroll horizontal y
los controles principales son táctiles; (c) Lighthouse de accesibilidad ≥ 90 y no hay
errores de consola en el flujo core; (d) el build sigue limpio y el webhook sigue en 27/27;
(e) hay video de respaldo y runbook. Si algo no pasa, se recorta el alcance antes que
maquillar la demo.
```

---

## 8 · Pasada UI ejecutada (30 oct 2026): “Mercado de papel”

La app dejó de ser un dashboard fintech genérico y se convirtió en un **objeto editorial de mercado**: papel, tinta verde, sello terracota, recibo, libreta y tarjeta de metas.

### Qué se extrajo de cada referencia

| Fuente | Qué se tomó | Qué se rechazó |
|---|---|---|
| **mono-color-skill** | Un solo ink dominante (verde botánico), acento terracota, papel visible, halftone, 25–55% de silencio, tipografía con tensión | Más de dos tintas, degradados, 3D, mockups glossy, collage |
| **taste-skill** | App v2.1: paneles silenciosos, cifras alineadas, color solo en datos, headline de 2 líneas, primera acción visible, anti-slop | Fotos decorativas, tarjetas idénticas, eyebrows, micro-labels |
| **Asli** | Fotografía real, duotono/halftone, tipografía editorial, recibo/sello, transiciones y gestos con intención | Cursor custom, WebGL/Curtains, Lenis con scroll hijack, GSAP pesado, Isotope, Photoswipe, dat.GUI |

### Implementado

- **Hero asimétrico** con foto real de tianguis en duotono, sello “Mercado Cero”, cero como timbre, headline de 5 palabras y CTA **Cobrar ahora** visible en el primer pantallazo.
- **Caja hablada como recibo**: bloque de tinta verde, botón de micrófono de papel, frases de ejemplo subrayadas, borde dentado de recibo.
- **Cobro como ticket**: filas de recibo, QR, estados pendiente/pagado, y overlay con sello **PAGADO / DEMO / FIADO**.
- **Mi negocio como libreta**: total editorial, comparación con sello, cifras alineadas, barras de tinta, mejor día y hora.
- **Corte de caja como hoja de conteo**: base, ventas, gastos, retiros, “debería haber”, conteo por denominaciones y sello **CUADRA / DIFERENCIA**.
- **Mi camino como tarjeta de perforación**: meta de la sombrilla, 8 círculos, aportación y foto de flores.
- **Banda editorial de cierre** con foto de tianguis y la frase: “El mercado no necesita más apps. Necesita certeza.”
- **Sistema**: fondo paper plano, `--color-muted` más oscuro para contraste, sin glass, sombras reducidas, labels a 14 px, foco visible, `prefers-reduced-motion`.

### Evidencia

- **Lighthouse: 100 accesibilidad · 100 best practices · 100 SEO**, sin fallos.
- **Tasteskill inspector**: 6 FAIL / 8 WARN restantes. Son reglas de landing page o decisiones intencionales: el scrim de la foto, las reglas de libreta/recibo, el cuerpo a 14 px, las 3 fotos y el punto focal. Los fallos objetivos ya se corrigieron: contraste, texto < 12 px, headline de 2 líneas, glass, sombras, contenido oculto.
- **Build limpio** y **webhook 27/27**.
- Tarjeta, link, QR, efectivo, fiado, corte y meta probados en navegador real.
- **Auditoría 360 px emulada:** 25/25 checks, sin scroll horizontal en cada estado, sin texto < 12 px, controles principales ≥ 40 px, flujo completo en 10.2 s en producción (10–17 s en dev), 0 errores de consola.
- **Checkout público 360 px:** 15/15 checks, tres métodos, pago demo y pantalla de éxito; Lighthouse 100/100/100.
- **Túnel HTTPS:** 8/8 checks por Cloudflare: reset, checkout, pago demo y estado pagado.
- **Ensayo automatizado:** 3/3 corridas, 15/15 pasos, promedio 4.8 s de flujo mecánico, 0 errores de consola.
- **Video de respaldo:** `demo/mercado-cero-demo.mp4` (34 s, 1280×800, 1.4 MB) con subtítulos.
- **QR imprimible:** `demo/qr-demo.pdf` y `demo/qr-demo.png` (túnel actual; regenerar si cambia).
- **Runbook:** `RUNBOOK-DEMO.md`. **Prueba de usuario:** `TEST-USUARIO.md`.
- Créditos de fotos en `web/CREDITS.md` y `web/public/credits.txt`, con licencias y enlaces.

### Lo que falta en UI

- Probar en un **teléfono físico** de 360 px; la auditoría actual es emulación Playwright.
- Prueba con una persona ajena siguiendo `TEST-USUARIO.md`.
- Decidir si una cuarta foto aporta a “Mi negocio” o solo decora; por ahora 3 es suficiente para una app de trabajo.
- Revisar el solape del nav fijo en capturas largas; en el primer viewport no tapa contenido.

---

## 9 · Lo que no se hace

- No instalar las 10 skills ni convertir el repo en una colección.
- No rediseñar desde cero ni cambiar el stack.
- No agregar módulos, catálogo, WhatsApp, offline completo ni permisos familiares.
- No usar una skill como prueba: la prueba es la app corriendo, el desconocido usándola y el video.
- No perseguir un Lighthouse bonito a costa de la claridad del cobro.
- No mostrar datos demo sin la etiqueta **“Datos demo”**.

La regla es simple: **cada skill debe dejar la app más clara, más rápida de entender o más difícil de romper. Si no, no entra.**
