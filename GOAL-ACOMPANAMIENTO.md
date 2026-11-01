# GOAL-ACOMPAÑAMIENTO — Carga cognitiva y acompañamiento responsable

> **Estado:** contrato nuevo, 1 de noviembre de 2026.
> Complementa **`GOAL.md`** (dinero y webhook), **`GOAL-HIG.md`** (interfaz) y **`GOAL-SKILLS.md`** (método). No reescribe la app: audita y mejora de forma incremental.
> **Hipótesis de diseño, no promesa de impacto:** la evidencia psicológica orienta decisiones; los beneficios para comerciantes mexicanos deben medirse en campo. No se afirmará que la app reduce estrés, carga o errores en un porcentaje sin estudio local.

---

## 0 · Punto de partida real (1 de noviembre de 2026)

La app ya tiene caja, fiado, corte, meta y verificación de comprobantes. Los pagos demo usan `demo_paid`; solo el webhook firmado de pey lleva una orden a `paid`. La interfaz pasó HIG/WCAG 2.2 AA automatizado, targets de 48 px, 200% de texto y flujo móvil de 360 px.

**Lo que todavía no existe o no está validado:**

- Inventario, proveedores, lista de compras y recordatorios configurables.
- Ventas no bancarias sin conexión.
- Prueba en teléfono físico, TalkBack/VoiceOver y estudio con 6–8 comerciantes.
- Pago real de $0.01: BBVA/CoDi sigue bloqueado.

Este goal no puede fingir que esos módulos existen. Su primera fase es diagnóstico; su primera entrega es una mejora verificable de los flujos actuales.

---

## 1 · La misión en una frase

**Quitar trabajo mental al comerciante y devolverle control:** que Mercado Cero recuerde, calcule, ordene y verifique lo que puede resolver con reglas confiables; que acompañe sin juzgar; y que las operaciones críticas sigan funcionando aunque la IA, el modelo o el proveedor de pagos fallen.

La frase que debe poder decir una comerciante al terminar:

> “Cerré mi día con menos pendientes en la cabeza y sé qué pasó con mi dinero.”

### La decisión que sirve

Cada función nueva debe responder cuatro preguntas:

1. **¿Qué obligación mental le estamos quitando?**
2. **¿Qué decisión le estamos ayudando a comprender?**
3. **¿Qué error estamos evitando o haciendo más fácil de reparar?**
4. **¿Podrá seguir realizando esta tarea sin nosotros?**

Si una función no ofrece una respuesta convincente, **no pertenece al producto todavía**.

### Tres resultados, no tres módulos

| Resultado | Qué significa | Qué no significa |
|---|---|---|
| **Alivio operativo** | La app recuerda, calcula, ordena y verifica lo confiable | Convertir cada pendiente en una notificación |
| **Acompañamiento respetuoso** | Explica situaciones y propone acciones pequeñas, sin juzgar | Diagnosticar emociones o dar discursos motivacionales |
| **Autonomía creciente** | La persona entiende mejor su negocio y puede trabajar sin la IA | Retener datos o crear dependencia para aumentar uso |

**Métrica de la decisión:** no es tiempo en la app ni número de funciones. Es **menos pasos, menos errores, menos carga percibida y más capacidad de explicar y recuperar lo que pasó**.

---

## 2 · Qué cambia y qué se queda

| Se añade | Se conserva | No se añade ahora |
|---|---|---|
| Una sección **Pendientes** con tareas manuales: completar, posponer, eliminar | La identidad “Mostrador claro”, la voz y el verde Mercado Cero | Un chatbot como pantalla de inicio |
| Borradores recuperables para ventas interrumpidas | Los invariantes de dinero de `GOAL.md` | Detección de emociones por voz, horario o ventas |
| Resumen de cierre basado solo en movimientos registrados | La distinción demo / efectivo / fiado / pey | Rachas, recompensas o gamificación |
| Ayuda contextual breve y opcional | Targets de 48 px, 200%, contraste, foco y teclado | Compras automáticas o pedidos a proveedores sin aprobación |
| Separación explícita: verificado / manual / sugerencia | La operación principal sin IA | Créditos, publicidad o productos de terceros como primera respuesta |
| Preferencias de acompañamiento y frecuencia | La posibilidad de exportar y entender los registros | Recordatorios de fiado a terceros sin autorización |
| Motor de recomendaciones deterministas y explicables | La demo grabada y el runbook | Inventario inferido solo porque un producto se vendió mucho |

---

