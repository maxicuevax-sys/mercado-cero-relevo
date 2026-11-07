# Resumen del negocio (escritorio)

**Prioridad:** P1 · **Agente dueño:** `mc-shell-responsive` · **Referencia:** `01_REFERENCIAS/recortes/02_Dashboard_Desktop.png`

## Problema humano y tarea

Mostrar situación operativa del día, 1 acción primaria, tareas urgentes y condiciones verificadas; NO reproducir todos los módulos como tarjetas aleatorias.

## Jerarquía y componentes propuestos

Topbar con negocio y sesión; sidebar con etiquetas; saludo opcional; cuatro KPIs con explicaciones; acción principal Nueva venta; tareas de hoy; sugerencia contextual que pueda cerrarse; acceso a cierre y reportes.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

Métricas: venta registrada, cobrado confirmado, por cobrar, meta virtual. Cifras en enteros menores, periodo explícito, comparación solo con datos suficientes. La suma de ventas no debe sustituir dinero disponible.

## Estados y situaciones de prueba

Sin ventas: CTA «Registrar primera venta»; sin conexión: banner sobrio; sin costos: utilidad no calculable; datos discrepantes: estado de revisión. No usar ilustración de resultados financieros como prueba de pago.

## Accesibilidad

Lectura por teclado orden natural de título→métricas→acción→tareas; indicadores con label y unidad, gráficos con alternativa textual y tabla.

## Definition of Done

En viewport de 375px la acción principal es visible y no hay scroll horizontal; 200% zoom conserva datos; pantalla de inicio no obliga a usar IA.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
