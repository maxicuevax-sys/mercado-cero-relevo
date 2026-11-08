# Trangui

*De «tranqui»: vender y cerrar el día con menos cosas en la cabeza.*

Apoyo para una presentación de tres minutos. El recorrido hablado está en [GUION-3-MIN.md](GUION-3-MIN.md). La duración debe ensayarse; este documento no acredita una prueba con comerciantes ni un pago bancario real.

## 1. Atender el puesto también ocupa la cabeza

Comprar mercancía, vender, dar cambio, recordar un fiado y revisar la caja compiten por atención. Una venta puede terminar y dejar una cuenta pendiente de anotar.

Trangui busca que esas cuentas sean más fáciles de seguir. La intención es reducir trabajo mental. Si usarla obliga a capturar lo mismo dos veces o interrumpe la atención al cliente, tenemos que corregirla.

## 2. Empezar con lo que se vende

Al crear una cuenta de demo, la persona elige el giro de su puesto. Esa elección cambia las sugerencias de Caja y se puede modificar en Ajustes, dentro de **Mi negocio → Cambiar giro**.

**Caja empieza vacía.** Las sugerencias son ejemplos editables; quien atiende decide qué agregar, con qué cantidad y a qué precio. Puede escribir la venta o añadir un concepto a mano.

El recorrido de esta presentación usa un monto directo de **$20**, revisa el concepto y pulsa **Cobrar efectivo exacto**. La pantalla lo identifica como efectivo de demo. Elegir un monto todavía no registra una venta.

## 3. Ver qué se cobró y qué queda pendiente

En Inicio, **Cobrar con CoDi** permite mostrar el recorrido de un cobro digital de demostración: monto, QR, espera y **Simular pago CoDi**. El resultado dice **Pago simulado**.

Fiados conserva los saldos por cobrar. Corte reúne los registros para revisar el cierre y el conteo de efectivo. El objetivo es poder volver a una cuenta pendiente sin tener que recordarla toda de memoria.

Esta demo muestra cómo se registra una operación. No demuestra que haya llegado dinero a un banco.

## 4. La utilidad social todavía hay que comprobarla

Queremos que Trangui deje más atención disponible para el puesto y para la vida fuera del trabajo. Esa es la razón para construirla; todavía no es un resultado medido.

Las pruebas técnicas ayudan a detectar errores de aislamiento, duplicados o estados de cobro. No nos dicen si una persona entiende la pantalla, necesita ayuda o termina con menos trabajo.

Para saberlo, proponemos observar tareas reales con comerciantes: registrar una venta, consultar un fiado y revisar un cierre. Mediríamos el tiempo, las correcciones y la ayuda necesaria, además de preguntar qué les estorba. Si la app añade tareas, ese hallazgo importa más que una demo fluida.

## 5. Qué estamos pidiendo

Buscamos colaboración para probar el flujo con comerciantes y decidir qué merece quedarse. Antes de prometer ahorro de tiempo o dinero, necesitamos comparar el uso de Trangui con la forma en que hoy llevan sus cuentas.

Abrimos el código original bajo [Apache License 2.0](LICENSE) para que otras personas puedan revisarlo y adaptarlo a prácticas locales. Queremos que comerciantes y quienes trabajan en accesibilidad puedan orientar las mejoras y aportar cambios. Es una invitación a construir esa comunidad; todavía no afirmamos que exista una comunidad activa. El alcance de la licencia y los términos de terceros se explican en [LICENSING.md](LICENSING.md).

**Queremos que cerrar el puesto deje menos pendientes en la cabeza. Nos toca demostrar si Trangui ayuda a conseguirlo.**

## Límites para quien presenta

- Decir **modo demo** antes de operar. El negocio y los saldos de ejemplo de la pantalla no son un testimonio ni resultados de un comerciante real.
- Efectivo es un registro de lo que la persona declara haber recibido. En esta demo, las ventas cobradas usan `demo_paid`; no son pagos bancarios reales.
- El cobro digital mostrado es simulado. El proyecto contiene una integración con Pey y validación de webhooks firmados, pero este recorrido no valida un cobro real ni permite prometer disponibilidad de tarjeta o wallets. Un QR o una captura no confirma un pago.
- El fiado es deuda por cobrar. Un apartado en Metas es un registro declarado; no es una cuenta bancaria ni custodia de ahorro.
- No usar cifras de impacto, adopción o ahorro sin fuente y contexto. No presentar pruebas antiguas como evidencia de la versión que se muestra.
- El repositorio conserva nombres históricos de Mercado Cero. La marca presentada es **Trangui**. Su código original tiene [licencia Apache 2.0](LICENSE); los materiales de terceros conservan sus propios términos. Consultar [LICENSING.md](LICENSING.md) antes de presentar todo el contenido del repositorio como si tuviera una sola licencia.

## Si preguntan por las jornadas de trabajo

Consultar los perfiles oficiales de DataMéxico para [vendedores ambulantes](https://www.economia.gob.mx/datamexico/es/profile/occupation/vendedores-ambulantes) y [comerciantes en establecimientos](https://www.economia.gob.mx/datamexico/es/profile/occupation/comerciantes-en-establecimientos). Esas categorías no equivalen a «tianguistas»; sus promedios de jornada tampoco miden carga mental. No atribuirlos a cada persona ni suponer que todas tienen un segundo empleo. El guion central prescinde de esas cifras.
