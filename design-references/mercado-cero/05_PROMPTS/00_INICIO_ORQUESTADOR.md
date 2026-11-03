# PROMPT DE ARRANQUE PARA ORQUESTADOR — PEGAR EN OPENCODE

Actúa como director de producto, diseño, frontend y calidad de **Mercado Cero**, usando el agente primario `mc-orquestador` y subagentes disponibles. El objetivo es implementar gradualmente el kit de diseño que he copiado bajo `design-references/mercado-cero/`. **No busco recrear la imagen pegándola: busco un producto funcional, mantenible y accesible.**

0. Verifica raíz de repositorio, estado de git, scripts, stack, dependencias, estructura y tests existentes. NO editar aún. Si el kit no está en la ruta citada, localízalo sin modificar nada y ajusta referencia.
1. Abre `00_INICIO/LEEME_PRIMERO.md`, `COMO_USAR_CON_9_SUBAGENTES.md`, `03_SISTEMA_DISENO/01_BRAND_GUIDE.md`, `03_SISTEMA_DISENO/03_CONTRATOS_COMPONENTES.md`, `04_PANTALLAS/MATRIZ_PANTALLAS.csv` y la fuente PNG maestra. Conoce limitaciones de raster.
2. Invoca `mc-auditoria-repo` para inventariar páginas, componentes, CSS/tokens, estados financieros, cobertura de pruebas, scripts y fragilidades de UX. Pide al `mc-verificador-final` un baseline de calidad. Dejar un resumen documentado.
3. Diseña una **matriz de propiedad de archivos y dependencias**; delega por olas: sistema de diseño → shell → ventas/pagos → fiado/corte → secundarios + onboarding → accesibilidad → verificación final. Puedes usar hasta 9 subagentes; NO editar en paralelo el mismo archivo ni escribir todos sobre el mismo estado de ventas.
4. Para cada módulo, exige: propuesta de diseño, screenshot previo, intervención pequeña, pruebas, screenshot posterior, estados vacíos/error/offline, accesibilidad y retorno de cambios. No permitir que una captura de mockup dicte un saldo.
5. En particular: (a) pago QR solicitado ≠ pago verificado; (b) abono de fiado antiguo ≠ venta nueva; (c) meta virtual ≠ fondos custodiados; (d) venta registrada ≠ efectivo recibido; (e) demo ≠ transacción real.
6. Compatibilidad: experiencia en móvil Android económico, sin IA, texto ampliado, sin mouse, conexión intermitente. Investigar posibles saltos de lógica antes de cambiar componentes.
7. Mantener la marca editorial mexicano-contemporánea: Fraunces solo display y Inter funcional; verde profundo, papel cálido, barro y maíz; iconos SVG locales y marcas discretas, cero rayado de página completa; ilustración solo en onboarding/ayuda/empty states.
8. Antes de integrar cambios: todos los tests que existan, chequeos a11y, keyboard, mobile 320/375/768/1440, API de pagos simulados sólo marcada DEMO, pruebas de reconciliación.

**ENTREGA INICIAL ESPERADA:** un plan real de implementación en el repo con rutas exactas, asignación de agentes, riesgos, P0/P1/P2, pruebas de referencia y la PRIMERA tarea pequeña. No redactes otro análisis genérico. Ejecuta las tareas aprobadas por fases y deja checkpoints reversibles. Solicita mi aprobación únicamente cuando vayas a cambiar contabilidad, seguridad, dependencias principales, credenciales o despliegues.
