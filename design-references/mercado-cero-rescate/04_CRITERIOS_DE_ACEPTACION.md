# QA independiente — Checklist de aceptación

## Bloqueantes (deben pasar TODOS)

- [ ] Ruta Inicio auténtica, activa y visible. En el screenshot no aparece seleccionada Caja.
- [ ] Screenshot de referencia y captura real son 1448×1086; mismo zoom, contexto demo controlado.
- [ ] Sidebar verde y topbar ocupan posiciones equivalentes a la referencia.
- [ ] Saludo ocupa parte superior del contenido principal (no columna de la derecha).
- [ ] Hay 4 tarjetas KPI en una sola fila desktop, en orden exacto.
- [ ] Hero `Nueva venta` grande y destacado a la izquierda en segunda fila.
- [ ] Pendientes a la derecha del hero, mismo nivel vertical.
- [ ] Sugerencia a lo ancho debajo de ambos paneles (si hay sugerencia; de lo contrario empty state intencional sin romper composición).
- [ ] No se insertó el formulario operativo de Caja como sustituto del dashboard.
- [ ] `Nueva venta` conecta al flujo de venta real; Caja sigue funcionando por separado.
- [ ] No hay saldos / confirmaciones bancarias inventadas; fixture exclusivamente DEMO.
- [ ] No se usó la captura original como fondo de pantalla ni una imagen gigante de la UI.

## Calidad visual (puntuación 0 a 2 c/u, máximo 12)

| Aspecto | 0 | 1 | 2 |
|---|---|---|---|
| Estructura | Incorrecta | Parcial | Equivalente |
| Proporciones/espaciados | Composición distinta | Aproximada | Cercana |
| Tipografía | Genérica/desproporcionada | Parcial | Jerarquía fiel |
| Color/bordes/sombras | Otra identidad | Parcial | Coherente |
| Iconos/ilustraciones | Desconectados | Parcial | Sistema integrado |
| Responsive/a11y | Fallos críticos | Ajustes pendientes | Funcional |

No pasar por mera puntuación si falla un bloqueante. El verificador debe documentar diferencias reales, no escribir «paridad conseguida».

## Siguientes rutas

Tras aprobar Inicio, evaluar pantallas independientes: Caja/Nueva venta, Método de pago, QR pendiente vs verificado, Fiados, Corte, Metas, Pendientes y onboarding. La referencia de Inicio NO es especificación de Caja.
