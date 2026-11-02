# HIG-DESIGN — Mostrador claro

> **Fase F2 · Contrato de diseño.** No se implementa UI en este documento.
> Base: `HIG-AUDIT.md` (commit `7f107f9`), Apple HIG adaptado a web, y los invariantes de `GOAL.md`.
> Regla: si una decisión no resuelve un hallazgo de la auditoría o una tarea real de la comerciante, no entra.

---

## 1 · La dirección

**Mostrador claro** es una herramienta de trabajo, no un escaparate.

- **Claridad:** una tarea por pantalla; el estado del dinero siempre se lee sin ambigüedad.
- **Jerarquía:** primero la venta, luego el cobro, luego la administración. La marca no se come la tarea.
- **Tacto:** una mano, 44×44 px, texto que crece, foco visible, sin depender del color ni del audio.
- **Verdad:** demo, pendiente, fiado y pagado tienen tratamientos distintos. El verde de éxito se reserva para un pago confirmado por pey.
- **Calidez:** verde Mercado Cero, mark 0, una foto y el español de mercado. La identidad vive en la marca y el copy, no en cada tarjeta.

### Lo que se retira de la ruta transaccional

Grano, halftone, borde de recibo, sellos rotados, `stamp-in`, `pop`, hero editorial de página completa y tipografía display en datos.

### Lo que se conserva

La tesis de certeza, la voz, el efectivo, el fiado, el corte, la meta, el mark 0, el verde y la calidez de una sola imagen editorial.

---

## 2 · Adaptación a web (no certificación)

Apple HIG describe plataformas Apple; esta app es web. Se adaptan **principios**, no APIs:

| HIG | Adaptación web |
|---|---|
| 44 pt touch target | 44×44 px CSS, 8 px de separación |
| Body 17 pt | 17 px, line-height 24 px |
| Dynamic Type | `rem` + reflujo al 200%; sin alturas fijas en texto |
| Safe areas | `env(safe-area-inset-bottom)` con fallback |
| SF Pro / SF Symbols | Pila del sistema y Lucide; no se descargan fuentes/iconos Apple |
| VoiceOver | Nombres, roles, orden, `aria-live`, foco; NVDA/VoiceOver se prueban aparte |
| Apple Pay | Solo botón/JS oficial si está habilitado; si no, “Wallet” |

**No se afirma** “cumple HIG” ni afiliación con Apple. Se afirma “adaptación documentada con evidencia”.

---

## 3 · Arquitectura de información

### 3.1 Cinco destinos

| Destino | Trabajo | Acción primaria |
|---|---|---|
| **Caja** | Registrar una venta, cobrar, ver actividad reciente | Voz / “Confirmar venta” |
| **Fiado** | Ver quién debe, abonar, historial | “Registrar abono” |
| **Corte** | Contar efectivo, comparar, cerrar el día | “Guardar corte” |
| **Meta** | Ver progreso y apartar | “Apartar” |
| **Pendientes** | Ver recordatorios, anotar, posponer o completar | “Anotar pendiente” |

- Los tabs son **destinos**, no anclas. Cada uno conserva scroll y estado.
- “Verificar comprobante”, “Ayuda” y “Modo demo” son **acciones secundarias**, no destinos.
- El reset de demo vive dentro de “Modo demo” y pide confirmación.

### 3.2 Shell

**Compacto y tablet (<1024 px):**

```
┌─────────────────────────────┐
│ Caja            [Demo] [?]  │  ← barra de título, 56 px + safe top
│ Antojitos de Lupita         │
├─────────────────────────────┤
│                             │
│  contenido del destino      │
│                             │
├─────────────────────────────┤
│ Caja Fiado Corte Meta Tareas │  ← tab bar, 64 px + safe bottom
└─────────────────────────────┘
```

**Regular (≥1024 px):**

```
┌──────────────┬──────────────────────────────┐
│ Mercado Cero │ Caja                         │
│ Antojitos    │ Antojitos de Lupita · Demo    │
│              │                              │
│ Caja         │  contenido                   │
│ Fiado        │                              │
│ Corte        │                              │
│ Meta         │                              │
│ Pendientes   │                              │
│              │                              │
│ Ayuda        │                              │
│ Modo demo    │                              │
└──────────────┴──────────────────────────────┘
```

