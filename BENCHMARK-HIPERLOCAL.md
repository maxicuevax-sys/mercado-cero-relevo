# Benchmark hiperlocal — qué sirve y qué no para Mercado Cero

> Consulta: **31 de octubre de 2026**. Datos de GitHub (metadata, README, licencia, último push), no de blogs.
> Regla: **las estrellas no son calidad y el código no es estrategia**. Primero encaje con el producto, luego licencia, luego stack, y solo al final “¿vale la pena copiar una idea?”.
> Conclusión corta: **ninguno se integra antes del 7 de noviembre**. Tres ideas sí alimentan el pitch y el roadmap; el resto es ruido o riesgo legal.

---

## 1 · La respuesta en una tabla

| Proyecto | Qué es | Stack | Licencia | Último push | Encaje con Mercado Cero | Qué tomar |
|---|---|---|---|---|---|---|
| **CoopCycle Web** | Marketplace + logística para cooperativas de reparto en bici | PHP / Symfony, PostgreSQL, API, React | **Peer Production License** (uso comercial restringido a cooperativas) | 29 oct 2026 | **Bajo para código; alto para narrativa** | Modelo “los comerciantes son dueños”, cero comisión, gobernanza cooperativa |
| **CoopCycle App** | App nativa de CoopCycle | Swift / iOS | MIT | 27 oct 2026 | Bajo | Nada urgente; referencia de app de reparto |
| **Nearby Shops** | App Android multi-vendor de comida y compras locales | Java/Kotlin, Android, Mapbox; API solo como imagen Docker | **GPL-3.0** | sep 2022 | Bajo | Radio de cercanía, pickup/delivery, reseñas; **no copiar** |
| **Local Vendor App** | Marketplace hiperlocal para vendedores ambulantes | React/Vite, Flask, PostgreSQL, Leaflet, OSRM, M-Pesa | MIT | ago 2026 | **Medio como concepto; bajo como código** | “Freshness timer” / check-in de 3 h, radio Haversine, “abierto ahora” |
| **Fleetbase Storefront** | App de cliente para tienda única o red multi-vendor | React Native + web, requiere backend Fleetbase | **AGPL-3.0** | 31 oct 2026 | Bajo/medio como referencia | Separación tienda única vs. red; IA de catálogo, checkout y seguimiento |
| **NextOrders Food** | Storefront de comida self-hosted, sin comisiones | Nuxt, frontend-only, `food-schema`, backend propio | MIT | 30 oct 2026 | **Medio como referencia de storefront** | Performance/SEO, menú público, “tu marca, tus clientes, cero intermediarios” |
| **Enatega Multi-Vendor** | Ecosistema customer/vendor/rider/admin | React Native + Next.js, GraphQL; **backend/API propietario** | MIT solo frontend | 7 oct 2026 | Bajo | Separación de roles y admin multi-vendor; **no es open source completo** |
| **streetvendor-platform** | Supply chain B2B para vendedores de comida india | TypeScript | s/d | 2026 | Muy bajo | Nada para el hackathon |
| **recycle-resell** | Marketplace de segunda mano | Next.js/Prisma | s/d | 2026 | Nulo | Nada |
| **HomeMarket / trade-tide** | No encontré un repo canónico con ese nombre | — | — | — | No evaluado | No inventar una comparación |

**Lectura:** Mercado Cero no es un marketplace de descubrimiento ni una app de delivery. Es una **caja que convierte una venta hablada en un cobro y solo dice “pagado” con webhook firmado**. Los proyectos anteriores resuelven otra capa: catálogo, pedidos, reparto, multi-vendor. Sirven para **mirar el ecosistema**, no para reemplazar el núcleo.

---

## 2 · Qué es Mercado Cero (para no comparar peras con manzanas)

