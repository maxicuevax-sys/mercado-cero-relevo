# GOAL-HIG — Mostrador claro

> **Estado: F0 baseline y F1 auditoría completados el 31 de octubre de 2026. F2 contrato escrito en `HIG-DESIGN.md`, pendiente de aprobación. F3+ PARKED: no se toca la UI antes del 7 de noviembre sin una decisión explícita.** La evidencia base está en `HIG-AUDIT.md` y `demo/hig-before/`.
>
> Reescrito con **be-ambitious**: más profundo, no más grande.
> Base de diseño: **apple-hig** de `AyushRajSinghParihar/apple-human-interface-skills`, commit `620071d8bae04bc18839fb3553d50aa5b8052f71` (snapshot del 25 de octubre de 2026, MIT, proyecto no afiliado a Apple).
> Este documento es el contrato de la **interfaz**. Los invariantes de dinero, webhook y demo siguen viviendo en **`GOAL.md`** y no se tocan.

---

## 1 · La misión en una frase

Rediseñar **toda** la interfaz de Mercado Cero para que una comerciante de 50 años, con una mano, bajo el sol y con prisa, entienda en cinco segundos qué hacer, cobre sin miedo y distinga **pendiente** de **pagado**; usando los principios de Apple HIG como disciplina de claridad, jerarquía, tacto, accesibilidad y retroalimentación, **no como disfraz de iOS**.

La frase que debe poder decir alguien al terminar:

> “Esto se siente como una herramienta de mostrador. No como una app de banco. No como un cuaderno de papel. Como algo que ya sabía usar.”

### Lo que cambia y lo que no

| Se va | Se queda |
|---|---|
| El papel, el grano, el halftone, el borde de recibo, los sellos rotados y el hero editorial que empuja la caja abajo. | La tesis: **certeza, voz, efectivo y fiado**. |
| La página larga con secciones y anclas que se hacen pasar por tabs. | El verde Mercado Cero, el **mark 0** (no el sello rotado) y el español de mercado. |
| El reset de demo escondido en el header y los avisos que tapan contenido. | La verdad del dinero: demo se declara; pagado solo con webhook. |
| La mezcla de terracota como marca, error y fiado. | La calidez de una sola foto y una sola frase editorial, fuera del camino transaccional. |

**Nombre de la dirección:** **Mostrador claro**. Una superficie limpia, cálida y directa, con la jerarquía de una buena herramienta y la memoria visual de un mercado mexicano.

---

## 2 · La decisión que sirve

El rediseño no sirve para “parecer Apple”. Sirve para que la comerciante:

1. cobre una venta en menos de 60 segundos sin aprender un menú;
2. sepa si el dinero **llegó** o solo se **declaró**;
3. cierre el día sin reconstruir la verdad en una libreta;
4. pueda usar la app con una mano, con letra grande, sin depender del color ni del audio.

**Métrica de la decisión:** una persona que nunca vio la app completa una venta y explica “pendiente no es pagado” sin ayuda. Si el rediseño es más bonito pero tarda más o confunde más, falló.

---

## 3 · Lo que haría un profesional top que no estamos pidiendo

1. **Auditar antes de diseñar, y medir antes y después.** No “aplicar HIG” a ojo: inventariar cada superficie, estado y error contra los topic skills; capturar 360/390/768/1280; correr Lighthouse, axe, teclado y lector de pantalla; registrar la línea base. El rediseño empieza con evidencia, no con un moodboard.
2. **Diseñar la máquina de estados, no la pantalla.** Cada acción tiene idle, cargando, éxito, error, vacío, deshabilitado y “sin conexión”. La belleza está en que el estado nunca miente. Un pago simulado no puede verse igual que uno confirmado por pey.
3. **Tratar la accesibilidad como arquitectura, no como checklist final.** 200% de texto, 44×44 px, contraste medido, foco visible, teclado completo, nombres accesibles, movimiento reducido y alternativa textual a la voz. Si una acción esencial desaparece al crecer el texto, el diseño no está terminado.
4. **Proteger la confianza antes que la estética.** El sello **DEMO** no es decoración: es una promesa. El estado “pagado” real y el simulado deben tener tratamientos distintos; ninguna animación, color o copy puede insinuar un pago que no ocurrió.
5. **Probar con una persona ajena y con el riel real cuando exista.** La opinión del modelo no sustituye el comportamiento de una comerciante. La evidencia es tiempo de tarea, errores, frases textuales y un webhook 34/34 que sigue intacto.