- Tab bar de 64 px + safe bottom en 360–1023 (tablet incluida); sidebar 220 px (1024–1199) / 240 px (≥1200).
- En ≥1200, Caja usa dos columnas: venta/draft (640) + resumen/actividad (360).
- El checkout siempre es una tarjeta centrada de máximo 480 px.
- La tab bar va antes de `main` en el DOM. En móvil es una fila del shell y `main` tiene su propio scroll; en escritorio la barra queda fija abajo. Así ningún control puede quedar debajo del chrome.
- El skip link enfoca `main#main`; `scroll-padding` superior/inferior se alimenta del alto real del header y la tab bar.
- Al 200 %, las acciones primarias de Caja, Meta y Fiado quedan completas por encima de la tab bar; el contenido nunca queda atrapado bajo el chrome.

### 3.3 Mapa de pantallas

| Pantalla | Entrada | Salida |
|---|---|---|
| Caja | Tab Caja / inicio | Tab, “Confirmar venta” → Payment sheet |
| Payment sheet | Confirmar venta / pedido pendiente | “Listo para entregar”, “Cerrar”, Escape |
| Checkout | Link/QR del cliente | Pago / error / “Listo” o “Cerrar” (salida pública) |
| Éxito | Pago confirmado | “Listo” / “Cerrar”; mientras espera: “Revisar link” |
| Fiado | Tab Fiado | “Registrar abono” → sheet |
| Corte | Tab Corte | “Guardar corte” → confirmación |
| Meta | Tab Meta | “Apartar” inline |
| Pendientes | Tab Pendientes | “Anotar pendiente” → lista |
| Verificar | Acción secundaria en Caja | Sheet con resultado |
| Ayuda | Acción en shell | Sheet |
| Modo demo | Acción en shell | Sheet; reset confirmado |

---

## 4 · Tokens

### 4.1 Color

| Token | Valor | Uso | Contraste |
|---|---|---|---|
| `--color-canvas` | `#F3ECE0` | Fondo de app | — |
| `--color-surface` | `#FFFDF8` | Tarjetas, sheets | — |
| `--color-surface-2` | `#ECE3D4` | Campos agrupados, filas | — |
| `--color-ink` | `#1A211B` | Texto principal | 14.0:1 en canvas · 12.9:1 en surface-2 |
| `--color-ink-2` | `#59615A` | Texto secundario | 5.45:1 en canvas · 5.03:1 en surface-2 |
| `--color-separator` | `#D7CCB9` | Hairlines y bordes de tarjetas; nunca controles | 1.46:1 en surface |
| `--color-placeholder` | `#5C635C` | Texto de placeholder | 4.86:1 en surface-2 · 6.09:1 en surface |
| `--color-control-border` | `#7A7165` | Bordes de inputs, selects, textareas, botones secundarios y radios | 3.77:1 en surface-2 · 4.72:1 en surface |
| `--color-accent` | `#0A5B42` | Acción primaria, marca | 6.91:1 en canvas · 8.11:1 blanco |
| `--color-accent-press` | `#074433` | Pressed | — |
| `--color-success` | `#0A5B42` | **Solo pago real confirmado** | 8.11:1 blanco |
| `--color-attention` | `#9C4E2B` | Fiado, pendiente, demo | 5.94:1 blanco · 5.05:1 en canvas |
| `--color-danger` | `#A9241C` | Error/destructivo | 7.10:1 blanco |
| `--color-info` | `#2F5D8A` | Información neutral | 6.88:1 blanco |
| `--color-focus` | `#0A5B42` | Foco visible; blanco sobre accent | 3:1+ en canvas |

**Reglas:**

