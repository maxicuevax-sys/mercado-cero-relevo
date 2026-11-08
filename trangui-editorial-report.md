# Trangui: revisión editorial y apertura del código

Base revisada: 0f59dd2. Alcance: presentación del repositorio, pitch, guion y textos de pantallas activas, con Humanizer. La tesis es reducir trabajo mental en la operación de un puesto; no se afirma impacto de campo medido.

El README añade una entrada vigente y conserva el cuerpo anterior bajo una advertencia histórica. El README web distingue la plantilla del generador. No se borran reportes, videos ni evidencia. La sustitución masiva inicial fue rechazada automáticamente; se aplicaron cambios acotados sin tocar configuración ni secretos.

Apache 2.0 fue elegida expresamente por el responsable del proyecto. LICENSE contiene el texto oficial; LICENSING.md mantiene los términos de terceros y no concede permisos sobre imágenes sin atribución. No se presenta una auditoría completa de procedencia de assets como terminada.

Fuentes de jornadas: perfiles oficiales de Data México para vendedores ambulantes y comerciantes en establecimientos, 2026-T1. Sus poblaciones no equivalen exclusivamente a tianguistas. Las cifras no miden carga mental ni ahorro de Trangui. URLs y límites están en README y pitch.

Se revisaron helpers, vacíos y descripciones de Inicio, Caja, Ventas, Movimientos, Fiados, Corte, Metas, Pendientes, onboarding, Ayuda y Ajustes. Los controles, rutas y lógica permanecen; se preservan avisos demo/real, reconciliación de cobros y etiquetas contractuales. Acceso/Registro conservan instrucciones ya claras; componentes legacy no activos no se reescribieron. Dos hallazgos independientes se corrigieron: fixtures de Inicio no prometen persistir en Pendientes; Notificaciones reconoce que los avisos aún no están conectados.

El guion tiene 283 palabras narradas. Duración estimada, no ensayada. No se ha validado aquí pago real con Pey, impacto social ni paridad visual en dispositivo físico. La revisión no despliega ni reinicia servidores. La versión pública y la preview pueden seguir en un SHA anterior.

Verificación final y su SHA: consultar `harness/evidence/latest-static.json`, `harness/evidence/runs/` y la corrida CI del commit entregado. No confundir pruebas de versiones previas con las de este lote.
