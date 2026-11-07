# Asistente opcional

**Prioridad:** P2 · **Agente dueño:** `mc-onboarding-ayuda` · **Referencia:** `01_REFERENCIAS/recortes/21_Asistente_Opcional.png`

## Problema humano y tarea

Ayudar a comprender datos e instrucciones mediante lenguaje natural sin reemplazar operaciones del sistema.

## Jerarquía y componentes propuestos

Entrada escrita como principal; micrófono opt-in; preguntas sugeridas; respuestas con fuentes de datos; acciones propuestas que requieren confirmación.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

Modelo no calcula saldo canónico, no verifica pago, no hace transferencias autónomas; no graba voz por defecto, no infiere estado psicológico.

## Estados y situaciones de prueba

Modelo offline/no disponible, respuesta incorrecta, falta de permisos, datos incompletos, usuario rechaza sugerencia.

## Accesibilidad

Texto siempre disponible, respuestas anunciables y sin interrupciones, control de lectura por voz.

## Definition of Done

Todas las funciones esenciales operan con bot desconectado; el usuario puede apagarlo.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