- El color nunca es el único portador: siempre texto + icono/forma.
- `--color-success` no se usa en demo, fiado, pendiente ni “copia”.
- `--color-attention` no se usa para errores destructivos; para eso está `danger`.
- `--color-separator` no se usa para texto ni para bordes de controles.
- `--color-placeholder` es sólido (sin opacidad): ≥4.5:1 en normal y en alto contraste.
- `--color-control-border` mantiene ≥3:1 en inputs, selects, textareas, radios y botones secundarios.
- El borde visible puede vivir en un wrapper (`control-frame`): Total contado, Base inicial, Gastos, Retiros, Base para mañana, Meta y Abono; el audit mide el wrapper si el control interno no dibuja borde.
- Modo oscuro: tokens preparados, **no se implementa en F3**. Si se hace, se prueba contraste y apariencia.

### 4.2 Tipografía

| Rol | Token | Tamaño / línea | Uso |
|---|---|---|---|
| Display | `--type-display` | 40 / 44 | Solo marca/bienvenida |
| Title 1 | `--type-title-1` | 28 / 34 | Título de destino, monto del sheet |
| Title 2 | `--type-title-2` | 22 / 28 | Secciones, totales |
| Headline | `--type-headline` | 17 / 22 | Encabezado de tarjeta, nombre |
| Body | `--type-body` | 17 / 24 | Texto principal |
| Callout | `--type-callout` | 16 / 21 | Filas, labels de campo |
| Subhead | `--type-subhead` | 15 / 20 | Metadata importante |
| Footnote | `--type-footnote` | 13 / 18 | Ayuda secundaria |
| Caption | `--type-caption` | 12 / 16 | Solo no esencial; nunca una acción |

- **UI:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
- **Marca:** Fraunces solo para “Mercado Cero” y una frase editorial; nunca en botones, campos o cifras.
- **Números:** tabulares, `Intl.NumberFormat("es-MX")`, alineados a la derecha.
- **Crecimiento:** todo `rem`; contenedores crecen; labels envuelven; no truncar información esencial. `truncate` solo para IDs/links secundarios.

### 4.3 Espacio, radios y sombras

- Base 4 pt; escala `4 8 12 16 20 24 32 40 48`.
- Márgenes: 16 compacto, 24 regular, 32 wide.
- `--tap: 44px`; `--tap-gap: 8px`.
- `--radius-sm: 8px`, `--radius-md: 12px`, `--radius-lg: 16px`, `--radius-sheet: 20px`.
- `--shadow-sheet: 0 24px 64px rgba(22,26,23,.18), 0 2px 8px rgba(22,26,23,.08)`.
- Sin sombra en tarjetas normales: surface + hairline.
- Sin vidrio decorativo; si se usa blur en sheet, solo con `backdrop-filter` y fallback opaco.

### 4.4 Movimiento

| Token | Valor |
|---|---|
| `--motion-fast` | 160 ms |
| `--motion-base` | 220 ms |
| `--motion-slow` | 300 ms |
| `--ease-standard` | `cubic-bezier(0.2, 0.8, 0.2, 1)` |

- Sheet: fade + 12 px de traslación, 220 ms; salida 160 ms.
- Sin `stamp-in`, `pop`, rebotes ni scale decorativo.
- El mic ring solo mientras se graba; no en idle.
- `prefers-reduced-motion`: opacidad, sin traslación; el estado se conserva.
- `scroll-behavior: smooth` solo si no hay reduced motion.

### 4.5 Foco y safe area

```css
:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: 6px;
}
.on-accent :focus-visible { outline-color: #fff; }
```

```css
.tabbar {
  padding-bottom: max(12px, env(safe-area-inset-bottom));
}
```

- Nada esencial debajo de una barra fija.
- `viewport-fit=cover` solo si se prueba en iPhone real; si no, no se afirma safe area.

---

## 5 · Componentes

### 5.1 Button

| Variante | Uso | Estilo |
|---|---|---|
| `primary` | Acción principal de la pantalla/sheet | Fondo accent, texto blanco, 52 px |
| `secondary` | Acción alternativa | Surface, hairline, texto ink, 44 px |
| `quiet` | Cancelar/cerrar | Sin fondo, texto ink-2 |
| `destructive` | Reset, borrar | Danger, solo con confirmación |

- Label = verbo + objeto (“Confirmar venta”, “Guardar corte”).
- Loading: spinner 16 px + label “Confirmando…”; conserva el ancho; `aria-busy`.
- Disabled: explica por qué con texto cercano o `aria-describedby`, no solo opacidad.
- Icono: 16–20 px, decorativo si el label existe; si es icon-only, `aria-label` obligatorio.
- Un solo `primary` por vista.

