# F0 — Auditoría del shell, navegación, meta, verificación, ayuda y estados de error

> **Commit auditado:** `26d06ce` (solo docs de harness; el código viene de `999848f`).
> **Fecha:** 1 de noviembre de 2026.
> **Método:** lectura de código y capturas existentes. No ejecuté `verify:*` ni Playwright, no reinicié el servidor y no muté la demo. Hice una lectura GET de `/api/dashboard` para confirmar las cifras que se muestran.
> **Límite:** esta auditoría no sustituye TalkBack/VoiceOver, lector de pantalla de escritorio, teléfono físico ni prueba con comerciantes.

---

## 1 · Mapa del shell y navegación

### 1.1 Destinos y jerarquía

La app es una sola página con estado `Tab` (`caja | fiado | corte | meta`), no rutas. No hay URL por destino, ni historial, ni `pushState`/`popstate`: el botón Atrás del navegador sale de la app en vez de volver a la pestaña o cerrar un sheet.

| Destino | Control visible | Título / subtítulo | Contenido y acciones | Fuente |
|---|---|---|---|---|
| **Caja** | Sidebar en ≥768 px; tab inferior en <768 | `Caja`; subtítulo `Hoy $… · Por cobrar $… · Fiado $…` | Voz/texto, muestras, pedido en curso, actividad; `Verificar` en el encabezado | `caja-app.tsx:1095-1190`, `4040-4045` |
| **Fiado** | Igual | `Fiado`; `Lo que te deben, no dinero recibido.` | Saldo total, lista de clientes, `Registrar abono` en sheet | `caja-app.tsx:1192-1223`, `3446-3520` |
| **Corte** | Igual | `Corte de caja`; `Compara lo contado con lo esperado.` | Conteo, resumen del negocio, conciliación con pey | `caja-app.tsx:1225-1241`, `2523-3306` |
| **Meta** | Igual | `Meta`; `Una meta a la vez.` | Foto, progreso, `Apartar` | `caja-app.tsx:1243-1246`, `2973-3156` |

Utilidades globales:

- **TopBar**: nombre/ dirección del comercio, fecha (solo ≥640 px), pill `DEMO`, silenciar voz, `?` de ayuda (`caja-app.tsx:4120-4183`).
- **Sidebar**: marca, 4 destinos, `Modo demo` (solo demo) y `Ayuda y accesibilidad` (`4047-4118`).
- **Bottom tab bar**: mismos 4 destinos; `aria-current="page"` (`4185-4215`).
- **Sheets**: cobro, resultado, guía, verificar, modo demo, abono de fiado, confirmar corte. Todos son `role="dialog"` con foco atrapado y Escape (`4217-4354`).
- **Skip link**: `Saltar al contenido` (`1069-1074`).

La jerarquía es plana y correcta para 4 destinos, pero **Verificar no es un destino**: vive dentro del encabezado de Caja (`1113-1121`) y desaparece en Fiado/Corte/Meta. Para verificar un comprobante hay que recordar que la acción está en Caja.

### 1.2 Nombres que no coinciden

| Concepto | Nombres en la UI | Dónde |
|---|---|---|
| Ayuda | `Ayuda y accesibilidad` (sidebar), `Abrir guía` (aria-label), `Guía` (sheet) | `4107-4114`, `4173-4174`, `1339-1355` |
| Demo | `Modo demo` (sidebar), `DEMO` (topbar), `Modo demo` (sheet), `Pago demo` (badge), `Pago simulado` (resultado), `Demo` (actividad) | `4097-4105`, `4151-4158`, `1377-1382`, `3965`, `4422`, `3412` |
| Corte | `Corte` (nav), `Corte de caja` (H1), `cerrar caja` (ayuda), `Guardar corte` (acción) | `4043`, `1227`, `4637`, `2890-2898` |
| Meta | `Meta` (nav/H1), `Mi camino` (tarjeta), `Apartar` (acción), `aportación` (API/nota) | `4044`, `3068`, `3138`, `3017` |
| Pagado | `Pagado` (status), `Pago verificado` (sheet), `Pago confirmado` (ayuda) | `3964`, `4427`, `4530` |

**Consecuencia:** una persona que busca “ayuda” ve un `?` que abre “Guía”; una que busca “pago confirmado” no encuentra ese texto en la pantalla de resultado, que dice “Pago verificado”.

### 1.3 Qué se ve en el primer viewport

**360×800 (normal).** TopBar ≈123 px: nombre del negocio en dos líneas, `DEMO`, altavoz y `?`. Debajo, `Caja` + botón `Verificar` + subtítulo de tres cifras. Después, la tarjeta de venta: `¿Qué vendiste?`, `Escuchar`, micrófono, instrucciones, campo de texto, `Interpretar` y las muestras. **“Pedido en curso” y “Últimos movimientos” quedan fuera del primer viewport.** Captura: `demo/hig-after/home-360-fold.png`; página completa: `home-360-full.png`.

**390×844 (normal).** Igual, pero el nombre del negocio cabe en una línea y la tarjeta de venta está completa; el inicio de “Pedido en curso” queda debajo de la tab bar. Captura: `home-390-fold.png`.

**1280×800 (normal).** Sidebar de 240 px; el contenido mide 976 px y **no entra en la consulta de contenedor de 64 rem**, así que Caja queda en una sola columna. Primer viewport: encabezado, tarjeta de venta, “Pedido en curso” vacío; **“Últimos movimientos” no se ve**. Captura: `home-1280-fold.png`. La columna lateral de actividad solo se activa por encima de ~1340 px de viewport; a 1280 se desperdicia ancho horizontal y se pierde la lectura de lo recién cobrado (`globals.css:217-225`; `caja-app.tsx:1083`, `1094`).

**200 % de texto (inyectado como `html { font-size: 200% }`).**

- A 360×800 el TopBar ocupa ≈345 px (43 % del alto) y se reparte en tres filas; `Caja` se parte en `C / aj / a`; `Verificar` ocupa el ancho restante; el campo de venta no aparece en el primer viewport. Captura: `home-360-text200.png`.
- A 390×844, `Caja` se parte en `Caj / a`; el botón `Verificar` domina el encabezado. Captura: `home-390-text200.png`.
- A 1280×800 los labels del sidebar se parten (`Fiad / o`, `Cort / e`) y la guía parte `Norm / al`, `Grand / e`, `Muy grand / e`. Capturas: `home-1280-text200.png`, `help-1280-text200.png`.
- A 360×800 el sheet de verificar parte el título: `Verificar comproba / nte`. Captura: `verify-360-text200.png`.
- A 360×800 la pantalla Meta muestra solo encabezado, título y el inicio de la foto; **no hay cifra de meta ni acción** en el primer viewport. Captura: `meta-360-text200.png`.
- La tab bar inferior sobrevive y sigue siendo legible; el resto del shell no.

