# PROMPT: Asistente opcional

**Para:** `@mc-onboarding-ayuda` · **Prioridad:** P2

## Contexto visual

Usa `design-references/mercado-cero/01_REFERENCIAS/recortes/21_Asistente_Opcional.png` y el PNG maestro. El PNG es inspiración, no truth source. Usa tokens `03_SISTEMA_DISENO/tokens/mercado-tokens.css`, documentación `14_asistente.md` y los SVG editables existentes. NO fotocopiar el mockup.

## Objetivo

Ayudar a comprender datos e instrucciones mediante lenguaje natural sin reemplazar operaciones del sistema.

## Implementación UX requerida

Entrada escrita como principal; micrófono opt-in; preguntas sugeridas; respuestas con fuentes de datos; acciones propuestas que requieren confirmación.

## Política de datos/seguridad

Modelo no calcula saldo canónico, no verifica pago, no hace transferencias autónomas; no graba voz por defecto, no infiere estado psicológico.

## Casos límite y pruebas

Modelo offline/no disponible, respuesta incorrecta, falta de permisos, datos incompletos, usuario rechaza sugerencia.

## Accesibilidad

Texto siempre disponible, respuestas anunciables y sin interrupciones, control de lectura por voz.

## Criterio de aceptación y devolución

Todas las funciones esenciales operan con bot desconectado; el usuario puede apagarlo.

**Proceso obligatorio:** 1. Mapear archivos actuales y dependencia; 2. mostrar diff/plan corto; 3. editar solo rutas propias; 4. ejecutar tests; 5. capturas 375px y 1440px si aplica; 6. devolver archivos, pruebas, límites, screenshots y riesgos. Si el cambio requiere modificar la capa financiera compartida, detenerse, explicar y solicitar orquestación.