### 5.2 IconButton

- 44×44; `aria-label` obligatorio; tooltip en desktop no sustituye el nombre.
- Estados: rest, hover, pressed, focus, disabled.
- No usar icon-only para acciones destructivas.

### 5.3 Field

- Label persistente arriba; placeholder nunca sustituye el label.
- Hint opcional; error debajo, `aria-invalid` + `aria-describedby`.
- `inputMode="decimal"` para dinero; `autoComplete` apropiado.
- Altura 44; texto 17; fondo surface; hairline; foco visible.
- Validación al confirmar o al salir, no en cada tecla; aceptar entrada parcial.

### 5.4 Sheet / Dialog

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- Foco al título o al primer control; trampa de foco; `Escape` cierra; backdrop click cierra solo si no hay datos sin guardar.
- Foco vuelve al disparador.
- Máximo `90dvh`; body scrollable; header y footer fijos.
- Un solo sheet a la vez; no apilar.
- Salidas: `Cancelar/Cerrar` (no guarda), `Listo/Confirmar` (completa). `Back` solo dentro de pasos.
- Si hay cambios sin guardar, confirmación explícita.

### 5.5 TabBar / Sidebar

- 5 destinos (Caja, Fiado, Corte, Meta, Pendientes); icono + label; `aria-current="page"` en el activo.
- 44×44 mínimo; safe bottom.
- Estado y scroll por destino.
- Sin acciones disfrazadas de tab.
- Desktop: sidebar con la misma selección; brand arriba; ayuda/demo abajo.

### 5.6 StatusBadge

| Estado | Texto | Color | Icono |
|---|---|---|---|
| `pending` | Por cobrar | attention | clock |
| `waiting` | Esperando al banco | attention | pulse |
| `paid` | Pagado | success | check |
| `credit` | Fiado | attention | notebook |
| `demo` | Demo | attention | beaker |
| `error` | No verificado | danger | alert |

- Texto siempre; no solo color.
- `paid` solo si `webhook` confirmó; `demo` nunca usa `paid`.

### 5.7 StatusBanner

- Inline, cerca de la acción; icono + título + body + acción.
- `role="status"` para información; `role="alert"` para error.
- No tapa contenido; no es un toast flotante.
- Errores con qué pasó + qué hacer.

### 5.8 Toast

- Solo para “Link copiado”, “Voz silenciada” y feedback no crítico.
- 3 s; `role="status"`; no cubre un CTA; se puede cerrar.
- Nunca para el estado de un pago.

### 5.9 Amount

- Tabular; `$1,234.00`; `aria-label="Mil doscientos treinta y cuatro pesos"` si el contexto lo requiere.
- Tamaño Title 1 en sheet/checkout; Title 2 en filas.
- No usar Fraunces para cifras.

### 5.10 Progress

- `role="progressbar"`, `aria-valuemin/max/now`, label visible.
- Determinado para meta/corte; indeterminado solo para esperas reales.
- Sin porcentajes inventados.

### 5.11 ListRow / EmptyState / Skeleton

- ListRow: 44+; nombre, metadata, monto, chevron; label accesible completo.
- EmptyState: icono, título, body, acción; explica el estado, no lo esconde.
- Skeleton: solo para contenido conocido; sin cifras falsas; se reemplaza por datos reales.

---

## 6 · Contratos por pantalla

### 6.1 Caja (home)

**Estructura compacta:**

1. Barra: “Caja”, “Antojitos de Lupita · Coyoacán”, pill “Demo”, botón “Silenciar voz” (icono + aria), “Ayuda”.
2. Línea de contexto: “Hoy $190 · Por cobrar $120 · Fiado $50” (una línea, 15 px; no tarjetas).
3. **VoiceSaleCard**:
   - Título “¿Qué vendiste?”.
   - Micrófono 80 px, label “Mantén para hablar” (aria-label completo); estados: idle, grabando (ring + timer), transcribiendo (spinner + “Escuchando…”), error.
   - Texto alternativo **siempre visible**: “o escribe la venta” + campo + “Interpretar”.
   - Frases de ejemplo como chips secundarios (no compiten con el mic).