| Capacidad | Mercado Cero | Marketplace / delivery |
|---|---|---|
| Venta en mostrador | **Sí** | No, o secundaria |
| Voz en español | **Sí** | No |
| CoDi / pey + webhook firmado | **Sí** | No; tarjeta/wallet/COD |
| Efectivo y fiado | **Sí, ciudadanos de primera** | Casi nunca |
| Corte de caja y meta | **Sí** | No |
| Catálogo público | No | **Sí** |
| Multi-vendor | No; un negocio | **Sí** |
| Reparto y riders | No | **Sí** |
| Mapa / radio / cercanía | No | **Sí** |
| Comisión por pedido | No | Variable |
| Administración de negocio | **Sí, ligera** | Pesada |

**Implicación:** integrar CoopCycle, Nearby Shops o Enatega convertiría a Mercado Cero en un producto distinto, con otra operación, otro equipo y otro riesgo. Para un hackathon de 7 días sería un suicidio de foco.

---

## 3 · Los proyectos, uno por uno

### 3.1 CoopCycle — la referencia política, no el código

- **Qué es:** plataforma self-hosted para pedir comida en el barrio y repartirla en bici; la única diferencia con Uber Eats/Deliveroo es que el software está reservado a cooperativas y los repartidores son dueños.
- **Datos:** 606 estrellas, PHP/Symfony, PostgreSQL, API + frontend + algoritmo de dispatch; 464 issues abiertos; activo.
- **Licencia:** **Peer Production License**. El uso comercial de los derechos solo se concede a entidades de economía social/cooperativas con trabajadores asalariados. No es AGPL ni MIT. **No copies código** sin revisión legal; un hackathon con ánimo de lucro no califica.
- **Qué tomar:** la narrativa de **propiedad de los comerciantes**, cero comisión de un gigante y gobernanza local. Es útil para el pitch y para el modelo de negocio, no para la app.
- **Qué no tomar:** Symfony, dispatch, riders, reparto, catálogo multi-vendor. Es otro producto y otra licencia.

**Frase usable:** “No queremos construir otro marketplace que cobre comisión. Queremos que la comerciante sea dueña de su cobro.” (No afirmar que Mercado Cero es una cooperativa; es una inspiración de modelo.)

### 3.2 Nearby Shops — el escaparate de barrio, congelado en 2022

- **Qué es:** app Android multi-vendor de comida, abarrotes y compras locales; clientes ven tiendas cercanas, pickup/delivery, reseñas y mapas.
- **Datos:** 182 estrellas, Java/Kotlin, GPL-3.0, último push **sep 2022**. El backend se distribuye como imagen Docker `nearbyshops/nearbyshops`; el código del API no está en el repo.
- **Qué tomar:** la idea de **radio de cercanía**, “tiendas cerca de mí” y alternar pickup/delivery. Nada de eso es necesario para una caja de mostrador.
- **Qué no tomar:** el código Android, el API sin fuente, el stack, la licencia GPL. Está viejo y no es una base mantenible.

**Veredicto:** referencia histórica de “hiperlocal”, no una dependencia.

### 3.3 Local Vendor App — la idea más cercana al tianguis

- **Qué es:** marketplace hiperlocal para vendedores ambulantes. El cliente busca en un radio de 5 km con Haversine; el vendedor hace “check-in” con GPS y menú; si no se actualiza en **3 horas**, desaparece de los resultados. Incluye OSRM y M-Pesa.
- **Datos:** 0 estrellas, MIT, React/Vite + Tailwind + Leaflet, Flask + PostgreSQL, último push ago 2026. Proyecto pequeño, con señales de generación asistida (`.claude`, `CLAUDE.md`); no está probado a escala.
- **Qué tomar:** el **freshness timer** y el check-in. Es una idea excelente para un tianguis: “si el puesto no está abierto, no lo muestres”. También el radio Haversine, que son 20 líneas de código.
- **Qué no tomar:** M-Pesa, OSRM, Flask, PostgreSQL, el marketplace completo. No necesitas reparto para vender en el puesto.