## 3 · Leyes no negociables

1. **Sin firma no hay pago.** Solo el webhook firmado de pey transiciona `payment_pending → paid`. Los pagos demo usan `demo_paid`; nunca se muestran como “Pago verificado”.
2. **La IA no tiene autoridad financiera.** No confirma pagos, no altera registros, no solicita crédito, no compra y no envía mensajes sensibles sin aprobación humana.
3. **No se diagnostican emociones.** La app puede describir datos y ofrecer acciones; no puede concluir tristeza, fracaso, depresión ni intención.
4. **No hay culpa ni gamificación coercitiva.** Nada de “fallaste”, rachas obligatorias, comparaciones humillantes ni mensajes motivacionales vacíos.
5. **La IA no bloquea lo esencial.** Venta, efectivo, fiado, corte y consulta de registros siguen funcionando si el asistente o la red fallan.
6. **No se confunde venta con ganancia ni con saldo disponible.** Si faltan costos, se dice que faltan; no se inventa utilidad.
7. **No se recuerda fiado a terceros sin consentimiento explícito.** La libreta es del negocio, no una herramienta de presión.
8. **No se recolectan voz, ubicación, contactos ni horarios personales sin necesidad y consentimiento.** La personalización usa preferencias explícitas y datos operativos mínimos.
9. **No se cambia automáticamente la interfaz crítica por inferencias.** La persona controla el tamaño, la voz, la frecuencia y el nivel de ayuda.
10. **Un apartado virtual no es dinero custodiado.** Nunca se presenta como depósito bancario, inversión o saldo disponible.
11. **Continuidad + idempotencia.** Una venta interrumpida se recupera; un cobro no se reintenta ni se duplica sin que la persona lo sepa.
12. **Salida e independencia.** Los registros se pueden exportar y entender sin depender del asistente.

---

## 4 · Arquitectura de tres capas

### Capa 1 · Motor confiable del negocio

Registros, cálculos, saldos, conciliaciones, permisos y estados de pago con reglas verificables. **No depende de un modelo de lenguaje.** Es la fuente de verdad.

### Capa 2 · Acompañamiento contextual

Selecciona si hay una acción útil que mostrar según datos autorizados, urgencia, contexto, preferencias y disponibilidad. **Puede elegir no mostrar nada.** Sus recomendaciones son deterministas y explicables.

### Capa 3 · Asistente conversacional opcional

Permite preguntar en lenguaje cotidiano, explicar conceptos o preparar una lista. **No tiene autoridad** para confirmar pagos, alterar registros, solicitar créditos ni enviar mensajes sensibles sin aprobación.

### Contrato de una recomendación

Toda recomendación debe tener:

```text
id, categoría, evento/condición que la origina,
datos y periodo utilizados, urgencia,
explicación breve y verificable,
acción sugerida (opcional),
posponer / descartar / frecuencia,
estado de consentimiento cuando corresponda.
```

Reglas: explicable, descartable, configurable y sin autorización financiera por sí misma. Si no puede explicar **por qué** aparece, no se muestra.

---

## 5 · Política de momentos (JITAI)

| Momento | Qué muestra | Qué evita |
|---|---|---|
| Apertura | Cambio inicial y **un** pendiente importante | Resúmenes largos y consejos |
| Venta en curso | Importe, forma de pago y estado | Notificaciones, preguntas y animaciones |
| Entre ventas | Pendientes solo si la persona los pide | Interrupciones automáticas |
| Cerca del cierre | Corte y pendientes del día siguiente | Juicios sobre el desempeño |
| Revisión semanal | Tendencias con contexto y acciones posibles | Comparaciones engañosas entre días distintos |
| Sin conexión | Funciones locales y estado de sincronización | Promesas de pagos bancarios confirmados |

Los **avisos críticos de seguridad financiera** se distinguen de las sugerencias ordinarias. Los horarios se configuran por negocio: una fonda, una papelería y un puesto nocturno no comparten jornada.

---

## 6 · Lenguaje y acompañamiento

### Autonomía

- Sí: “Puedes revisar el faltante ahora o dejarlo para el cierre.”
- No: “Debes corregir esto inmediatamente”, salvo bloqueo indispensable de seguridad.

### Competencia

- Sí: “Registraste todos los movimientos de caja. Ya puedes comparar el efectivo contado.”
- No: “¡Eres un emprendedor increíble!”, porque no explica ningún avance concreto.

### Relaciones y colaboración