4. **DraftTicket**:
   - Lista de productos, cantidades, total.
   - Confirmación visible “Escuché $90.00. ¿Confirmas?” cuando la venta viene de voz/texto.
   - “Efectivo recibido” y “A fiado” con labels persistentes; se ocultan hasta que hay productos.
   - Vacío: mensaje compacto “La caja está lista”, sin campos de cobro.
   - “Confirmar venta” primario; deshabilitado con razón si falta total/nombre de fiado.
5. **Actividad reciente**: 3–5 filas; “Ver todo” si hay más.
6. **Acciones secundarias**: “Verificar comprobante” como enlace/texto, no como card.

**Estados:**

- Vacío: “La caja está lista. Habla o escribe una venta.”
- Error de voz: “No pude escuchar. Revisa el micrófono o escribe la venta.”
- Error de venta: inline sobre “Confirmar venta”.
- Loading: skeleton en actividad; nunca bloquea el mic.
- Fiado sin nombre: error inline + foco al campo.

**Aceptación:** a 360×800, el micrófono y el inicio del draft están en el primer viewport; el flujo se completa sin scroll horizontal; 200% sin pérdida.

### 6.2 Payment sheet

**Entrada:** “Confirmar venta” o pedido pendiente en actividad.

**Contenido:**

1. Header: “Cobrar $90.00” + “Pedido A96B” + StatusBadge.
2. Métodos: dos tiles secundarios “Link de pago” y “QR CoDi”; el link es el primario.
3. Antes de generar: explicación breve; botón “Generar link” / “Generar QR”.
4. Después: QR 200×200, link truncado con “Copiar”, botón “Compartir link” (primario) y “Abrir checkout” (secundario).
5. Estado: “Esperando al banco” con texto “No entregues hasta que se confirme”.
6. Si está pagado: “Pago confirmado” / “Pago simulado” + monto + “Listo para entregar” (primario) y “Cerrar” (quiet).
7. Modo demo: bloque separado al final, borde dashed/attention, “Simular CoDi” y “Simular tarjeta”; nunca primario.

**Salidas:** “Cerrar” conserva el pedido; Escape igual; backdrop solo si no hay pago en curso. “Listo para entregar” cierra y marca entregado. Foco vuelve a “Confirmar venta” o a la fila del pedido.

**Aceptación:** un solo primario; foco atrapado; demo visualmente distinto; 200% sin cortar el monto; no hay dos “Cerrar” con efectos distintos.

### 6.3 Checkout público

**Estructura:**

1. Header mínimo: mark 0 + “Mercado Cero” + “Pago protegido”.
2. `h1`: “Pagar a Antojitos de Lupita” (o “Pagar pedido A96B”).
3. Comercio, dirección, total 40 px, productos.
4. `<fieldset>` “¿Cómo quieres pagar?” con 3 radios:
   - CoDi (recomendado), Tarjeta, Wallet.
   - El radio real controla el estado; no `aria-pressed` sobre botones.
5. Aviso demo si aplica: “Modo demo: este pago se simula. No se mueve dinero real.”
6. Primario: “Pagar $120.00”; loading “Confirmando con el banco…”; error inline con `role="alert"`.
7. Nota de seguridad: “No guardamos datos de tu tarjeta.”

**Éxito:**

- `h1`: “Pago confirmado” (real) o “Pago simulado” (demo).
- Check solo en real; demo con beaker/attention.
- Monto, pedido, método, comercio.
- Real: “La comerciante ya puede entregar.” Demo: “Esto es una simulación.”
- Primario: “Listo” o “Cerrar”, salida pública del pagador. Nunca el dashboard de la comerciante. Mientras espera: “Revisar link”.

**Aceptación:** `h1` presente; CLS <0.1; 200% sin cortar total; targets 44; foco y error accesibles.

### 6.4 Fiado