**Uso realista:** una fase futura, no el hackathon. Un “puesto abierto” con timestamp podría ser un diferenciador de directorio de tianguis; hoy no hay directorio ni cliente navegando.

### 3.4 Fleetbase Storefront — el cliente de una red logística

- **Qué es:** app de cliente para una tienda o una red multi-vendor sobre Fleetbase: catálogo, checkout, servicios, delivery, chat, seguimiento.
- **Datos:** 193 estrellas, React Native + web, **AGPL-3.0**, activo. Requiere el backend/console de Fleetbase; no es una app autónoma.
- **Qué tomar:** el concepto **store key vs. network key** (una tienda o una red) y la IA de storefront. Es una buena referencia si Mercado Cero algún día tiene “vitrina de pickup” para varios puestos.
- **Qué no tomar:** el código AGPL en un producto cerrado, React Native, el backend Fleetbase. Demasiado peso para un prototipo.

### 3.5 NextOrders Food — el storefront rápido y sin comisiones

- **Qué es:** web self-hosted de comida con “tu marca, tus clientes, cero comisión”; frontend Nuxt separado del backend, contrato `food-schema`; multi-ciudad, multi-idioma, pickup/delivery, PageSpeed 100.
- **Datos:** 93 estrellas, MIT, activo. **Solo frontend**; el backend lo pones tú.
- **Qué tomar:** la disciplina de **performance/SEO** y la estructura de un menú público: categorías, productos, carrito persistente, pickup vs. delivery. También el mensaje “cero intermediarios”, que coincide con la tesis de Mercado Cero.
- **Qué no tomar:** Nuxt, el schema de comida, el carrito, el catálogo. Mercado Cero ya tiene un checkout público (`/pay/[id]`) y no necesita un menú navegable para el hackathon.

**Uso realista:** benchmark de la vitrina pública si se decide abrir “pedidos para llevar” después del hackathon.

### 3.6 Enatega Multi-Vendor — el ecosistema completo, con trampa

- **Qué es:** sistema de pedidos y logística con apps de cliente, vendedor, repartidor y admin; food, grocery, servicios, courier.
- **Datos:** 1,412 estrellas, MIT en el frontend, pero **el backend y el API son propietarios y se licencian aparte**. Next.js + React Native + GraphQL.
- **Qué tomar:** la separación de roles y la IA de admin multi-vendor, si algún día Mercado Cero se convierte en red. Nada para la caja.
- **Qué no tomar:** el código, el GraphQL propietario, la complejidad de cuatro apps. No es “open source completo”, aunque las estrellas lo sugieran.

### 3.7 Los nombres sueltos

- **streetvendor-platform:** encontré `Sumanth1410-git/streetvendor-platform` (1 estrella, TypeScript, supply chain B2B para vendedores de comida india). No es un marketplace de barrio ni una caja; no aporta.
- **recycle-resell:** marketplace de segunda mano, 2 estrellas; no tiene relación con cobro, fiado ni CoDi.
- **HomeMarket / trade-tide:** no encontré un repositorio canónico con esos nombres. No los evalúo para no inventar datos. Si tienes el link exacto, se revisa.

---

## 4 · Matriz de encaje: qué nos puede ayudar de verdad