**Corte.** A 1280×800 el primer viewport alcanza “Debería haber” y el inicio de “Base para mañana”; **`Guardar corte` queda debajo del pliegue**. A 360×800 se ve el total contado y el mensaje de diferencia, pero no el botón. Capturas: `corte-1280.png`, `corte-360.png`. La tarea “cerrar caja” exige recorrer una tarjeta larga antes de la acción principal.

**Fiado.** A 360/1280 la lista y `Registrar abono` caben en el primer viewport; el problema no es el layout sino la fecha (“desde 02:01 p.m.”, sin día) que se trata en P0-5.

**Meta normal a 360.** La foto y su pie consumen ≈200 px antes de la tarjeta; `Apartar` queda por debajo de la tab bar. Captura: `meta-360.png`.

### 1.4 Navegación e historial

- Cambiar de tab conserva el scroll por tab (`196-201`, `307-320`), pero no cambia la URL ni el título del documento.
- Recargar vuelve siempre a Caja (`149`); se pierde el tab actual y el borrador de venta (estado local).
- Atrás en el navegador/móvil no cierra sheets ni vuelve al tab anterior: no hay integración con historial.
- No hay foco al H1 al cambiar de tab: el foco queda en el botón de navegación y el cambio de contenido no se anuncia. El H1 tiene `tabIndex={-1}` (`4026-4032`) pero solo se usa como fallback al cerrar un sheet.

---

## 2 · Carga cognitiva y consistencia

### 2.1 El encabezado de Caja no cuenta una sola historia

Cifras reales del `/api/dashboard` en el momento de la auditoría (GET de solo lectura): `cashCents: 7000`, `pendingCents: 12000`, `creditCents: 5000`, `demoDigitalCents: 0`, `paidOrderCount: 1`.

La UI muestra:

> `Hoy $190.00 · Por cobrar $120.00 · Fiado $50.00`

Lo que realmente significan:

- **`Hoy`** = `cashCents + verifiedDigitalCents + demoDigitalCents + pendingCents` (`caja-app.tsx:1102-1109`). Es **facturado**, no cobrado, e incluye pagos demo y pendientes. En el fixture, `$190 = $70 cobrado + $120 pendiente`. El preflight (`harness/evidence/latest.json`) llama a ese número “Ventas de hoy = $190”; la UI lo llama solo “Hoy”.
- **`Por cobrar`** = `pendingCents`, que es un subconjunto de `Hoy`; no se suma aparte.
- **`Fiado`** = `creditCents`, que en la base es **todo el saldo pendiente histórico**, sin filtro de fecha (`db.ts:618-620`). El rótulo está dentro de una línea que empieza con “Hoy”; en este fixture coincide con hoy, pero el dato no es de hoy.
- La respuesta hablada de “¿Cuánto vendí?” usa otra base: `verifiedDigitalCents + demoDigitalCents + cashCents` y dice `Hoy llevas $70.00 en 1 ventas` (`caja-app.tsx:564-576`). Es **cobrado**, no facturado, y además tiene el error de concordancia `1 ventas`.

**Impacto:** la misma palabra “Hoy” vale $190 en el encabezado y $70 en la voz; “Por cobrar” parece sumarse a “Hoy”; “Fiado” parece de hoy pero es el total. Una comerciante puede creer que tiene $190 en la caja o que el fiado de $50 es del día. Es exactamente la confusión que el goal prohíbe entre venta, cobro y saldo.

**Evidencia adicional:** la tarjeta “Mi negocio” sí etiqueta el fiado como `Saldo pendiente total` (`caja-app.tsx:2416`); el encabezado de Caja no. Es una inconsistencia interna, no una interpretación externa.

### 2.2 Nombres de estados

| Estado real | Lo que ve la persona | Observación |
|---|---|---|
| `paid` por pey | `Pagado` (status), `Pago verificado` (sheet), `confirmado por pey` | Tres nombres para el mismo hecho |
| `paid` en efectivo | `Efectivo recibido` (sheet), `Efectivo` (actividad); el status interno es `paid` | La copia global dice “Ningún pedido se marca pagado sin la confirmación firmada de pey” (`1183-1185`, `1256-1258`), pero `orders.ts:110-114` marca `paid` un pedido solo de efectivo |
| `demo_paid` | `Pago demo` (badge), `Pago simulado` (sheet), `Demo` (actividad) | “Demo” y “simulado” se alternan |
| `confirmed` | `Por cobrar` (badge), `Cobrar $…` (título del sheet) | `Por cobrar` también es el total del encabezado |
| `payment_pending` | `Esperando al banco` (badge/panel), `Pago pendiente` (aviso), `Por cobrar` (resumen) | Tres nombres; el resumen no distingue “esperando banco” de “aún no generé link” |
| `partially_paid` | `Pago parcial` (badge), `Por cobrar` (resumen) | El resumen lo agrupa con pendientes |
| `fulfilled` | `Entregado` (badge/status) | Si además hay fiado, la actividad prioriza `Fiado` y se pierde “Entregado” |
| Fiado | `Fiado`, `Quedó anotado`, `Pendiente`, `Abono parcial` | La libreta usa “pendiente” igual que un pago digital |

**“Por cobrar” vs “Fiado”** es el choque más costoso: en español cotidiano ambos son dinero que le deben. La app usa “Por cobrar” para cobros digitales pendientes y “Fiado” para la libreta; no lo explica en el encabezado, solo en el sheet de Fiado. El estado `confirmed` (“Por cobrar”) ni siquiera ha generado un link; el `payment_pending` sí. El resumen los mete en el mismo número.

**“Pagado” en efectivo.** La UI mitiga el problema en el resultado (“recibido en efectivo, sin pasar por pey”, `2022-2026`), pero el estado de la API es `paid` y la promesa del pie es absoluta. Si alguien lee el status, o si una superficie futura muestra `Pagado` para efectivo, la promesa es falsa. La frase correcta sería “Ningún **pago digital** se marca verificado sin la confirmación firmada de pey; el efectivo se registra como declarado”.

### 2.3 Ubicación de acciones y duplicación

- **Verificar** solo está en Caja. En Fiado, Corte o Meta no hay acceso; hay que recordar la ubicación.
- **Ayuda** existe dos veces en desktop: sidebar y `?` del topbar, con nombres distintos. **Demo** también: item del sidebar y pill del topbar. Ambos abren el mismo sheet, pero parecen acciones diferentes (`4097-4114`, `4151-4178`).
- **Reset de demo** está dentro del sheet “Modo demo”, con confirmación; está bien separado de la tarea de cobro.
- **Actividad** abre el sheet del pedido; no hay acciones por fila (por ejemplo, “verificar este cobro” o “recordar fiado”).
- **“Pedido en curso” vacío** ocupa una tarjeta completa con “La caja está lista” (`1770-1781`), justo antes de Actividad. En 360 y 1280 empuja los movimientos fuera del primer viewport; es una reassurence redundante con el propio prompt.