- Título “Fiado”; subtítulo “Lo que te deben, no dinero recibido.”
- Resumen: total pendiente + número de clientes.
- Lista: nombre, saldo, último movimiento, “Registrar abono”.
- Sheet de abono: monto, método (efectivo/digital), nota, “Registrar abono”.
- Estado vacío: “No hay fiado pendiente.”
- Abono no crea venta nueva; el copy lo dice.
- Aceptación: saldo se actualiza sin recargar; sheet con foco; 200%.

### 6.5 Corte

- Título “Corte de caja”; subtítulo “Compara lo contado con lo esperado.”
- Resumen: base, ventas en efectivo, abonos de fiado, gastos, retiros, **debería haber**.
- “Contar por billetes y monedas” es un disclosure; al abrirlo, inputs de denominaciones.
- Total contado + diferencia; si diferencia ≠ 0, banner attention/danger con “Falta” o “Sobra”.
- Primario “Guardar corte”; confirmación si hay diferencia.
- “Último corte” como fila secundaria.
- Sin botón “Actualizar” como paso manual: se refresca al entrar y al registrar movimientos; icono de refresh para forzar.
- Aceptación: el total esperado se actualiza tras un abono; guardar muestra confirmación durable; 200%.

### 6.6 Meta

- Título “Meta”; subtítulo “Una meta a la vez.”
- Tarjeta: nombre, monto apartado / objetivo, barra/aro determinado, porcentaje, “Faltan” y “Por semana”.
- Acción: campo “¿Cuánto apartaste?” + “Apartar” (primario); validación inline.
- Nota: “Apartado declarado: no es una cuenta bancaria ni dinero custodiado.”
- Una foto opcional, fuera de la tarjeta de progreso; sin punch card.
- Estado sin meta: “Crea tu primera meta” + sugerencia.
- Aceptación: progreso determinista, `aria-valuenow`; 200%; no hay custodio implícito.

### 6.7 Verificar comprobante

- Acción secundaria visible en Caja (“Verificar comprobante”).
- Sheet: título “Verificar comprobante”; body “Pega el ID de la transacción. Si no existe en pey, no es un pago verificable.”
- Campo + “Verificar”; resultado:
  - Verificado: `success` + monto + método + pedido.
  - No verificado: `danger` + “No corresponde a un pago confirmado” + “No entregues el pedido.”
- Sin promesas de “captura”; el copy lo dice.
- Aceptación: resultado anunciado con `role="status"`/alert; foco al resultado; 200%.

### 6.8 Ayuda / Modo demo

- Ayuda: sheet con secciones disclosure; `aria-expanded`/`aria-controls`; focus trap; Escape.
- Modo demo: sheet con explicación y “Reiniciar datos de demo” destructive; confirmación con consecuencia (“Se borran ventas, fiado, corte y meta de la demo”).
- En producción (`DEMO_MODE=false`), el bloque demo no existe.
- Aceptación: no se puede resetear con un toque; el estado demo se explica; focus trap.

---

## 7 · Máquina de estados

| Estado | Caja | Payment | Checkout |
|---|---|---|---|
| `idle` | Mic + draft vacío | “Genera el cobro” | Métodos disponibles |
| `loading` | Skeleton en actividad; mic libre | Spinner en el botón, conserva ancho | Botón “Confirmando…”, inputs bloqueados |
| `pending` | Pedido en actividad | “Esperando al banco” + QR/link | “Esperando confirmación” |
| `paid` | Actividad “Pagado” | “Pago confirmado” + “Listo para entregar” | Éxito real |
| `demo` | Pill “Demo” | “Pago simulado” + beaker | Éxito demo |
| `credit` | Fiado | “Fiado” (no pago) | No aplica |
| `error` | Banner inline + retry | Banner + retry | Banner + retry |
| `empty` | “La caja está lista” | — | — |
| `offline` | Banner “Sin conexión” | “No se puede confirmar hasta volver” | Banner + retry |

**Regla de oro:** un estado nunca se muestra con el tratamiento de otro. `paid` es verde; `demo`/`pending`/`credit` son attention; `error` es danger.

---

## 8 · Copy deck

### Acciones