Permitir que un familiar autorizado ayude a registrar compras **sin acceso** a todas las deudas, ahorros o datos personales. Permisos proporcionados, auditoría y privacidad.

### Sin falsa seguridad

- “Llevas $8,400 en ventas registradas. Hay $650 pendientes de cobro y tres gastos sin clasificar. **No puedo calcular todavía tu ganancia porque faltan costos.** ¿Quieres revisar esos gastos?”
- “Puedo ayudarte a revisar el dinero disponible, los pagos próximos y el costo del pedido. **Por ahora no tengo información suficiente** para decir si esa compra es conveniente.”

### Sin diagnóstico ni culpa

Un día de ventas bajas no es un fracaso personal. Las ventas dependen del clima, la ubicación, los proveedores, la temporada y la competencia. La pantalla puede decir:

> “Dejemos los pendientes claros. Hay dos pagos por revisar y un gasto sin clasificar. Puedes resolverlos ahora o dejarlos señalados para mañana.”

Nunca: “Vendiste poco” como juicio, ni créditos/publicidad como primera respuesta a una dificultad económica.

### Ajustes explícitos

Una pantalla breve: **“¿Cómo quieres que te ayude?”** con recordatorios, explicaciones, voz y sugerencias. Todo se puede desactivar. No se infieren emociones desde la voz ni se vigilan horarios personales.

---

## 7 · Continuidad, reconocimiento y aprendizaje gradual

### Doce principios de diseño

| Principio | Decisión | Evitar |
|---|---|---|
| Reconocimiento antes que memoria | Mostrar clientes, productos y operaciones recientes | Obligar a recordar nombres o códigos |
| Una tarea principal a la vez | La pantalla de cobro se concentra en cobrar | Mezclar ventas, metas y análisis |
| Lenguaje del comerciante | “¿Cuánto dinero hay en caja?” | “Ejecutar conciliación de efectivo” |
| Familiaridad cultural | Libreta de fiados, cambio, corte y apartado | Categorías contables incomprensibles |
| Continuidad | Recuperar una operación interrumpida | Borrar formularios al recibir una llamada |
| Prevención de errores | Revisar importe, destinatario y tipo de pago | Acciones irreversibles sin verificar |
| Recuperación | Corregir con trazabilidad | Borrar silenciosamente el movimiento |
| Complejidad progresiva | Empezar por cobrar y registrar gastos | Pedir inventario y costos el primer día |
| Ayuda en contexto | Explicar “fiado” cuando se usa | Manuales de veinte pantallas |
| Preferencias estables | Recordar texto y forma habitual de cobro | Cambiar toda la interfaz sin avisar |
| Funcionamiento sin IA | Operaciones básicas aunque falle el asistente | Bloquear tareas mientras el modelo responde |
| Salida e independencia | Exportar y conservar registros comprensibles | Convertir la permanencia en obligación |

### Experiencia comercial ≠ experiencia digital

Una persona puede ser experta vendiendo y no saber usar una app; otra puede manejar el teléfono y desconocer qué es utilidad neta. Mercado Cero respeta la primera y compensa las barreras de la segunda. **No se asocia edad con poca habilidad.**

### Interrupciones reales

Si alguien empieza una venta de $180, recibe una llamada y vuelve tres minutos después, se conservan:

- Productos y cantidades.
- Importe y forma de pago elegida.
- Qué información sigue pendiente.
- Si existe un cobro bancario emitido y su estado verificable.

Pero **no se reintenta automáticamente un cobro** ni se genera una segunda solicitud sin que la persona lo sepa. Continuidad psicológica e idempotencia financiera se diseñan juntas.

### Scaffolding

| Etapa | Comportamiento |
|---|---|
| Primeras veces | Explicar + ejemplo guiado |
| Con experiencia | Sugerir + ayuda contextual |
| Con dominio | No interrumpir; ayuda disponible |

La transición la controla la persona. Las opciones esenciales nunca desaparecen.

---

## 8 · Accesibilidad cognitiva e inclusión

Principios W3C COGA que aplican directamente:

- Reducir interrupciones.
- No depender de la memoria.
- Usar lenguaje familiar.
- Permitir recuperar una tarea interrumpida.
- Mantener la ubicación de funciones críticas.
- Explicar términos y errores sin culpar.

Ya existe en Mercado Cero: 48 px, 200% de texto, contraste, foco visible, teclado, voz + texto, movimiento reducido y estados que no dependen solo del color. Este goal añade: borradores que no se borran por tiempo, pendientes claros, explicaciones breves y ayuda que se puede apagar.