| Necesidad de Mercado Cero | CoopCycle | Nearby Shops | Local Vendor | Fleetbase | NextOrders | Enatega | ¿Copiar? |
|---|---|---|---|---|---|---|---|
| Cobro en mostrador | No | No | No | No | No | No | **Nada** |
| Voz / IA en español | No | No | No | No | No | No | **Nada** |
| CoDi / pey / webhook | No | No | No | No | No | No | **Nada** |
| Efectivo / fiado / corte | No | No | No | No | No | No | **Nada** |
| Checkout público | No | Parcial | No | **Sí** | **Sí** | **Sí** | Solo referencia de IA/performance |
| Catálogo / vitrina | No | **Sí** | **Sí** | **Sí** | **Sí** | **Sí** | Fase 2, no ahora |
| Descubrimiento por radio | No | **Sí** | **Sí** | **Sí** | No | **Sí** | Concepto futuro |
| “Abierto ahora” / freshness | No | No | **Sí** | No | No | No | **Idea fuerte** |
| Multi-vendor / admin | **Sí** | **Sí** | Parcial | **Sí** | No | **Sí** | No para el hackathon |
| Reparto / riders | **Sí** | Parcial | **Sí** | **Sí** | No | **Sí** | No; otra operación |
| Modelo cooperativo / cero comisión | **Sí** | No | No | No | **Sí** | No | **Narrativa** |
| Performance / SEO | No | No | No | No | **Sí** | Parcial | **Benchmark** |

**Lo que ningún proyecto tiene:** voz, CoDi/pey, efectivo, fiado, corte, meta y la regla “sin webhook no hay pagado”. Ese es el foso de Mercado Cero.

---

## 5 · Lo que sí usaría para el 7 de noviembre

### 5.1 Una diapositiva de contexto, no una integración

> “Los marketplaces hiperlocales demuestran que hay demanda por comprar cerca y sin gigantes. Pero ninguno resuelve lo que pasa en el mostrador: la comerciante necesita saber si el dinero ya llegó. Mercado Cero no compite con CoopCycle ni con un marketplace; es la capa de certeza que ellos no tienen.”

Esto usa a CoopCycle/NextOrders como **validación de categoría**, no como competencia directa. No afirmes que son enemigos ni que Mercado Cero es una cooperativa.

### 5.2 Un benchmark de performance, no una dependencia

NextOrders presume PageSpeed 100. Mercado Cero ya tiene Lighthouse 100 en accesibilidad, best practices y SEO. Usa ese estándar para el checkout público y no cambies a Nuxt por copiar. La lección es **presupuesto de performance**, no el framework.

### 5.3 Una idea de roadmap, no una feature

La **freshness timer** de Local Vendor App es la mejor idea de todo el lote para un tianguis:

- “Puesto abierto” con check-in y timestamp.
- Si no se actualiza en X horas, se oculta del directorio.
- No requiere reparto, ni mapas, ni riders.
- Se puede construir en Next.js con una tabla `vendor_presence` y un TTL; no necesitas su Flask.

Pero **no lo construyas para el hackathon**. No hay directorio de clientes todavía; sería una función sin usuario. Guárdalo para la fase 2/3.

---

## 6 · Lo que NO haría

1. **No forkar CoopCycle.** PHP/Symfony, licencia restrictiva, 464 issues y un modelo de reparto que no es el producto.
2. **No integrar Nearby Shops.** Android, GPL, API sin código, último push 2022.
3. **No copiar Fleetbase.** AGPL, React Native, backend ajeno; te obliga a abrir tu red.
4. **No usar Enatega como “open source”.** El backend/API es propietario; el MIT es solo del frontend.
5. **No convertir Mercado Cero en marketplace.** El hackathon se gana con una caja que cobra y confirma, no con un catálogo de 20 puestos.
6. **No agregar delivery.** Riders, rutas, reembolsos y soporte son otra empresa. El valor es la certeza del cobro, no la logística.
7. **No copiar Haversine/OSRM/M-Pesa.** Haversine son 20 líneas; OSRM y M-Pesa no aplican a México/CoDi.
8. **No mezclar HIG con estos proyectos.** El rediseño de interfaz va por `GOAL-HIG.md`; estos repos no son una guía de diseño.

---

## 7 · Si Mercado Cero crece después del hackathon