- “Cobrar”, “Confirmar venta”, “Generar link”, “Compartir link”, “Mostrar QR”, “Listo para entregar”, “Cerrar”, “Registrar abono”, “Guardar corte”, “Apartar”, “Verificar”, “Reintentar”.

### Estados

- “Por cobrar” · “Esperando al banco” · “Pagado” · “Fiado” · “Demo” · “No verificado”.
- “Confirmado por el banco” (real) vs “Pago simulado” (demo).

### Errores

- “No pudimos generar el link. Revisa tu conexión e intenta de nuevo.”
- “Ese comprobante no corresponde a un pago confirmado. No entregues el pedido.”
- “Para fiado necesito el nombre del cliente.”
- “El efectivo y el fiado no pueden superar el total.”

### Prohibido en UI primaria

“Webhook”, “API”, “payload”, “idempotencia”, “token”, “endpoint”. Esos términos viven en ayuda técnica, no en la tarea.

---

## 9 · Accesibilidad (contrato P0)

- **200%:** home, sheet, checkout y éxito sin texto recortado, solapado ni acciones perdidas. `rem`, contenedores flexibles, sin `h-[…]` en texto.
- **Targets:** 44×44 mínimo, 8 px de separación; `under44 = 0`.
- **Foco:** visible en todos; sheet atrapa y devuelve; Escape cierra; no hay trampas fuera de sheets.
- **Teclado:** Caja → confirmar → sheet → cerrar → Fiado; orden lógico; sin tabindex positivo.
- **Semántica:** un `h1` por página; `h2` por sección; `header/nav/main`; sheets con `role=dialog`; `aria-current` en tabs.
- **Anuncios:** pago con `aria-live`/`role=status`; errores `role=alert`; no depender de toast.
- **Formularios:** label persistente, `aria-invalid`, `aria-describedby`, `inputMode` correcto.
- **Color:** contraste de la tabla; estados con texto/icono; no solo color.
- **Movimiento:** reduced motion sin traslación/rebote; estado visible.
- **Audio:** mute persistente para `speechSynthesis`/chime; la confirmación visual no depende del audio.
- **Imágenes:** decorativas `alt=""`; informativas con alt breve; no repetir el caption.
- **Safe area:** `max(12px, env(safe-area-inset-bottom))`; probar en iPhone real.

---

## 10 · Responsive

| | 360 | 390 | 768 | 1280 |
|---|---|---|---|---|
| Navegación | Tab bar | Tab bar | Tab bar | Sidebar 240 |
| Márgenes | 16 | 16 | 24 | 32 |
| Caja | 1 col | 1 col | 1 col | 2 col (640/360) |
| Payment | Sheet 100%−16 | Sheet 100%−16 | Sheet 560 | Sheet 560 |
| Checkout | 100%−32 | 100%−32 | 480 centrado | 480 centrado |
| Tipo body | 17 | 17 | 17 | 17 |
| Targets | 44 | 44 | 44 | 44 |

- No hay “desktop = otra app”: mismos destinos y estados.
- A 768 no se fuerzan dos columnas si el contenido no cabe; se prioriza lectura.
- El ancho de lectura máximo es 680; el de app 1200.
- `data-text-zoom="large"` se activa cuando la raíz tipográfica real llega a 24 px (150 % o más). La compactación de espacio no aplica a 360 px normales; el texto nunca baja de 12 px.
- **Política axe del gate:** `serious` y `critical` bloquean. `moderate` y `minor` se guardan en `audit.json` y se revisan como deuda; no bloquean el gate.

---

## 11 · Migración desde la UI actual

| Actual | Nuevo |
|---|---|
| `CajaApp` página larga | Shell + 5 destinos |
| Hero + foto | Bienvenida/ayuda o una franja editorial; no en Caja |
| `CajaPanel` | `VoiceSaleCard` + `DraftTicket` |
| `PaymentPanel` | `PaymentSheet` |
| `BusinessOverview` + `CashCloseCard` | `CorteScreen` |
| `GoalCard` | `MetaScreen` |
| `CreditList` + `VerifyCard` | `FiadoScreen` / `VerifySheet` |
| `HelpDialog` | `Sheet` con disclosure |
| `PaidOverlay` | `PaymentResultSheet` con `role=dialog` |
| `Toast` | `StatusBanner` + `Toast` no crítico |
| `StatusBadge` | Variantes semánticas |
| `globals.css` paper tokens | `@theme` Mostrador claro |
| `receipt-edge`/`stamp`/`halftone`/`grain` | Eliminados de UI |