---

## 4 · Materia prima (de dónde se parte)

### 4.1 Fuente de diseño

- **Skill instalable:** `npx skills add AyushRajSinghParihar/apple-human-interface-skills --skill apple-hig`.
- **Commit fijado:** `620071d8bae04bc18839fb3553d50aa5b8052f71`. No usar “latest” durante el rediseño.
- **Snapshot:** 25 de octubre de 2026, 158 artículos, 13 familias. Es una guía comunitaria; la fuente final sigue siendo Apple.
- **Licencia/atribución:** MIT para el código y la guía; la documentación de Apple sigue siendo de Apple. Citar repo y fuente; no copiar artículos completos.
- **Caveat obligatorio:** HIG describe plataformas Apple. Esta app es web. Se **adaptan principios** (jerarquía, tacto, accesibilidad, retroalimentación, privacidad), no se copian APIs, materiales ni iconos de Apple. El documento de diseño debe incluir una sección “Adaptación a web”.

### 4.2 Fuente del producto

- `web/src/components/caja-app.tsx` — shell, caja, cobro, fiado, corte, meta, verificación, ayuda, overlay y toast.
- `web/src/app/globals.css` — tokens “Mercado de papel”, grano, recibo, sellos, halftone, movimiento.
- `web/src/app/pay/[id]/checkout-client.tsx` y `success/success-client.tsx` — checkout público y éxito.
- `web/src/app/layout.tsx`, `page.tsx` — fuentes, metadata y entrada.
- `web/scripts/mobile-audit.py`, `checkout-audit.py`, `tunnel-smoke.py`, `rehearse-demo.py` — evidencia actual.
- `demo/mobile-360-*.png`, `demo/checkout-360-*.png`, `demo/mercado-cero-demo.mp4` — línea base visual.
- `TEST-USUARIO.md`, `demo/feedback.md` — comportamiento humano, no opinión.

### 4.3 Fuente de verdad del dinero

- `GOAL.md` (invariantes), `web/src/lib/pey-events.ts`, `web/src/app/api/webhooks/pey/route.ts`, `web/scripts/webhook-contract.mjs`.
- **No se modifican** en este goal. Si el rediseño toca un estado de pago, se valida contra el contrato 34/34.

---

## 5 · Ruta HIG: 12 temas, no 158

Se leen los procedimientos completos, no solo el README. Cada decisión de diseño debe poder rastrearse a un tema y a una fuente oficial.