### 2.4 Ayuda contextual

`HelpContent` (`4498-4672`) abre con **Accesibilidad** (tamaño, contraste, voz), luego “Primeros pasos” y al final las preguntas. En 1280×800 el primer viewport del sheet muestra toda la accesibilidad y el inicio de “Primeros pasos”; las preguntas quedan debajo. En 360×800 a 200 % no se ve **ningún control completo** en el primer viewport: al final apenas asoman el título “Tamaño del texto” y el borde de los botones.

Problemas concretos:

- El título es `Guía`, pero la entrada dice `Ayuda y accesibilidad` y el aria-label `Abrir guía`.
- Quien abre ayuda para “¿cómo cobro?” recibe primero ajustes de accesibilidad. La primera pregunta está después de ~500 px de controles (`4537-4640`).
- `¿Cuándo está pagado?` dice que la app muestra **“Pago confirmado”** (`4530`), texto que no existe en la UI; el sheet dice **“Pago verificado”** (`4427`) y el badge **“Pagado”** (`3964`).
- “Primeros pasos” usa **“webhook firmado”** (`4636`), jerga que el resto de la UI evita; debería decir “confirmación del banco”.
- No hay ninguna pregunta sobre **cómo verificar un comprobante, de dónde sale el ID, qué hacer si el pago no llega o si el cliente muestra un comprobante viejo**.
- **“Leer esta pantalla”** (`4611-4618`) ejecuta `readScreen`, que busca `h1`, `h2`, `[role=status]` y `[role=alert]` dentro de `main` (`465-476`). El sheet de ayuda está en un portal fuera de `main` (`4309-4353`). Al pulsarlo desde la guía se lee la pantalla de atrás, no la guía; lo mismo pasa desde verificar o cobrar. Además, omite párrafos, labels y botones: no lee “Mantén y habla”, las instrucciones ni el total actual.
- `Repetir último aviso` sí repite el último texto hablado; su nombre es claro (`4619-4626`).

### 2.5 Verificación

- El sheet pide “Pega el ID de la transacción” (`3739-3742`) y el ejemplo es un ULID (`01HXY…`). La app **nunca muestra ese ID**: el pedido solo expone `shortOrder`, el QR muestra `numRef`, y el checkout/éxito no incluyen `transactionId`. La persona tiene que obtenerlo fuera de la app (banco, comprobante del cliente) sin que la ayuda lo explique.
- La acción solo está en Caja; no se puede verificar desde el pedido pendiente.
- `/api/verify` devuelve `verified: true` para **cualquier** pago local con ese `transactionId` y `provider = 'pey'` (`api/verify/route.ts:17-46`). No compara con el pedido abierto, el monto actual ni la fecha. La UI muestra `orderId` en el resultado (`3821-3823`), pero no una fecha ni una advertencia de “este pago pertenece a otro pedido / es de otro día”. Un comprobante válido de una venta anterior puede parecer suficiente.
- `Probar con un comprobante falso` (`3767-3773`) está siempre visible, también fuera de demo. Rellena un ID falso y muestra un resultado rojo “No entregues”; en un mostrador real es una acción de prueba que puede asustar o confundir.
- `verifyId` y `verifyResult` no se limpian al cerrar el sheet (`182-184`; cierre en `1359-1362`). Al reabrirlo, el ID falso o el resultado verde anterior siguen ahí; en un mostrador compartido se puede atribuir el resultado a otro cliente.
- Lo bueno: el resultado hace foco (`3731-3735`), distingue demo (azul, “Verificado en la demo”) de real (verde), y un no verificado dice “No entregues el pedido” (`3790-3829`). El error de red usa `friendlyError` y ofrece reintento (`956-958`).

### 2.6 Meta (pantalla) y metadatos

**Pantalla Meta.**

- La tarjeta se llama `Mi camino` y el destino `Meta`; `Apartar` es la acción. No es grave, pero son tres nombres para el mismo objeto.
- La foto va **antes** de la tarjeta de progreso (`3051-3064`). En 360 normal, `Apartar` queda debajo de la tab bar; en 200 %, no hay cifra ni acción en el primer viewport (`meta-360.png`, `meta-360-text200.png`).
- **No se puede crear una meta desde la UI.** El estado vacío dice “Aún no hay una meta / La primera puede ser algo concreto para tu puesto” y no ofrece acción (`3037-3046`). La API `POST /api/goals` existe (`api/goals/route.ts:13-27`) pero la UI no la usa. En un negocio sin meta, la pestaña es un callejón sin salida.
- **El error de carga se muestra como vacío.** `load` guarda `error` (`2984-2996`), pero si no hay `goal` el render devuelve el estado vacío (`3033-3047`) y nunca muestra el error. Una caída de `/api/goals` se lee como “no tengo meta”.
- **Aportar no se confirma ni se corrige.** `Apartar` hace POST inmediato (`3004-3031`), sin confirmación; no hay lista de aportaciones ni forma de deshacer/editar. Un monto mal tecleado queda en el saldo declarado.
- **Datos sembrados en todos los modos.** `seedGoal` inserta “Mi primera sombrilla” con $300 ahorrados si no hay metas (`db.ts:246-266`) y `seed` inserta una venta de $70 en efectivo y un fiado de Juan de $50 (`db.ts:211-233`). `seedDemoHistory` sí respeta demo (`269`), pero `seed` y `seedGoal` no. Si `DEMO_MODE=false`, la app muestra datos inventados sin badge DEMO. En el modo demo actual es intencional; para el modo real es una mentira de dinero.
- La nota “Apartado declarado: no es una cuenta bancaria ni dinero custodiado” es clara y correcta (`3148-3151`).

**Metadatos HTML.** `title` y `description` están en `layout.tsx:11-15`. La descripción dice “confirma un pago solo cuando el banco lo confirma”, pero la app también marca `paid` un pago en efectivo. Además no hay título por destino: la pestaña del navegador siempre es “Mercado Cero · La caja que habla”, también en Corte o Meta. No hay `openGraph`, `manifest` ni `themeColor`; no es bloqueante, pero el `description` debe precisar “pago digital”.

---

## 3 · Errores y estados vacíos

### 3.1 Matriz de estados