**No migrar a medias:** cada pantalla que entre a F3 usa tokens/componentes nuevos. Una pantalla vieja al lado de una nueva se ve rota y confunde.

---

## 12 · Decisiones abiertas

1. **¿Apple Pay está habilitado?** Si no, la opción se llama “Wallet” y no se dibuja un botón Apple Pay falso.
2. **¿La foto editorial sobrevive?** Sí, una sola, en Bienvenida/Ayuda o Meta, nunca detrás de cifras.
3. **¿Corte se actualiza solo?** Sí, al entrar y al registrar movimientos; el refresh manual queda como acción secundaria.
4. **¿Modo oscuro?** Tokens preparados, no se implementa en F3.
5. **¿“Meta” o “Camino”?** Label visible “Meta” (más corto y claro); el copy puede decir “Tu camino”.
6. **¿“Caja” o “Cobrar”?** Destino “Caja”; la acción primaria es “Cobrar”/“Confirmar venta”.

Si alguna decisión cambia, se anota aquí antes de F3.

---

## 13 · Criterios de aceptación de F2

- [ ] Cada hallazgo `HIG-01…HIG-15` tiene una decisión en este documento.
- [ ] Tokens de color con contraste medido; `success` solo para pago real.
- [ ] Escala tipográfica semántica y regla de reflujo 200%.
- [ ] Contrato de sheet/dialog con foco, Escape, retorno y `aria-live`.
- [ ] Contrato de Caja, payment, checkout, éxito, fiado, corte, meta, verificar, ayuda y demo.
- [ ] Matriz de estados y copy deck.
- [ ] Matriz responsive 360/390/768/1280.
- [ ] Migración clara desde componentes actuales.
- [ ] No se tocó código de UI en F2.
- [ ] Aprobación explícita antes de F3.

---

## 14 · Lo que no entra

- Marketplace, delivery, riders, multi-vendor, catálogo público.
- Nuevas funciones de producto (cuentas familiares, custodia, ahorro).
- App nativa, SF Pro, SF Symbols, Apple Pay falso.
- Rediseño de la lógica de dinero o del webhook.
- Dark mode en F3.
- “Liquid Glass” decorativo o animaciones porque sí.

---

## 15 · Siguiente

**F3 · Implementación por slices:**

1. Tokens + primitives (`Button`, `Field`, `Sheet`, `StatusBadge`, `TabBar/Sidebar`).
2. Shell + Caja + voz/draft.
3. Payment sheet + checkout + éxito.
4. Fiado + corte + meta + verificar + ayuda/demo.
5. Estados, accesibilidad y performance; luego F5/F6.

**Gate:** no se escribe F3 hasta que este contrato esté aprobado. La app sigue intacta y el demo sigue limpio.

---

## 16 · Actualización de dirección visual (2 de noviembre de 2026)

La revisión de diseño pidió una capa más editorial, manteniendo la claridad transaccional:

- **Tipografía:** Manrope para UI y Fraunces para títulos/marca; las cifras siguen en tabular sans.
- **Papel:** canvas cálido, grano fijo al 3.5 % (se apaga en alto contraste), doble marco sutil en cards y sombras cálidas.
- **Composición:** Caja a dos columnas desde 1280 (venta + actividad), sidebar con nota “Cuaderno de mercado”, topbar compacto y botones primarios tipo sello/pill.
- **Movimiento:** el sistema de `MOTION.md`; 140–240 ms, scroll trigger nativo y reduced-motion.

Lo que **no** cambia: 48 px, 200 %, axe serious/critical 0, foco visible, teclado, estados error≠vacío, distinción demo/efectivo/fiado/pey y la regla de `paid` solo por webhook. Esta sección reemplaza la prohibición absoluta de grano/display de §1 para la capa visual; no autoriza halftone, borde de recibo ni sellos rotados en la ruta transaccional.
