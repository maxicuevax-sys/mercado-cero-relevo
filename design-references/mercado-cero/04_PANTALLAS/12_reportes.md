# Reportes simples

**Prioridad:** P2 · **Agente dueño:** `mc-modulos-negocio` · **Referencia:** `01_REFERENCIAS/recortes/23_Reportes_Simples.png`

## Problema humano y tarea

Dar contexto para decidir, sin sobrecargar con gráficos ni comparar mal.

## Jerarquía y componentes propuestos

Ventas registradas, cobros, deudas, gastos, utilidad solo si costos suficientes; periodo y filtros; explicación textual junto a gráfico y tabla.

## Datos / contrato financiero (NO inferir lógica desde la imagen)

No confundir ventas con efectivo; comparaciones solo con periodos equivalentes y cobertura de datos fiable.

## Estados y situaciones de prueba

Sin registros, registros incompletos, montos negativos, fechas fuera de zona horaria, importación parcial.

## Accesibilidad

Tabla alternativa con unidades, tooltip accesible, grafico no único portador de información.

## Definition of Done

Mismas cifras en tabla y gráfico; ninguna recomendación financiera si datos insuficientes.

## Entrega de subagente

- Screenshot móvil y escritorio cuando aplique, con fuente ampliada.
- Lista de componentes y archivos modificados.
- Evidencia de test en caso feliz, vacío, error, sin conexión y estado restringido.
- Confirmación de que no se tocó contabilidad ni integración bancaria salvo tarea explícita.
- Enlace a tarea/PR local o commit opcional; incluir fallos y decisiones pendientes.