| Superficie / disparador | Qué ve la persona | ¿Puede recuperarse? | Evidencia |
|---|---|---|---|
| **Falla `/api/dashboard` al abrir** | Toast de 3 s con `Failed to fetch` (mensaje crudo en inglés); el topbar cae al comercio hardcodeado “Antojitos de Lupita / Coyoacán, CDMX”; **desaparece el pill DEMO** (`demoMode` pasa a `false`); el subtítulo queda **“Cargando la caja…” para siempre**; Actividad dice **“Aún no hay ventas”**; Fiado dice **“Sin fiados pendientes”** | No. No hay botón de reintento ni estado de error; hay que recargar el navegador. Peor: el mismo error se reintenta en bucle (ver 3.2) | `225-237`, `218-223`, `239-264`, `1101-1110`, `3338-3341`, `3473-3480`, `4142-4146`, `1078`, `1087` |
| **Falla `/api/goals` al abrir Meta** | “Aún no hay una meta”; el error de red se ignora | No; no hay crear meta | `2984-2996`, `3033-3047` |
| **El cliente paga después de cerrar el sheet de cobro** | La actividad y el resumen no se actualizan; no hay polling global ni botón “Actualizar” en Caja | Solo recargando o haciendo otra operación que dispare `loadDashboard` | `896-928`, `263`, `807`, `858`, `886`, `994`, `1020` |
| **Falla la consulta de estado mientras “Esperando al banco”** | El `catch` del polling se traga el error cada 3 s (`catch {}`); el panel sigue con el punto pulsante y “Esta pantalla se actualiza sola…” | No; no hay “última revisión”, “sin conexión” ni “reintentar” | `896-928`, `2231-2243` |
| **Sin conexión en cualquier acción** | No hay banner de offline. Según el endpoint: errores en inglés (`Failed to fetch`) o mensajes en español; algunos usan `friendlyError`, otros no | Depende de la pantalla; no hay cola ni estado global | `136-144`; usos en `824-825`, `956-958`, `1017-1024`; fuera de uso en `232-233`, `657-659`, `859-860`, `887-888`, `2989-2993` |
| **Falla el parser/IA al iniciar una venta** | `voiceError` con el mensaje del servidor; no se crea el primer producto. El botón **“Agregar producto” solo existe cuando ya hay un draft** (`1751-1768`), y el texto alternativo también llama a `/api/voice/parse` (`581-593`) | No se puede vender manualmente desde cero sin que el parser responda. El fallback local del servidor solo se usa si no hay `OPENAI_API_KEY`, no si la llamada falla (`voice.ts:62-101`) | `581-659`, `1751-1781`, `voice.ts:62-101` |
| **Error al crear venta** | Error inline persistente; conserva el draft; si es red, agrega “Revisa tu conexión…” | Sí, corrigiendo/reintentando | `764-841`, `1620-1627` |
| **Error al registrar abono de fiado** | Error inline en el sheet; el botón sigue disponible | Sí | `965-1002`, `3681` |
| **Error al verificar** | Tarjeta inline con foco; “No se pudo verificar” + mensaje | Sí, corrigiendo el ID o reintentando | `930-963`, `3775-3788` |
| **Error al guardar corte** | Error inline en la tarjeta o en el sheet de confirmación | Sí, con el mismo botón | `2606-2658`, `2884-2888`, `2945-2949` |
| **Error al cargar corte** | Error inline; el icono de refrescar sigue arriba | Sí, refrescando | `2542-2563`, `2678-2686` |
| **Error al cargar “Mi negocio”** | Error inline, sin botón de reintento; se recupera con el próximo `mercado:refresh` | Parcial | `2281-2304`, `2371-2374` |
| **Error al conciliar** | Error inline; `Conciliar` sigue disponible | Sí | `3164-3186` |
| **Error al copiar/compartir** | Toast de 3 s | Sí, repitiendo | `1297-1323` |
| **Falla el reset de demo** | El sheet se cierra antes del POST; si falla, solo toast de 3 s | Sí, reabriendo el sheet | `1383-1389`, `1043-1062` |
| **Excepción de render** | No hay `error.tsx`, `global-error.tsx` ni `not-found.tsx` en `web/src/app/`; Next muestra su pantalla por defecto | No hay recuperación en español | ausencia de archivos; `web/src/app/` |

### 3.2 El bucle de recarga del dashboard

No es solo que el error se muestre mal: se reintenta sin control.

1. `loadDashboard` falla y llama `showToast("error", …)` (`225-237`).
2. `showToast` hace `setToastTimer(timer)` (`218-223`).
3. `showToast` depende de `toastTimer`; al cambiar el timer cambia su identidad, cambia `loadDashboard`, y el efecto de montaje que depende de `loadDashboard` (`239-264`) vuelve a ejecutarse.
4. Vuelve a fallar, vuelve a crear un timer nuevo y vuelve a disparar el efecto.

Con el servidor caído, esto es un **bucle de fetch y toasts**, no un estado de error estable. No lo ejecuté para no golpear la demo; se deduce del grafo de dependencias. La corrección mínima es un `useRef` para el timer y un `loadDashboard` estable, más un estado `error` explícito con reintento.

### 3.3 Errores que se disfrazan de vacío

- **Actividad:** recibe `orders={dashboard?.orders ?? []}` y `loading={loading}`; si el dashboard falló, `loading` es `false` y `orders` es `[]`, así que muestra “Aún no hay ventas. Habla para crear la primera.” (`1173-1180`, `3307-3341`). Es falso: no sabe si no hay ventas o no pudo cargarlas.
- **Fiado:** recibe `pendingCredits` calculado de `dashboard?.credits` (vacío si falló); muestra “Sin fiados pendientes” (`1065`, `1194-1203`, `3473-3480`). Igual de falso.
- **Meta:** el error local se ignora si `goal` es `null` (`3033-3047`).
- **Encabezado:** “Cargando la caja…” convive con “Aún no hay ventas” en la misma pantalla (`1101-1110` vs `3338-3341`). Dos estados contradictorios.
- **Demo:** el fallback `dashboard?.demoMode ?? false` quita el pill DEMO y el acceso a “Modo demo” (`1078`, `1087`). La app puede verse real sin serlo, justo lo que el goal prohíbe.

### 3.4 Estados vacíos legítimos

| Estado | Texto | ¿Ayuda a continuar? |
|---|---|---|
| Sin ventas | “Aún no hay ventas. Habla para crear la primera.” | Sí, pero solo si de verdad no hay ventas; hoy también aparece en error |
| Sin fiados | “Sin fiados pendientes / Cuando apuntes uno, aparecerá aquí.” | No dice **dónde** se apunta; hay que ir a Caja y hacer una venta a fiado |
| Sin meta | “Aún no hay una meta / La primera puede ser algo concreto para tu puesto.” | No hay acción; la API permite crear pero la UI no |
| Sin pagos digitales en conciliación | “No hay pagos digitales hoy.” | Correcto y explicativo |
| Sin comprobante | Campo vacío; `Verificar` deshabilitado | Aceptable, pero no explica de dónde obtener el ID |
| Corte sin conteo | “Escribe el total contado para ver si cuadra.” | Correcto |
| Corte ya guardado | `counted` se precarga con el valor guardado y puede mostrar “Cuadra” antes de volver a contar; el aviso “Último corte guardado” está más abajo, y el `savedNotice` desaparece al recargar | **Riesgo:** parece que ya contaste hoy. Debe decir “Corte ya guardado hoy: $570” junto al campo, o dejar el conteo vacío y exigir “Volver a contar” |