| # | Tema | Para qué en Mercado Cero | Fuente oficial |
|---|---|---|---|
| 1 | Design principles | Resolver propósito vs. agencia, simplicidad vs. densidad, delight vs. familiaridad | https://developer.apple.com/design/human-interface-guidelines/design-principles |
| 2 | Designing for iOS | Uso en mano, interrupción, una mano, teclado en pantalla, safe areas | https://developer.apple.com/design/human-interface-guidelines/designing-for-ios |
| 3 | Accessibility | 200% texto, contraste, voz, movimiento, alternativas de entrada | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| 4 | Typography | Roles semánticos, jerarquía, crecimiento del texto, fuentes | https://developer.apple.com/design/human-interface-guidelines/typography |
| 5 | Color | Semántica, estados, contraste, color no único portador | https://developer.apple.com/design/human-interface-guidelines/color |
| 6 | Layout | Jerarquía, reflujo, safe areas, tamaño de pantalla, espacios | https://developer.apple.com/design/human-interface-guidelines/layout |
| 7 | Motion | Movimiento con significado, interrupción, reduced motion | https://developer.apple.com/design/human-interface-guidelines/motion |
| 8 | Branding | Identidad sin desplazar la tarea; una sola marca, no ruido | https://developer.apple.com/design/human-interface-guidelines/branding |
| 9 | Buttons | Rol, énfasis, etiqueta, 44×44, estados, carga | https://developer.apple.com/design/human-interface-guidelines/buttons |
| 10 | Feedback / Loading | Intensidad según consecuencia; progreso honesto; sin falsos éxitos | https://developer.apple.com/design/human-interface-guidelines/feedback · https://developer.apple.com/design/human-interface-guidelines/loading |
| 11 | Modality / Sheets / Alerts | Cuándo interrumpir, cómo cerrar, qué pasa con el trabajo | https://developer.apple.com/design/human-interface-guidelines/modality · https://developer.apple.com/design/human-interface-guidelines/sheets |
| 12 | Entering data / Text fields / Tab bars / Privacy / Generative AI / VoiceOver | Formularios, navegación estable, permisos, IA comprensible, estructura no visual | https://developer.apple.com/design/human-interface-guidelines/entering-data · https://developer.apple.com/design/human-interface-guidelines/tab-bars · https://developer.apple.com/design/human-interface-guidelines/privacy · https://developer.apple.com/design/human-interface-guidelines/generative-ai · https://developer.apple.com/design/human-interface-guidelines/voiceover |

**Regla de lectura:** para cada tema se leen el `SKILL.md` local y su referencia; se anota la decisión, la cita y el check. Si una recomendación es específica de una plataforma Apple y no aplica a web, se dice y se adapta; no se inventa una regla.

---

## 6 · Métodos y herramientas

### 6.1 Auditoría antes de tocar código

Matriz obligatoria en `HIG-AUDIT.md`:

| Superficie | Tarea | Evidencia actual | Tema HIG | Barrera observada | Severidad | Corrección | Check |
|---|---|---|---|---|---|---|---|

- **Severidad:** bloqueante (impide tarea), mayor (la vuelve lenta/confusa), menor (pulido).
- **Evidencia:** captura, código, medición, prueba de usuario; no “se siente”.
- **Antes de diseñar:** capturas 360/390/768/1280, árbol de accesibilidad, teclado, Lighthouse, axe, texto al 200%, contraste real.
- **Hipótesis separadas:** “el foco se pierde” es hipótesis hasta que se prueba; no se reporta como defecto sin evidencia.

### 6.2 Sistema de diseño en código

- Tokens semánticos en `globals.css` (Tailwind v4 `@theme`): color, tipografía, espacio, radios, sombras, movimiento. **Cero hex sueltos** en componentes nuevos.
- Componentes base: `Button`, `IconButton`, `Field`, `Sheet`, `TabBar`/`Sidebar`, `StatusBanner`, `Amount`, `Progress`, `ListRow`, `EmptyState`.
- Contrato por componente: propósito, variantes, tamaños, estados, foco, teclado, nombre accesible, reduced motion.
- Una sola capa de elevación: superficie plana + hairline; las sheets pueden llevar una sombra. **No** vidrio en todas partes, **no** gradientes decorativos en controles.

### 6.3 Verificación

- **Playwright:** 360/390/768/1280; flujo completo; 200% de texto; teclado; foco; targets; overflow; estados de error/vacío.
- **axe-core + Lighthouse:** accesibilidad, best practices, SEO; performance ≥90 como objetivo, no como adorno.
- **Contraste:** calcular pares reales; no confiar en “se ve bien”.
- **Lector de pantalla:** NVDA en Windows si está disponible; árbol de accesibilidad y nombres en todos los casos. **No afirmar VoiceOver** sin una Mac.
- **Prueba humana:** 3 comerciantes o, mínimo, 1 persona ajena + 2 perfiles simulados declarados como tales. Tareas de `TEST-USUARIO.md`, tiempos, ayuda, frases.
- **Regresión de dinero:** `node scripts/webhook-contract.mjs` 34/34, build y lint limpios, demo reset.
- **Git:** repositorio inexistente hoy. Antes de tocar UI: `git init`, `.gitignore` raíz que excluya `web/node_modules`, `web/.next`, `web/data`, `.env.local` y binarios temporales; commit baseline y tag `pre-hig`. Si no se usa git, zip de respaldo. Sin red de seguridad no se empieza.

