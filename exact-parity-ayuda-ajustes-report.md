# Ayuda, Ajustes y asistente opcional

6 de noviembre de 2026. Base: `7543210`. Sin merge, push ni despliegue.

## Resultado

Ayuda recupera las filas de acceso de `opencode/19_Secciones_Secundarias.png`:
guías, preguntas frecuentes y consulta opcional. Los enlaces apuntan a contenido
real. No se dibujan accesos a videos o soporte sin un servicio disponible.
Se conservan las siete preguntas, los primeros pasos y los avisos de dinero.
Se corrige la base flex de la tarjeta final para evitar un vacío de 320 px en móvil.

El asistente sigue las cuatro preguntas de `opencode/15_Asistente_Movil.png`.
Es una **guía local**, sin modelo ni acceso a cifras del negocio. Las respuestas
declaran su fuente, enlazan a Ventas/Pendientes/Corte y explican las capacidades
ausentes. Una pregunta desconocida ofrece las FAQ sin inventar una respuesta.
No solicita micrófono. El dictado real permanece en Caja.

Se activa por elección explícita, apagado por defecto. Ajustes y Ayuda comparten
la preferencia, incluso entre pestañas; sin almacenamiento funciona en la sesión.
Apagarlo mantiene FAQ, Caja y avisos críticos. Las preferencias de acompañamiento
existentes conservan su significado y sus claves.

Ajustes conserva tamaño de letra, contraste, velocidad, silencio y lectura.
Se corrige la explicación que atribuía el silencio a un botón inexistente en
la barra y la instrucción antigua de mantener pulsado el micrófono.

## Referencias y límites

Referencias completas disponibles en
`C:/Users/Public/Documents/MercadoCero-Visual-Sync/references/opencode/`:
`15_Asistente_Movil.png`, `17_Accesibilidad_y_Tema_Oscuro.png` y
`19_Secciones_Secundarias.png`.

**Paridad exacta: NO certificada.** Ayuda conserva más contenido funcional que
la lámina. No hay canon dedicado de Ajustes ni desktop del asistente. No se añade
tema oscuro ni chat de IA como si ya existieran. La composición adapta el shell
actual y protege los controles accesibles; las capturas no prueban igualdad píxel
a píxel ni aceptación del usuario.

## Evidencia reproducible

Desde `web/`: `python scripts/exact-parity-help.py`, con `BASE_URL` del servidor
aislado. Desarrollo en `127.0.0.1:3317`, DEMO_MODE y SQLite temporal, sin tocar
la base del servidor compartido.

- **96 PASS / 0 FAIL** en Chromium: 1448/390/320, ambas rutas, reflujo al 200%,
  alto contraste y texto grande, FAQ, silencio, persistencia tras recargar,
  cuatro consultas sugeridas, consulta escrita, pregunta desconocida, apagado,
  guía offline, sincronización entre pestañas y almacenamiento denegado.
- Nueve auditorías axe del contenido principal, WCAG A/AA: **0 violaciones**.
- Ninguna mutación de API ni solicitud de micrófono; ningún error JavaScript.
- Capturas y JSON ignorados por Git en `harness/evidence/exact-parity/help/`.
  Se revisaron visualmente Ayuda/Ajustes a 390 y asistente con alto contraste.
- Linter de hardcodes de la skill: PASS en los dos archivos nuevos del asistente.
  El validador DTCG genérico de contraste no representa los tokens CSS de este
  repo; su salida predeterminada no se usa como evidencia del producto.
- `verify:fast`: guard/lint/types; consultar la corrida final. Con árbol sucio
  es diagnóstico y no produce evidencia formal válida.
- Evidencia estática formal: consultar `harness/evidence/latest-static.json`
  en el worktree aislado `../mercado-cero-ayuda-ajustes` y validarla desde su
  `web/` con `npm run verify:evidence -- --static` contra el HEAD entregado.

No se ejecuta full: no se acredita túnel, preflight, pagos reales, lector de
pantalla físico, Safari ni transcripción. Sin aceptación visual ni handoff público.
No se modifican API, contabilidad, webhook, checkout ni dependencias.

## Integración

Los cambios concurrentes de Inicio y shell del checkout original no pertenecen
a este carril y no se incluyen en su commit. La validación estática usa un
worktree limpio para no esconder ni guardar cambios ajenos. El merge sigue
reservado al orquestador con revisión humana.