### 3.5 Toasts

`Toast` vive 3 segundos (`220-221`), se monta en un portal y no tiene pausa al pasar el cursor ni al enfocar (`3860-3882`). Los errores críticos que solo usan toast son: carga de dashboard, generación de link, demo pay, reset de demo, copiar/compartir. A 200 % o para una persona que lee despacio, 3 s no alcanzan; y un `role="alert"` que desaparece no deja forma de releer el mensaje. Los errores de venta/abono/verificación/corte sí son inline y persistentes; esa es la dirección correcta.

---

## 4 · Accesibilidad cognitiva

### 4.1 200 % de texto: lo automatizado dice verde, la captura dice otra cosa

`ACCESIBILIDAD.md:11` marca “texto escalable / 200 %” como ✅ y `harness/STATE.md:22` reporta HIG/WCAG 2.2 AA con 200 %. La evidencia visual de la misma corrida (`demo/hig-after/`, `audit.json`, `started 2026-11-01T14:02:24`) contradice esa lectura:

| Captura | Lo que falla |
|---|---|
| `home-360-text200.png` | `Caja` → `C / aj / a`; `Verificar` domina; header 345/800 px (43 %); campo de venta fuera del primer viewport |
| `home-390-text200.png` | `Caja` → `Caj / a`; mismo header de tres filas |
| `home-1280-text200.png` | Sidebar: `Fiad / o`, `Cort / e`; la navegación deja de ser reconocible |
| `help-1280-text200.png` | `Norm / al`, `Grand / e`, `Muy grand / e`; los controles se rompen |
| `help-360-text200.png` | Ningún control completo en el primer viewport; solo el título “Tamaño del texto” y el borde de los botones al final |
| `verify-360-text200.png` | Título `Verificar comproba / nte` |
| `meta-360-text200.png` | Solo header, `Meta` y el inicio de la foto; ni cifra ni `Apartar` |

Causas concretas:

- El `body` aplica `overflow-wrap: break-word` global (`globals.css:68`). Cualquier palabra puede partirse cuando un contenedor se encoge.
- `ScreenHeading` usa `flex` + `min-w-0` en el H1 y `shrink-0` en la acción (`4024-4035`). A 360/200 %, `Verificar` mide más que el espacio disponible y el H1 se queda con una franja de ~1 carácter; el `break-word` global parte “Caja”.
- El sidebar mide `w-[220px]`/`w-[240px]` fijos (`4061`), pero íconos, padding y texto son `rem`: al duplicar la raíz, el contenido no cabe y `break-words` (`4082-4090`) parte “Fiado”.
- El título de los sheets tiene `break-words` explícito (`4330-4336`); a 360/200 %, “comprobante” se parte.
- La guía usa una grilla de 3 columnas fijas para texto/velocidad (`4548-4565`, `4590-4607`); a 200 % no caben las palabras.
- El TopBar usa `min-w-[8rem]` y `flex-wrap` (`4138-4147`); a 200 % la fila del comercio, la del DEMO y la de los iconos se separan, y el header triplica su altura.

**El gate no lo detecta.** `hig-after-audit.py` inyecta `html { font-size: 200% }` (`312-315`) y mide overflow horizontal, clipping contra el viewport, solapamiento de targets, axe y 48 px (`561-591`). Un texto partido dentro de su propia caja, o contenido empujado debajo del pliegue, no cuenta como `clipped`; por eso `homeText200.clippedCount = 0` y `failures: []`. **“Sin clipping” no es “sin pérdida visual”.**

Además, el control de la app “Muy grande” pone la raíz en 20 px (`globals.css:72-78`), ~125 % de 16 px, no 200 %. Quien solo usa los ajustes de la app nunca llega al tamaño que la prueba inyecta; quien usa zoom del navegador sí, y ahí aparecen las rupturas.

### 4.2 Foco, teclado y lector de pantalla

**Verificado por artefacto (no por mí):**

- `helpInitialFocus: true` en los 4 viewports; el foco entra al diálogo.
- `helpClosedWithEscape: true`; Escape cierra.
- La secuencia de foco de la guía recorre Cerrar → Normal → Grande → Muy grande → Alto contraste → Lenta (`audit.json`).
- El `Sheet` atrapa Tab/Shift+Tab, enfoca el título al abrir y devuelve el foco al disparador (`4240-4305`).
- Skip link, `aria-current`, `aria-pressed`, `aria-expanded`, `role=status/alert`, nombres en iconos; targets de 48 px y `under48Count: 0` en la corrida.

**No verificado / con riesgo alto:**

- **Micrófono con lector de pantalla.** El botón no tiene `onClick`; solo `onPointerDown/Up` y `onKeyDown/Up` (`1492-1520`). VoiceOver/TalkBack activan con doble toque, que despacha un click; sin `onClick`, no hay forma fiable de iniciar la grabación con lector. Además, “mantén presionado” es difícil con doble toque. No lo probé en dispositivo; el riesgo es alto porque la voz es la entrada principal.
- **Cambio de tab sin anuncio.** `selectTab` cambia el estado y restaura scroll, pero no mueve foco al H1 ni usa una live region (`307-320`). Un lector puede quedarse en el botón y no enterarse de que cambió el contenido.
- **Fondo del sheet no inerte.** `aria-modal="true"` y la trampa de Tab no hacen `inert`/`aria-hidden` del `main`; el cursor virtual del lector puede seguir leyendo la pantalla de atrás (`4309-4353`). No hay prueba con lector.
- **Botones “Registrar abono” repetidos.** El nombre accesible es solo “Registrar abono”; con varios clientes no se distingue a quién (`3506-3513`). Falta `aria-label` con el nombre del cliente.
- **“Leer esta pantalla”** no lee la pantalla: solo h1/h2/status/alert de `main`, y desde un sheet lee la pantalla de atrás (`465-476`, `4611-4618`). No sustituye a un lector; la etiqueta promete más de lo que hace.
- **La marca “0”** es un `div` con texto; puede leerse como “cero” antes de “Mercado Cero”. Es decorativa y debería ser `aria-hidden`.
- **El footer global** está dentro de `main` (`1248-1259`), así que no es un landmark `contentinfo`; un lector que busca el pie no lo encuentra.
- **El título del documento** no cambia al cambiar de tab; la ventana siempre dice “La caja que habla”.

**No probado:** NVDA, TalkBack, VoiceOver, teclado de punta a punta (Caja → cobro → sheet → Fiado), retorno de foco tras cerrar cada sheet, switch/control por voz.