---

## 7 · Superficies: qué se rediseña

| Superficie | Hoy | Objetivo HIG |
|---|---|---|
| **Shell / header** | Marca + ficha de comerciante + reset + ayuda compitiendo; hero editorial largo. | Barra de título clara: destino actual, comerciante, “Demo” y ayuda. El reset sale del header. El hero desaparece del camino de trabajo. |
| **Navegación** | Bottom nav con anclas a una página larga; en desktop no hay navegación lateral. | 5 destinos reales: **Caja, Fiado, Corte, Meta** (hoy “Camino”) y **Pendientes**. Compacto: tab bar inferior con estado conservado. Regular: sidebar. Help/Verify/Demo como sheets. |
| **Caja / voz** | Micrófono grande, frases de ejemplo, draft, panel de cobro a la derecha; en móvil el cobro queda abajo. | Una tarea: “¿Qué vendiste?” + botón de voz con estados + texto alternativo. El pedido se confirma; el cobro se abre en **sheet en todos los tamaños** (en wide, centrado a 560). |
| **Payment sheet** | Panel largo con QR, link, aviso de espera, botones demo y “cerrar”. | Sheet scoped: monto, estado, QR/link, un primario, un secundario, salida clara. Demo y real visualmente distintos. |
| **Checkout público** | Funciona, pero con microtipografía de 9–12 px y estética de papel. | Tarjeta clara: comercio, total, productos, métodos, botón primario, aviso de seguridad y demo. Apple Pay solo con botón/JS oficial si está habilitado; si no, “Wallet”. |
| **Éxito** | Pantalla propia + overlay con sello; dos lenguajes. | Un solo patrón de confirmación: check, monto, pedido, método, “Listo para entregar”. Real vs demo distinto. |
| **Fiado** | Lista + formulario de abono; mezclado en la página. | Destino propio: saldos, quién debe, abonar en sheet, historial. “Fiado no es dinero recibido” visible. |
| **Corte** | Tarjeta con conteo por denominaciones; botón de actualizar. | Flujo de cierre: esperado, contado, diferencia, guardar. Un primario; confirmación clara; errores inline. |
| **Meta** | Punch card, foto, aportación; muy editorial. | Progreso determinista con barra/aro, monto, “apartado declarado”, aportación inline. Una foto máxima, fuera de la ruta de cobro. |
| **Verificar** | Tarjeta anti-fraude dentro de la página. | Acción secundaria en toolbar/sheet: pegar ID, verificar, resultado inequívoco. Sigue siendo visible en la demo. |
| **Ayuda / demo** | Diálogo de ayuda; reset en header. | Sheets: ayuda contextual y “Modo demo” con reset confirmado. No mezclar acción de desarrollador con tarea de comerciante. |
| **Estados** | Toasts de 4 s que tapan contenido; skeletons solo en checkout. | Banner inline junto a la acción; toast solo para lo no crítico. Loading honesto, empty explicativo, error con recuperación. |
| **Desktop / tablet** | Página larga de 1280 px. | Workspace con sidebar + columna principal; Caja en dos columnas; mismas destinos y estado. |

---

## 8 · Contratos visuales

### 8.1 Tipografía

| Rol | Tamaño / línea | Uso |
|---|---|---|
| Display | 40 / 44 | Solo marca/hero de bienvenida, nunca datos |
| Title 1 | 28 / 34 | Título de destino, monto principal del sheet |
| Title 2 | 22 / 28 | Secciones, totales |
| Headline | 17 / 22 | Encabezado de tarjeta, nombre de cliente |
| Body | 17 / 24 | Texto principal, instrucciones |
| Callout | 16 / 21 | Filas, labels de campo |
| Subhead | 15 / 20 | Metadata importante |
| Footnote | 13 / 18 | Ayuda secundaria |
| Caption | 12 / 16 | Solo texto no esencial; nunca una acción |

