# Contrato de carga cognitiva y acompañamiento

> Fuente: investigación aplicada del 1 nov 2026 + especificación para OpenCode.
> Este documento manda sobre la piel y sobre las funciones nuevas. Si una
> función no reduce trabajo, no aclara una decisión o no protege un error, no
> entra a la demo.

## Objetivo

Que el comerciante tenga **menos cosas que recordar, menos decisiones
innecesarias y menos errores que corregir**. La app no es otro trabajo ni un
chatbot de inicio.

## Tres resultados

1. **Alivio operativo:** la app recuerda, calcula, ordena y verifica lo que
   puede resolver con reglas confiables.
2. **Acompañamiento respetuoso:** explica situaciones y propone acciones
   pequeñas, sin juzgar ni fingir emociones.
3. **Autonomía creciente:** el comerciante entiende su negocio y puede seguir
   operando sin IA, sin internet o sin el proveedor de pagos.

## Doce principios de diseño

| # | Principio | Decisión concreta | Antipatrón |
|---|---|---|---|
| 1 | Reconocimiento antes que memoria | Mostrar clientes, productos y operaciones recientes | Exigir nombres exactos o códigos |
| 2 | Una tarea principal a la vez | Cobrar se concentra en cobrar | Mezclar metas y análisis en el cobro |
| 3 | Lenguaje del comerciante | “¿Cuánto dinero hay en caja?” | “Ejecutar conciliación de efectivo” |
| 4 | Familiaridad cultural | Libreta, fiado, cambio, corte, apartado | Categorías contables ajenas |
| 5 | Continuidad | Recuperar la venta interrumpida | Borrar el formulario al recibir una llamada |
| 6 | Prevención de errores | Revisar importe, destinatario y tipo de pago | Acciones irreversibles sin confirmar |
| 7 | Recuperación | Corregir con trazabilidad | Borrar en silencio el movimiento anterior |
| 8 | Complejidad progresiva | Empezar por cobrar y gastos | Pedir inventario y costos el primer día |
| 9 | Ayuda en contexto | Explicar “fiado” cuando se usa | Manual de veinte pantallas |
| 10 | Preferencias estables | Recordar texto, contraste y voz | Cambiar la interfaz por inferencias |
| 11 | Funcionar sin IA | Venta manual aunque falle el asistente | Bloquear tareas mientras el modelo responde |
| 12 | Salida e independencia | Exportar y conservar registros comprensibles | Convertir la permanencia en obligación |

## Reglas innegociables

1. No diagnosticar estados emocionales ni inferir tristeza, fracaso o
   incompetencia.
2. No usar culpa, rachas obligatorias, premios vacíos ni mensajes
   motivacionales genéricos.
3. No bloquear una operación por un fallo de IA o de red.
4. No confundir ventas con ganancias ni con saldo disponible.
5. No confirmar un cobro bancario sin evento válido y verificado.
6. No enviar recordatorios de fiado a terceros sin autorización explícita.
7. No recolectar voz, ubicación ni datos sensibles sin necesidad y
   consentimiento.
8. No cambiar automáticamente la interfaz crítica por inferencias.
9. No presentar ahorros virtuales como fondos bancarios custodiados.
10. No introducir dependencias propietarias innecesarias.

## Prioridades

### P0 · Demo 7 nov

- Venta rápida, estados de pago inequívocos, borrador recuperable y lenguaje
  sencillo.
- Pendientes manuales con completar, posponer y eliminar.
- Resumen de cierre basado solo en movimientos registrados.
- Antes de cerrar: pendientes de hoy y cobros por confirmar, con acción o
  “ahora no”; nunca un diagnóstico.
- Ayuda contextual breve; estados accesibles.
- Venta manual aunque la IA no responda.

### P1 · Primer mes

- Recordatorios configurables, proveedores, lista de compras, enseñanza
  gradual.
- Comparaciones con contexto y calidad de datos; no confundir “sin datos” con
  “ventas cero”.

### P2 · 90 días

- Asistente conversacional opcional y explicable.
- Estudios de carga cognitiva con comerciantes reales.

## Momentos y silencio

| Momento | Mostrar | Evitar |
|---|---|---|
| Apertura | Cambio inicial y un pendiente importante | Resúmenes largos y consejos |
| Venta en curso | Importe, forma de pago y estado | Notificaciones, preguntas y animaciones |
| Entre ventas | Pendientes solo si se solicitan | Interrupciones automáticas |
| Cerca del cierre | Corte y pendientes del día siguiente | Juicios de desempeño |
| Sin conexión | Funciones locales y estado de sync | Promesas de pago bancario |

## Aceptación mínima

- [ ] Una venta interrumpida se recupera con productos, importe y forma de pago.
- [ ] Un cobro pendiente nunca se muestra como pagado.
- [ ] Un doble envío no crea dos cobros.
- [ ] Un corte con diferencia no culpa ni bloquea; explica y permite corregir.
- [ ] La venta manual funciona con `/api/interpret` caído.
- [ ] Completar, posponer y eliminar un pendiente funciona y se anuncia.
- [ ] “Antes de cerrar” muestra solo pendientes de hoy y cobros por confirmar;
      se puede posponer o descartar sin perder datos.
- [ ] Desactivar sugerencias no oculta avisos críticos de dinero.
- [ ] Texto ampliado, teclado y lector de pantalla siguen funcionando.
- [ ] Ningún texto diagnostica emociones ni califica a la persona.