### 4.3 Color, contraste y movimiento

- Los estados visibles usan **icono + texto + forma**, no solo color: DEMO (flask + palabra), pendiente (reloj + “Esperando al banco”), fiado (libreta + “Fiado”), demo (flask + “Demo”). La barra de progreso de Meta tiene `role="progressbar"`, `aria-valuenow` y el porcentaje textual (`3085-3097`).
- Las barras del gráfico de “Mi negocio” son **solo color** (verde/terracota) con `title`; el texto “Efectivo/Digital” está arriba (`2426-2452`). No es información esencial, pero no se probó con daltonismo.
- **Alto contraste:** existen tokens (`globals.css:80-104`) y un botón persistente, pero **no hay captura de hig-after con alto contraste** y no lo ejecuté. No puedo afirmar que se vea bien.
- **Contraste:** axe 0 en la corrida; no hice medición manual de placeholders (`text-ink-2/40`, `/60`) ni del estado deshabilitado.
- **Movimiento reducido:** la regla `prefers-reduced-motion` existe (`globals.css:270-279`), pero no hay captura ni prueba de que las animaciones de sheet/mic/result se detengan correctamente. No lo ejecuté.

### 4.4 Lenguaje claro y memoria

- Familiar y bueno: `Caja`, `Fiado`, `Corte`, `Meta`, `apartar`, `abono`, `fiado`, `cambio`, `corte`.
- Jerga visible: `webhook` (`4636`), `pey` (`1184`, `3741`, `4530`, `3218`), `ID de la transacción` (`3740`), `Conciliación` (`3195`), `Base inicial` (`2811`), `apartado declarado` (explicado). “pey” y “webhook” deberían quedar en ayuda técnica o sustituirse por “la confirmación del banco”.
- Memoria exigida:
  - **Verificar:** recordar el ID de una transacción que la app no muestra.
  - **Actividad y Fiado:** recordar la fecha, porque solo se muestra la hora.
  - **“Por cobrar” vs “Fiado”:** recordar la diferencia que solo se explica en Fiado.
  - **“¿Dónde está Verificar?”:** recordar que está dentro de Caja.
  - **Corte:** recordar si el conteo precargado es de hoy o del corte anterior.

---

## 5 · Candidatos P0 (máximo 5)

> No propongo un módulo nuevo en F0. “Pendientes” o un chatbot no se justifican antes de arreglar la verdad del shell, el dinero y los estados. Los cinco son correcciones de shell, copy/estado y ayuda; ninguno requiere tocar el webhook ni la lógica de pey.

### P0-1 · El shell se rompe al 200 % de texto (shell)

**Impacto:** a 360/390 no se puede leer “Caja” (se parte en letras) y el campo de venta queda fuera del primer viewport; a 1280/200 los destinos “Fiado” y “Corte” del sidebar se parten, y en la guía se rompen “Normal / Grande / Muy grande”; a 360/200 el título “Verificar comprobante” se parte. A 360, el header ocupa el 43 % del primer viewport. La app declara 200 % ✅ con capturas que muestran lo contrario. Es el hallazgo más grave de accesibilidad y el más fácil de demostrar.

**Esfuerzo:** M. **Riesgo:** bajo (CSS/layout; no dinero).

**Primer corte:**
1. Quitar `overflow-wrap: break-word` global del `body` o limitarlo a párrafos largos.
2. En `ScreenHeading`, apilar título y acción con una container query cuando el ancho sea estrecho; nunca dejar que el H1 compita con un botón `shrink-0`.
3. Sidebar con ancho fluido o modo icono+label de dos líneas a 200 %; quitar `break-words` de labels cortos.
4. Guía: 1 columna a 200 % (o 2), no 3.
5. TopBar: una fila compacta a 360/200 % (nombre truncado con `title`, DEMO como badge, iconos), no tres filas.

**Evidencia:** `globals.css:68`, `caja-app.tsx:4024-4035`, `4061`, `4082-4090`, `4138-4147`, `4330-4336`, `4548-4565`; capturas `home-360-text200.png`, `home-390-text200.png`, `home-1280-text200.png`, `help-1280-text200.png`, `verify-360-text200.png`, `meta-360-text200.png`; `hig-after-audit.py:312-315`, `561-591`.

### P0-2 · Un fallo de red o de IA se convierte en datos falsos y en un bucle (shell/estado)

**Impacto:** si `/api/dashboard` falla una vez, la app muestra un comercio de ejemplo, **oculta el badge DEMO**, dice “Cargando…” indefinidamente, y al mismo tiempo “no hay ventas” y “no hay fiados”. El error se reintenta en bucle porque `showToast` cambia `loadDashboard`. Si falla el parser, no se puede agregar el primer producto manualmente y la venta queda bloqueada. Esto viola la ley 5 (“la IA no bloquea lo esencial”) y la promesa demo≠real.

**Esfuerzo:** M. **Riesgo:** medio (toca el estado de carga y el parser; no la persistencia).

**Primer corte:**
1. Estado explícito `loading | error | empty` a nivel app; error inline persistente con “Reintentar”.
2. Estabilizar `showToast` con un `useRef` para el timer y quitar `toastTimer` de las dependencias; el efecto de carga debe correr una vez.
3. No renderizar el comercio hardcodeado ni asumir `demoMode=false` mientras no haya dashboard; mostrar “Cargando datos del negocio” y mantener el modo demo conocido (o un estado “desconocido” que no se vea real).
4. Pasar `error` a `ActivityList` y `CreditList`; nunca mostrar vacío si la carga falló.
5. Mostrar “Agregar producto” también con draft vacío; si `/api/voice/parse` falla, ofrecer el alta manual y el parser local del servidor como fallback (no solo cuando falta la API key).

**Evidencia:** `caja-app.tsx:218-237`, `239-264`, `1101-1110`, `3338-3341`, `3473-3480`, `4142-4146`, `1078`, `1087`, `1751-1781`, `581-659`; `voice.ts:62-101`; `demo/hig-after/home-360-full.png` (tres filas de días distintos, ver P0-5).

### P0-3 · “Hoy / Por cobrar / Fiado” y “Pagado / verificado / confirmado” no son una sola verdad (copy/estado)

**Impacto:** el encabezado principal mezcla facturado, cobrado, pendiente y fiado histórico; la voz dice otra cifra para “Hoy”. “Por cobrar” se confunde con fiado y el estado `paid` incluye efectivo, aunque el pie diga que ningún pedido se marca pagado sin pey. La persona no puede explicar cuánto tiene, cuánto le deben y cuánto vendió. Es el corazón de “sé qué pasó con mi dinero”.

