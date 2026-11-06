# Ventas y Caja/Nueva venta — micrófono principal

5 de noviembre de 2026. Continuación sobre `codex/visual-session-b`, base
`9252f38`. Sin merge, push ni despliegue.

## Resultado

Se ajustó Caja a la estructura mínima del maestro
`design-references/mercado-cero/01_REFERENCIAS/recortes/18_Nueva_Venta_Movil.png`:
campo y micrófono contiguos, sin doble marco; etiquetas Quesadilla / Refresco /
Taco que prellenan una frase completa sin registrar nada. El micrófono conserva
64 px, o 56 px a 320. El ticket vacío móvil ocupa menos espacio; mantiene su
título, contador y entrada manual desplegable. No se compacta el ticket con
conceptos. Se conectaron label, ayuda y errores y se anuncian los estados de
grabación e interpretación. Ventas muestra el micrófono en Nueva venta y
conserva su navegación a Caja, sin solicitar permiso automáticamente.

No se tocaron cálculos, persistencia, pagos, webhook, API financiera ni QR.
Los métodos Mixto, revisión explícita de propuesta y confirmación del ticket
permanecen disponibles.

## Verificación ejecutada

- `python scripts/exact-parity-voice.py` desde web/: **42 PASS / 0 FAIL**.
  Servidor de desarrollo aislado en localhost:3317, SQLite temporal; tres
  viewports (1448/390/320), ambas rutas, texto 200%, micrófono visible y
  habilitado, targets, frases en una fila, permiso denegado, parser de texto
  real y adición explícita al ticket. Las mutaciones de pedidos están bloqueadas
  por el script. No hubo intentos de crear pedidos ni errores JavaScript.
- `node --test scripts/voice-draft-test.mjs`: **10 PASS / 0 FAIL**.
- `npm run test:harness`: **58 PASS / 0 FAIL**.
- Cuatro capturas adicionales de alto contraste, ambas rutas a 1448/320:
  sin overflow horizontal. Esto no acredita contraste WCAG ni lector de pantalla.
- `verify:fast`: guard/lint/types verdes; corrida diagnóstica con árbol sucio,
  por lo que no sirve como evidencia formal de entrega.
- `verify:static` y `verify:evidence -- --static`: consultar el resultado final
  en `harness/evidence/latest-static.json`, ligado al HEAD de esta entrega.
- El comando `accuracy_report.mjs` de design-doctrine se intentó ejecutar:
  falló por fixtures/módulos del paquete de skills ausentes y límite de línea
  de Windows. No es un PASS ni una prueba de este producto.

Capturas y JSON locales: `harness/evidence/exact-parity/` (ignorados por Git).
El script conserva las comprobaciones y permite reproducirlas desde web/.

## Límites y veredicto

**NO-GO para paridad exacta y dictado real extremo a extremo.**

No existe lámina dedicada al historial Ventas en las referencias disponibles;
su composición no puede certificarse pixel a pixel. Caja aún difiere del arte:
shell del maestro, ticket editable, cuatro métodos incluido Mixto, captura de
efectivo y mensajes financieros requieren más altura. No hay canon desktop de
Caja. No se sustituyeron datos reales por cifras ni productos de la maqueta.

Se reprodujo `POST /api/voice/transcribe` con WAV existente: HTTP 500.
El log del servidor confirma **ausencia de OPENAI_API_KEY** en este entorno.
No se cambiaron credenciales ni se simuló un reconocimiento exitoso. Hace falta
configurar esa credencial fuera del chat y repetir voz real con permiso y
micrófono físico. El parser escrito funcionó mediante el fallback local existente.

El full no se ejecutó; no se acredita HIG/WCAG completo, hardware, Safari ni
handoff público. Un static válido acredita compilación y controles estáticos,
no la aceptación visual ni la disponibilidad de transcripción.