- **UI:** pila del sistema (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`). Sin descargar SF Pro.
- **Marca:** Fraunces solo para “Mercado Cero” y una frase editorial; nunca en botones, formularios ni cifras.
- **Números:** tabulares, alineados a la derecha, con `Intl.NumberFormat("es-MX")`.
- **Crecer:** contenedores crecen, labels envuelven, metadatos se apilan; no truncar información esencial.

### 8.2 Espacio y tacto

- Base 4 pt; escala 4/8/12/16/20/24/32/40/48.
- Márgenes: 16 compacto, 24 regular, 32 desktop.
- Targets: **44×44 px** mínimo, 8 px de separación; el área táctil puede ser mayor que el glifo.
- Safe area inferior para la tab bar; nada esencial debajo de una barra fija.
- Radio: 12 botones/campos, 16 tarjetas, 20 sheet; no píldoras en todo.

### 8.3 Color semántico

| Token | Claro | Uso |
|---|---|---|
| `--bg` | `#F7F5F0` | Fondo de app, cálido sin textura |
| `--surface` | `#FFFFFF` | Tarjetas, sheets |
| `--surface-2` | `#F0EEE8` | Campos agrupados, filas |
| `--text` | `#161A17` | Texto principal |
| `--text-2` | `#5B635D` | Texto secundario (contraste ≥4.5) |
| `--separator` | `#D9D5CC` | Hairlines |
| `--accent` | `#0B6B4F` | Acción primaria, marca |
| `--accent-press` | `#07513C` | Pressed |
| `--success` | `#0B6B4F` | **Solo pago pey confirmado por webhook** |
| `--attention` | `#A6532F` | Fiado, pendiente, demo |
| `--danger` | `#B3261E` | Error/destructivo; nunca marca |
| `--info` | `#2F5D8A` | Información neutral |

- Estados siempre con **texto + icono + forma**, no solo color.
- **Demo** usa `--attention` + pill “Demo”; **pagado real** usa `--success` + check + “Confirmado por el banco”. Nunca el mismo tratamiento.
- Contraste medido; si un par no llega a 4.5:1, se cambia el token, no se “aproxima”.

### 8.4 Superficies y movimiento

- Sin grano, halftone, borde de recibo, sellos rotados ni “stamp-in”.
- Una capa de elevación: hairline + sombra suave en sheets; sin vidrio decorativo.
- Movimiento 180–260 ms; sheet slide/fade; mic ring solo al grabar; progress determinista para meta.
- `prefers-reduced-motion`: sin viaje, sin rebote, sin scale; el estado se conserva.
- Nada de animación blocking: la siguiente acción siempre está disponible.

### 8.5 Navegación y contenido

- 5 destinos estables; estado y scroll se conservan al volver.
- Tabs: label corto + icono + `aria-current`; no acciones disfrazadas de tab.
- Copy es-MX, verbos cortos: “Cobrar”, “Confirmar venta”, “Abrir checkout”, “Guardar corte”, “Apartar”.
- “Webhook”, “API”, “pey” solo en ayuda/detalle técnico; la UI dice “Confirmación del banco”.
- Errores: qué pasó + qué hacer + acción; sin códigos.
- IA: “La IA interpreta; tú confirmas.” El draft es editable; si falla, el parser local y el texto siguen.

---

## 9 · Fases (31 oct → 7 nov)

| Fase | Fecha | Entregable | Gate |
|---|---|---|---|
| **F0 · Red de seguridad** ✅ | 31 oct | `git init`, baseline `4d33a46`, tag `pre-hig`, skill fijada, capturas y métricas base | Sin baseline no se toca UI |
| **F1 · Auditoría HIG** ✅ | 31 oct–1 nov | `HIG-AUDIT.md` con matriz, severidades, citas y evidencia 360/390/768/1280 | Revisión: ningún bloqueante sin corrección propuesta |
| **F2 · Contrato de diseño** 🟡 | 1 nov | `HIG-DESIGN.md`: tokens, tipos, componentes, estados, copy, adaptación web | Aprobado antes de escribir componentes |
| **F3 · Shell + Caja + cobro + checkout** | 2–3 nov | Nuevo shell, tabs/sidebar, Caja, sheet de cobro, éxito, checkout | Flujo completo en 360 y 1280; 34/34 intacto |
| **F4 · Superficies secundarias** | 4 nov | Fiado, Corte, Meta, Verificar, Ayuda, demo reset, estados vacíos/error | Sin pantallas a medio migrar |
| **F5 · Accesibilidad y performance** | 5 nov | 200% texto, teclado, foco, contraste, reduced motion, Lighthouse/axe, performance | Must-pass de la sección 10 |
| **F6 · Persona ajena + congelamiento** | 6 nov | 3 pruebas, correcciones blocker, video/QR/runbook/guion actualizados | **21:00: freeze** |
| **Demo** | 7 nov | Ensayo narrado, preflight 18/18, plan B | — |

**Si F3 se retrasa más de un día:** se recorta a “HIG-lite” — shell, tokens, tipografía, tacto, sheet de cobro, checkout y estados — y las secundarias se simplifican; no se deja una pantalla con papel al lado de una nueva. Si no se llega, se vuelve al tag `pre-hig` y se conserva la demo actual.

---

## 10 · Criterios de aceptación

### Must-pass (si falla uno, no está terminado)

- [ ] **Todas** las superficies de producción usan los tokens/componentes nuevos; `grep` de `receipt-edge`, `halftone`, `stamp`, `grain` en UI = 0 (salvo créditos/archivo).
- [ ] 360/390/768/1280 sin scroll horizontal; nada esencial clipado; nada esencial bajo la tab bar.
- [ ] Texto al **200%** sin pérdida de contenido ni acciones; probado en Caja, sheet, checkout y éxito.
- [ ] Targets ≥44×44 px; separación ≥8 px; foco visible en todos los controles.
- [ ] Contraste ≥4.5:1 en texto normal y ≥3:1 en texto grande/UI; axe 0 critical/serious; Lighthouse accesibilidad 100.
- [ ] Teclado: flujo completo Caja → confirmar → sheet → cerrar → Fiado; Escape cierra sheet; foco vuelve al disparador; sin trampas fuera de sheets.
- [ ] Nombres accesibles en todos los icon buttons; headings/landmarks; estado de pago en live region; formularios con label persistente y error asociado.
- [ ] `prefers-reduced-motion`: sin viaje/rebote; estados y completion visibles.
- [ ] **Demo ≠ real:** pago simulado con pill “Demo” y color de atención; pagado real con check verde y “Confirmado por el banco”; nunca el mismo tratamiento.
- [ ] Sin “pagado” sin webhook firmado; contrato **34/34**; build y lint limpios; demo reset limpio.
- [ ] Flujo mecánico 360 ≤ **12.2 s** (baseline 10.2 s +20%) y 0 errores de consola.
- [ ] Prueba humana: **3 participantes**; al menos **2/3** completan la venta sin ayuda en <60 s; **3/3** explican “pendiente no es pagado”; **2/3** completan las 5 tareas en <3 min. Si solo hay 1 persona, se declara “evidencia limitada”, no se maquilla.
- [ ] Performance: sin regresión >10% vs. la línea base de F0; LCP <2.5 s y CLS <0.1 en producción; sin dependencia nueva pesada.

### Should-pass

- [ ] Lighthouse performance ≥90 en producción.
- [ ] Modo oscuro con tokens preparados (no obligatorio para la demo; si se implementa, se prueba contraste).
- [ ] Safari iOS y Chrome Android reales; si no hay dispositivo, se reporta “pendiente”.
- [ ] Checkout con Apple Pay solo si existe botón/JS oficial; si no, “Wallet” genérico.

### No-goals

- No tocar webhook, montos, idempotencia, SQLite ni la lógica de pey.
- No agregar funciones nuevas (cuentas familiares, custodia, ahorro, etc.).
- No construir una app nativa ni usar SF Pro/SF Symbols sin licencia.
- No afirmar afiliación con Apple ni “cumple HIG” como certificación.
- No convertir todo en vidrio, gradientes o animaciones; HIG no es un tema visual.
- No sacrificar la identidad mexicana por un iOS genérico.

---

## 11 · Evidencia que se entrega

| Archivo | Contenido |
|---|---|
| `HIG-AUDIT.md` | Matriz superficie × tema, evidencia, severidad, corrección y cita |
| `HIG-DESIGN.md` | Dirección “Mostrador claro”, tokens, tipos, componentes, estados, adaptación web |
| `HIG-CHECKLIST.md` | Must/should/no-goals con PASS / FAIL / NOT EXECUTED |
| `demo/hig-before/` | Capturas base 360/390/768/1280 |
| `demo/hig-after/` | Capturas finales, mismos tamaños y estados |
| `demo/hig-audit.json` | Playwright: overflow, targets, 200%, teclado, consola |
| `demo/hig-lighthouse.json` | Caja, checkout y éxito en producción |
| `demo/feedback-hig.md` | Prueba humana: tiempos, ayuda, frases, fricción |
| `demo/mercado-cero-demo.mp4` | Video nuevo, mismo guion actualizado |
| `demo/qr-demo.pdf` | QR del túnel final |
| `RUNBOOK-DEMO.md`, `GUION-3-MIN.md` | Guion y fallas actualizados al nuevo flujo |

**Comandos de cierre:**

```powershell
npm run lint
npm run build
npm start
node scripts/webhook-contract.mjs
python scripts/mobile-audit.py
python scripts/checkout-audit.py
python scripts/tunnel-smoke.py
python scripts/rehearse-demo.py
node scripts/preflight.mjs
```

---

## 12 · Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| HIG es Apple; la app es web | Documento “Adaptación a web”; se aplican principios, no APIs; se prueban Chrome/Safari/Firefox |
| Copiar iOS y volverse genérico | Mantener verde, mark 0, una foto y el español de mercado; una sola firma editorial, no todo el producto |
| SF Pro/SF Symbols/licencias | Pila del sistema y Lucide; no bundle de fuentes Apple; Apple Pay solo con JS oficial |
| Scope creep de 6 días | Must-pass cerrado; HIG-lite/rollback; no nuevas features |
| Regresión del dinero | No tocar backend; 34/34 en cada gate; demo reset |
| Prueba humana insuficiente | 3 personas; si no, declarar evidencia limitada y no afirmar validación |
| Teléfono físico ausente | Playwright + 360/390; marcar touch/safe-area como pendiente; usar el teléfono del usuario en F6 |
| Túnel temporal | Regenerar QR/video con la URL final; preflight 18/18 |
| Sin git | `git init` + baseline + tag antes de tocar UI; si no, zip fechado |

---

## 13 · Definición de “goal cumplido”

1. Una persona ajena cobra y entiende el estado sin que le expliques.
2. No queda papel, sello rotado ni recibo en la ruta transaccional; queda una herramienta clara con identidad.
3. Cada decisión importante tiene tema HIG, cita y check.
4. La accesibilidad no es una nota al final: 200%, teclado, foco, contraste y lector están probados o declarados como no ejecutados.
5. Demo y real nunca se confunden.
6. El dinero sigue cuadrando: 34/34, build/lint limpios.
7. La evidencia before/after existe y es reproducible.
8. El video, el QR, el runbook y el guion reflejan la interfaz nueva.
9. El equipo puede volver al tag `pre-hig` si algo falla.
10. La frase del jurado es sobre certeza, no sobre “se ve como Apple”.

---

## 14 · Primera acción

Antes de escribir un solo componente:

```powershell
cd mercado-cero
git init
# .gitignore raíz: web/node_modules/, web/.next/, web/data/, .env.local, *.webm
git add .
git commit -m "baseline: Mercado de papel antes de HIG"
git tag pre-hig
cd web
npx skills add AyushRajSinghParihar/apple-human-interface-skills --skill apple-hig
```

Después: auditar, capturar, medir y escribir `HIG-AUDIT.md`. **No** se diseña hasta que la auditoría tenga evidencia.