**Esfuerzo:** M (solo copy + derivación de labels; no cambiar cálculos de dinero). **Riesgo:** medio (muchas superficies; validar con `preflight` y webhook 27/27, que no se tocan).

**Primer corte:**
1. Encabezado: `Ventas de hoy $190 · Cobrado $70 · Por cobrar $120` y `Fiado pendiente total $50` (o “Te deben $50”), con una línea que explique que “Por cobrar” es digital y “Fiado” es libreta.
2. Voz: usar la misma base y concordancia (`1 venta`, no `1 ventas`).
3. Unificar `Pagado`/`Pago verificado`/`Pago confirmado` en una sola frase, por ejemplo `Pagado · confirmado por el banco`; demo `Pago demo`; efectivo `Cobrado en efectivo`.
4. Cambiar el pie a “Ningún **pago digital** se marca verificado sin la confirmación firmada de pey. El efectivo se registra como declarado.”
5. `Por cobrar` → `Pagos pendientes` o `Esperando al banco`; reservar “Fiado” para la libreta.

**Evidencia:** `caja-app.tsx:1102-1109`, `564-576`, `2416`, `3958-3969`, `4422-4453`, `4530`, `1183-1185`, `1256-1258`; `db.ts:618-620`; `orders.ts:110-114`; `layout.tsx:11-15`; capturas `home-360-fold.png`, `stageshow/03-cobro-pendiente.png`, `stageshow/05-pago-simulado.png`.

### P0-4 · Verificar exige un ID que la app no da, y la ayuda no responde (ayuda)

**Impacto:** la función anti-fraude no se puede completar con lo que la app muestra. El ID no aparece en el pedido, el checkout ni el éxito; la ayuda no dice de dónde sale. Peor: `/api/verify` acepta cualquier pago local con ese `transactionId`, sin comparar pedido, monto ni fecha; un comprobante viejo puede parecer válido. “Probar con un comprobante falso” está visible en modo real. La guía abre con accesibilidad, usa “webhook”, y “Leer esta pantalla” lee la pantalla de atrás.

**Esfuerzo:** M. **Riesgo:** bajo-medio (la comparación pedido/monto/fecha toca la respuesta de verify; no el webhook).

**Primer corte:**
1. Mostrar el ID/folio en el detalle del pedido cuando exista, y un botón `Verificar este cobro` que precargue el ID y compare `orderId`/monto/fecha.
2. Si el resultado es de otro pedido u otro día, decirlo explícitamente: “Este pago ya está aplicado al pedido 81E6 del 31 oct. No corresponde a este cobro.”
3. Ocultar o etiquetar “Probar con un comprobante falso” solo en demo.
4. Limpiar `verifyId`/`verifyResult` al cerrar el sheet, o mostrar “resultado anterior” con fecha.
5. Reordenar la guía: primero “¿Qué necesitas?” / “¿Cómo cobro?” / “¿Cómo verifico?”; después accesibilidad. Unificar “Guía” → “Ayuda y accesibilidad”.
6. `Leer esta pantalla` debe leer el diálogo abierto (o cambiar a “Leer la guía” y leer su contenido), no `main`.
7. Sustituir “ID de la transacción / pey / webhook” por “folio o número de operación / confirmación del banco”.

**Evidencia:** `caja-app.tsx:1113-1121`, `3739-3773`, `182-184`, `1359-1362`, `4530`, `4636`, `4611-4618`, `465-476`; `api/verify/route.ts:17-66`; capturas `verify-360.png`, `verify-1280-text200.png`, `help-1280.png`, `help-360-text200.png`.

### P0-5 · El día no tiene fecha y no se mantiene al día (copy/estado)

**Impacto:** “Últimos movimientos” mezcla hoy con el 31 de octubre y el 7 de octubre y solo muestra la hora; “Fiado · desde 02:00 p.m.” no dice si es de hoy o de hace tres semanas. Además, si el cliente paga después de cerrar el sheet, el dashboard no se refresca: la persona puede creer que no le pagaron. Es la promesa “sé qué pasó con mi dinero” rota por dos lados.

**Esfuerzo:** M. **Riesgo:** medio (polling/refresh y formato; no lógica de dinero).

**Primer corte:**
1. Formatear `Hoy 2:00 p.m.`, `Ayer 2:20 p.m.`, `31 oct`; agrupar Actividad por día.
2. En Fiado, mostrar “desde hoy / hace N días” y la fecha absoluta en el detalle.
3. Refrescar el dashboard cada 30–60 s mientras la app está visible, con “Última revisión 2:03 p.m.” y un botón “Actualizar”; no confiar solo en el sheet abierto.
4. En el panel “Esperando al banco”, mostrar la última consulta y un estado “sin conexión / no pudimos consultar” con reintento.
5. Si el pago llega con la app en otra pestaña, una notificación/badge en Caja y Fiado, no un cambio silencioso.

**Evidencia:** `caja-app.tsx:3317-3330`, `3395-3416`, `3493-3495`, `896-928`, `2231-2243`, `263`; `format.ts:16-22`; `home-360-full.png` (fila “02:20 p.m. · Demo” del 31 oct), `fiado-360.png`, `fiado-1280.png`; `db.ts:577-625` (rango de hoy) y `listOrders(30)`.

---

## 6 · Evidencia

### 6.1 Código