**Límite honesto:** la accesibilidad automatizada no sustituye la prueba con personas, TalkBack/VoiceOver y teléfono físico.

---

## 9 · Cómo se comprueba

### Investigación contextual

Observar, con consentimiento, negocios distintos: abarrotes, fonda, tianguis y comercio con ayuda familiar. Documentar qué recuerdan, qué anotan, cuándo se interrumpen y qué errores son difíciles de reparar.

Métodos:

1. Descubrimiento: mirar antes de diseñar.
2. Tareas sin capacitación previa: venta, abono, gasto, QR, faltante, pedido.
3. Comparación con el método habitual: libreta, calculadora o WhatsApp; alternar el orden.
4. Seguimiento en jornadas reales: qué se usa, qué se abandona, qué recordatorio sirve.

**4–8 participantes por ronda** sirven para descubrir problemas importantes; no son evidencia representativa. Reclutar personas con y sin experiencia digital, mayores, con discapacidad y distintos niveles de escolaridad; remunerar cuando corresponda y no pedir datos reales innecesarios.

### Métricas

| Medida | Cómo | Qué demuestra |
|---|---|---|
| Tasa de tareas completadas | Observación directa | Si pueden terminar sin ayuda |
| Errores financieros críticos | Casos controlados | Si el diseño protege el dinero |
| Tiempo por operación | Tareas comparables | Si ahorra esfuerzo |
| Pasos y campos | Auditoría de flujos | Cuánto trabajo exige la app |
| Interrupciones toleradas | Simulación realista | Si permite retomar sin errores |
| NASA-TLX | Cuestionario tras la tarea | Carga percibida |
| Ayuda solicitada | Conteo en pruebas | Dependencia del facilitador |
| Recordatorios ignorados | Medición consentida y agregada | Posible fatiga |
| Autonomía sin IA | Prueba con asistente desconectado | Independencia funcional |
| Comprensión de recomendaciones | Pedir explicación | Si entiende antes de decidir |

**Objetivos internos iniciales, sujetos a validación:** cero confirmaciones bancarias falsas en escenarios de prueba; todos los flujos críticos completables sin el asistente; menos tiempo, errores o carga percibida que el procedimiento previo en tareas equivalentes.

No se declarará “redujimos el estrés X%” sin un estudio que lo demuestre.

---

## 10 · Fases y prioridades

| Fase | Trabajo | Entregable comprobable |
|---|---|---|
| **F0 · Diagnóstico** (antes de tocar código) | Auditar estructura, rutas, flujos de venta, caja, fiado, corte, meta y verificación; medir pasos, campos, decisiones, interrupciones y errores; detectar memoria exigida | `AUDITORIA-COGNITIVA.md` con hallazgos priorizados |
| **P0 · Hackathon** (hasta el 7 nov) | Venta rápida, estados inequívocos, borradores recuperables, lenguaje sencillo, **Pendientes** manual, resumen de cierre, separar verificado/manual/sugerencia, funcionar sin IA | Demo funcional + pruebas de los flujos críticos |
| **P1 · Primer mes** | Recordatorios configurables, proveedores, lista de compras, enseñanza gradual, comparaciones contextuales, calidad de datos | Pruebas con comerciantes y métricas |
| **P2 · 90 días** | Asistente opcional, recomendaciones, preferencias, experimentos controlados, estudios de carga | Evidencia de utilidad y daños |

### La tentación que no se va a seguir

Construir de inmediato el agente inteligente, diez tipos de notificaciones, recomendaciones de inventario y un panel financiero impresionante. **Primero** se demuestra que alguien puede abrir, vender, cobrar, anotar y cerrar con claridad. Si eso funciona, el acompañamiento tiene base.

### Fuera de alcance de este goal

- Chatbot como pantalla de inicio.
- Detección de emociones.
- Rachas, recompensas o presión constante.
- Compra automática de inventario.
- Ofertas de crédito o publicidad como respuesta a dificultades.
- Recordatorios de fiado a terceros sin autorización.
- Inventario inferido solo por ventas.
- Presentar apartados virtuales como dinero custodiado.
- Reescribir la arquitectura o la identidad visual ya construida.

---

## 11 · Criterios de aceptación

### Must-pass