| Fase | Qué construir | Inspiración | Por qué ahora no |
|---|---|---|---|
| **1 · Ahora (7 nov)** | Caja, voz, link/QR, webhook, efectivo, fiado, corte, meta | Ninguna; el foso es propio | Es el producto |
| **2 · Semanas 1–4** | Vitrina de pickup para un negocio: menú, horario, pedido, pago | NextOrders (IA/performance), Fleetbase (store key) | Requiere merchants y demanda; no hay usuarios todavía |
| **3 · Semanas 5–8** | Directorio de un tianguis: puestos, “abierto ahora”, radio | Local Vendor App (freshness/Haversine) | Requiere varios puestos y un cliente que descubra |
| **4 · Meses 3–6** | Red multi-merchant y, si se justifica, reparto cooperativo | CoopCycle (modelo), Enatega (roles) | Es otra operación; solo con aliados y demanda real |

**Gates para avanzar:** 10 merchants activos, 100 pedidos/semana, 3 puestos que actualicen su estado, y una demanda explícita de pickup. Sin esos números, el marketplace es una distracción.

---

## 8 · Licencias: el detalle que puede matar el proyecto

| Proyecto | Licencia | Qué implica | Decisión |
|---|---|---|---|
| CoopCycle Web | **Peer Production License** | Uso comercial solo para cooperativas/entidades de economía social; no es OSI | **Solo leer; no copiar** |
| CoopCycle App | MIT | Se puede reutilizar con atribución | Referencia, no urge |
| Nearby Shops | **GPL-3.0** | Obra derivada/distribución con copyleft | **No copiar** |
| Local Vendor App | MIT | Se puede reutilizar con atribución; calidad no probada | Idea, no código |
| Fleetbase Storefront | **AGPL-3.0** | Uso en red puede obligar a liberar el código | **No copiar** |
| NextOrders | MIT | Reutilizable con atribución; solo frontend | Referencia |
| Enatega | MIT frontend + backend propietario | No es open source completo | **No asumir** |

**Regla:** si no puedes explicar la licencia en una frase, no la copias a un proyecto con ánimo de lucro.

---

## 9 · Conclusión

- **CoopCycle** = narrativa de propiedad y cero comisión; no código.
- **Nearby Shops** = idea de cercanía; obsoleto y GPL.
- **Local Vendor App** = la mejor idea futura (freshness/check-in); código pequeño y no probado.
- **Fleetbase** = referencia de storefront multi-vendor; AGPL y backend ajeno.
- **NextOrders** = referencia de performance/SEO y “cero intermediarios”; Nuxt, no Next.
- **Enatega** = ecosistema completo; backend propietario y demasiada complejidad.
- **Mercado Cero** = la única pieza que ninguno tiene: **certeza del pago en el mostrador, con voz, efectivo y fiado**.

**Decisión para el hackathon:** no integrar ninguno. Usar a CoopCycle y NextOrders como validación de categoría en el pitch, a Local Vendor App como idea de roadmap, y a NextOrders como benchmark de performance. El 7 de noviembre se gana con foco, no con un marketplace a medio integrar.

---

## 10 · Fuentes consultadas

- CoopCycle Web — https://github.com/coopcycle/coopcycle-web (licencia: https://github.com/coopcycle/coopcycle-web/blob/master/LICENSE)
- CoopCycle App — https://github.com/coopcycle/coopcycle-app
- Nearby Shops — https://github.com/NearbyShops/Nearby-Shops-Android-app
- Local Vendor App — https://github.com/keithkahurakamau/local-vendor-app
- Fleetbase Storefront — https://github.com/fleetbase/storefront-app
- NextOrders Food — https://github.com/nextorders/food
- Enatega Multi-Vendor — https://github.com/enatega/food-delivery-multivendor
- streetvendor-platform — https://github.com/Sumanth1410-git/streetvendor-platform
- recycle-resell — https://github.com/alfredang/recycle-resell

Metadatos (estrellas, lenguaje, licencia, último push) consultados vía GitHub API el **31 de octubre de 2026**. Los READMEs y licencias se leyeron en el repositorio; no se copió código de ningún proyecto.