| Tema | Archivo:línea |
|---|---|
| Cifras del encabezado | `web/src/components/caja-app.tsx:1102-1109` |
| Respuesta hablada “Hoy” | `web/src/components/caja-app.tsx:564-576` |
| Fiado histórico | `web/src/lib/db.ts:618-620` |
| Resumen diario | `web/src/lib/db.ts:577-625` |
| Etiquetas de estado | `web/src/components/caja-app.tsx:3958-3969`, `3923-3956`, `3988-3990` |
| Efectivo marcado `paid` | `web/src/lib/orders.ts:110-114` |
| Copia “sin firma no hay pagado” | `web/src/components/caja-app.tsx:1183-1185`, `1256-1258` |
| Ayuda “Pago confirmado” | `web/src/components/caja-app.tsx:4530` |
| Resultado “Pago verificado” | `web/src/components/caja-app.tsx:4422-4453` |
| Encabezado y H1 | `web/src/components/caja-app.tsx:4024-4035` |
| TopBar | `web/src/components/caja-app.tsx:4120-4183` |
| Sidebar / labels | `web/src/components/caja-app.tsx:4047-4118` |
| Sheet / foco / Escape | `web/src/components/caja-app.tsx:4217-4354` |
| Título de sheet partido | `web/src/components/caja-app.tsx:4330-4336` |
| Guía: orden y controles | `web/src/components/caja-app.tsx:4498-4672` |
| “Leer esta pantalla” | `web/src/components/caja-app.tsx:465-476`, `4611-4618` |
| Verificar: ID, falso, resultado | `web/src/components/caja-app.tsx:3739-3832` |
| Verificar: estado persistente | `web/src/components/caja-app.tsx:182-184`, `1359-1362` |
| API verify sin pedido/fecha | `web/src/app/api/verify/route.ts:17-66` |
| Carga dashboard / loop | `web/src/components/caja-app.tsx:218-237`, `239-264` |
| Fallback comercio / demo falso | `web/src/components/caja-app.tsx:4142-4146`, `1078`, `1087` |
| Actividad sin error | `web/src/components/caja-app.tsx:3307-3341` |
| Fiado sin error | `web/src/components/caja-app.tsx:1194-1203`, `3473-3480` |
| Meta: error como vacío | `web/src/components/caja-app.tsx:2984-2996`, `3033-3047` |
| Meta: sin crear / sin deshacer | `web/src/components/caja-app.tsx:3004-3031`, `3037-3046`; `web/src/app/api/goals/route.ts:13-27` |
| Meta: foto antes que datos | `web/src/components/caja-app.tsx:3051-3140` |
| Semilla de meta/venta/fiado | `web/src/lib/db.ts:211-266` |
| Polling y “se actualiza sola” | `web/src/components/caja-app.tsx:896-928`, `2231-2243` |
| Parser / alta manual bloqueada | `web/src/components/caja-app.tsx:581-659`, `1751-1781`; `web/src/lib/voice.ts:62-101` |
| `formatTime` sin fecha | `web/src/lib/format.ts:16-22` |
| `overflow-wrap` global | `web/src/app/globals.css:68` |
| Tamaños de texto | `web/src/app/globals.css:72-78` |
| Contenedor de Caja | `web/src/app/globals.css:208-226` |
| Metadatos | `web/src/app/layout.tsx:11-15` |
| Gate 200 % | `web/scripts/hig-after-audit.py:29`, `312-315`, `561-591` |

### 6.2 Capturas

- `demo/hig-after/home-360-fold.png` — 360 normal: primer viewport sin Actividad.
- `demo/hig-after/home-360-full.png` — 360 completo: “15 pedidos”, fila Demo del 31 oct sin fecha.
- `demo/hig-after/home-390-fold.png` — 390 normal: tab bar tapa “Pedido en curso”.
- `demo/hig-after/home-1280-fold.png` — 1280 normal: una columna, sin Actividad en el primer viewport.
- `demo/hig-after/home-360-text200.png` — `C / aj / a`, header de 3 filas.
- `demo/hig-after/home-390-text200.png` — `Caj / a`.
- `demo/hig-after/home-1280-text200.png` — `Fiad / o`, `Cort / e`.
- `demo/hig-after/help-1280-text200.png` — `Norm / al`, `Grand / e`.
- `demo/hig-after/help-360-text200.png` — sin controles en el primer viewport.
- `demo/hig-after/verify-360-text200.png` — `Verificar comproba / nte`.
- `demo/hig-after/meta-360-text200.png` — solo foto, sin meta en el primer viewport.
- `demo/hig-after/meta-360.png` — `Apartar` bajo la tab bar.
- `demo/hig-after/help-1280.png` — ayuda abre con accesibilidad; FAQ debajo.
- `demo/hig-after/verify-360.png` — ID falso y “No verificado”.
- `demo/hig-after/fiado-1280.png` — “desde 02:01 p.m.” sin fecha.
- `demo/stageshow/03-cobro-pendiente.png` — “Cobrar $90” + badge “POR COBRAR”.
- `demo/stageshow/05-pago-simulado.png` — “Pago simulado” y CTA verde “Listo para entregar”.
- `demo/stageshow/07-corte.png` — corte precargado $570 y “Cuadra”.
- `demo/stageshow/08-meta.png` — meta normal a 1280.

### 6.3 Evidencia automatizada existente

- `demo/hig-after/audit.json`: `failures: []`; `homeAxe.violations: []`; `helpInitialFocus: true`; `helpClosedWithEscape: true`; `under48Count: 0`; `clippedCount: 0` en `homeText200`/`helpText200`.
- `harness/evidence/latest.json`: `ok: true`; `gitAtStart.sha: 999848f`; HIG gate `ok: true`; preflight 18/18; móvil 25/25.
- `harness/STATE.md:22` declara 360/390/768/1280, axe 0, 48 px y 200 %.
- **Contradicción:** las capturas de ese mismo `hig-after` muestran las rupturas de 4.1. La evidencia está en el repo, no en una ejecución nueva.

---

## 7 · Lo que no pude verificar

1. **No ejecuté `verify:*`, Playwright, `mobile-audit.py`, `hig-after-audit.py`, `preflight` ni el webhook.** La evidencia de gates es histórica (`999848f`); HEAD `26d06ce` solo cambia docs. No hay una corrida nueva contra `26d06ce`.
2. **No probé TalkBack, VoiceOver, NVDA ni lector de pantalla de escritorio.** Todo lo de 4.2 es código + artefactos, no observación con usuario.
3. **No probé teléfono físico, una mano, sol, guantes ni safe areas reales.**
4. **No probé teclado de punta a punta** (Caja → cobrar → cerrar sheet → Fiado → abono) ni el retorno de foco de cada sheet; solo el foco/Escape de la guía que registra `audit.json`.
5. **No probé el modo real** (`DEMO_MODE=false`) ni con `PEY_API_KEY`. Por eso la semilla de `seed`/`seedGoal` y el comportamiento de `demoMode` en modo real quedan como riesgo, no como hecho observado.
6. **No reproduje una caída de red** para no golpear la demo. El bucle de 3.2 es inferencia del código; el resto de los estados de error son lectura de código, no capturas.
7. **No probé alto contraste, daltonismo, movimiento reducido ni zoom de navegador real.** El 200 % auditado es inyección de `font-size`, no zoom; el control “Muy grande” no llega a 200 %.
8. **No medí contraste manual**; acepto axe 0 como evidencia automatizada, no como certificación.
9. **No probé la verificación con pey real** ni un comprobante real; solo el flujo demo y el contrato de `/api/verify`.
10. **No hay estudio con comerciantes, SUS ni NASA-TLX.** `TEST-USUARIO.md` existe, pero no se ejecutó.
11. **No verifiqué el layout de dos columnas a 1440**; lo deduzco de `@container (min-width: 64rem)` y del ancho de 976 px a 1280. No hay captura 1440.
12. **No verifiqué el estado “sin meta” real** (la semilla crea una meta siempre); el callejón sin salida se deduce del render y de la ausencia de llamada a `POST /api/goals`.

---

**Conclusión en una frase:** el shell actual es claro a 360/1280 con texto normal, pero **miente cuando falla la red, se rompe cuando el texto crece y usa demasiadas palabras distintas para el mismo dinero**; antes de añadir “Pendientes” hay que arreglar esas tres cosas.