- [ ] Una persona puede abrir, vender, cobrar, anotar y cerrar **sin el asistente de IA**.
- [ ] “Pendiente” y “verificado” son inequívocos; demo nunca se muestra como verificado; no hay doble cobro.
- [ ] Una venta interrumpida se recupera con productos, importe, forma de pago y estado del cobro.
- [ ] **Pendientes** permite completar, posponer y eliminar; no interrumpe durante la venta.
- [ ] El resumen de cierre usa solo movimientos registrados y marca lo que falta.
- [ ] Las recomendaciones explican su origen, se pueden descartar y configurar; no diagnostican emociones.
- [ ] La operación principal sigue si falla la IA o la red; los límites se muestran.
- [ ] Los registros se pueden exportar y entender.
- [ ] No hay regresiones: webhook 27/27, HIG/WCAG, móvil/checkout, build limpio.

### Should-pass

- [ ] Menos pasos/campos que la línea base en tareas equivalentes.
- [ ] NASA-TLX igual o menor que el método habitual.
- [ ] La persona puede explicar una recomendación antes de aceptarla.
- [ ] No aumenta la fatiga de notificaciones ni la dependencia del facilitador.

### No-goals

- Aumentar el tiempo en la app.
- Añadir módulos para “parecer completo”.
- Medir éxito por cantidad de funciones o notificaciones.
- Prometer reducción de estrés sin estudio.

---

## 12 · Riesgos y protecciones

| Riesgo | Cómo se produciría | Protección |
|---|---|---|
| Dependencia funcional | Solo se entienden las cuentas mediante el bot | Datos, cálculos y exportación comprensibles sin IA |
| Fatiga de notificaciones | Todo pendiente se vuelve alerta | Agrupación, horarios y límites configurables |
| Culpabilización | Días de poca venta se califican como fracaso | Retroalimentación objetiva y sin juicios |
| Falsa seguridad | El asistente aparenta conocer ganancia o saldo | Datos faltantes y nivel de verificación explícitos |
| Automatización excesiva | Se aceptan recomendaciones sin comprenderlas | Explicación breve, vista previa y aprobación |
| Vigilancia familiar | Se supervisa toda la actividad del trabajador | Permisos proporcionados, auditoría y privacidad |
| Sesgo cultural | Todo se expresa en lenguaje contable o urbano | Investigación con giros, regiones y lenguas |
| Sobrepromesa | Se sugiere que la app elimina estrés o agotamiento | Medir beneficios reales y reconocer límites |
| Jornada excesiva | “Acompañar” se convierte en enseñar a soportar más | Reducir trabajo evitable; no normalizar jornadas de 55+ h |

La OMS y la OIT documentan riesgos de salud asociados a jornadas de 55 horas o más. Una app puede reducir tareas administrativas, pero **no sustituye descansos, condiciones laborales dignas, seguridad ni apoyo humano**.

---

## 13 · Fuentes que guían las decisiones

- W3C — *Making Content Usable for People with Cognitive and Learning Disabilities* (COGA).
- Gilbert et al. — *Outsourcing Memory to External Tools* (cognitive offloading).
- Michie et al. — *Behaviour Change Wheel / COM-B*.
- Dorian Peters — *Wellbeing Supportive Design* (autodeterminación, 15 heurísticas).
- Gollwitzer y Sheeran — *Psychology of Planning* (planes “si-entonces”).
- Nahum-Shani et al. — *Just-in-Time Adaptive Interventions*.
- Nielsen Norman Group — *10 Usability Heuristics*.
- GOV.UK — *Contextual Research and Observation*.
- Microsoft — *Guidelines for Human-AI Interaction*.
- Google PAIR — *People + AI Guidebook*.
- INEGI — Censos Económicos 2024 y ENIF 2024, como contexto, no como prueba de carga cognitiva.
- FCA — evidencia sobre gamificación y conductas de riesgo, como cautela, no como conclusión directa.

---

## 14 · Primera acción

**No ampliar código todavía.** Antes de implementar P0:

1. Leer la estructura, rutas y componentes actuales.
2. Ejecutar la app y recorrer venta, caja, fiado, corte, meta y verificación.
3. Medir pasos, campos, decisiones, interrupciones y mensajes de error.
4. Detectar dónde la interfaz exige recordar algo que ya está en otra sección.
5. Escribir `AUDITORIA-COGNITIVA.md` con hallazgos priorizados y una propuesta P0.
6. Presentar los hallazgos antes de hacer cambios amplios.

**Criterio de éxito del goal:** reducir trabajo y errores **sin reducir el control del comerciante**. Si una función añade trabajo, aunque se vea útil, no entra.
