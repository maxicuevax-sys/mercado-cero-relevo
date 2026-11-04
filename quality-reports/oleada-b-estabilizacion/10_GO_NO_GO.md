# 10 — GO / NO-GO — Operación B.1

**Producto:** `bdfbe8b` (fix) + `8101849` (pruebas)
**Build verificado:** `8101849`

## Decisión

| Nivel | Decisión | Lectura |
|---|---|---|
| **Local B.1** | **GO local** | P0-01/02 cerrados; 12 P1 del alcance cerrados; P1-10 preservado; verificación independiente final con 65/65. Residuales P2/P3 documentados y aceptados. |
| **Demo controlada** | **GO con guion ampliado** | Se puede demostrar fiado puro, mixto efectivo+digital, pendientes y 502 con datos demo aislados. Sigue prohibido presentar demo como dinero real. |
| **Handoff público** | **NO-GO** | Faltan `tunnel`/`preflight`, `latest.json` full, pey real, QR/lector real e iOS/Safari. |

## Condiciones de GO local

| Condición | Evidencia |
|---|---|
| P0 = 0 | P0-01/P0-02 en B.1 regression y capturas |
| P1 del alcance = 0 | Matriz `01_MATRIZ_HALLAZGOS.md`; B.1 65/65 |
| Interfaz dice lo vendido/cobrado/pendiente | P0/P1-07/P1-08/P1-09; panel y Ventas |
| Sin duplicación de operaciones | P1-12 502 + recarga; misma llave; 1 orden |
| Suites críticas verdes | p0 5/5, webhook, checkout, demo-pay funcional, smoke A/B |
| Recorridos operativos | Caja, Ventas, pendientes, fiado, mixto, digital demo |
| Responsive sin bloqueos | vista 1448/1366/1280/768/390/360/320 y 200 % |
| Verificación independiente | `09_VERIFICACION_INDEPENDIENTE.md` |
| Evidencia del estado probado | SHA/build en cada suite; logs en `evidencia/` |

## Lo que no se probó

- pey real, webhook real de banco, checkout real.
- QR escaneado con app bancaria, lector físico.
- iOS/Safari, teclado virtual, safe areas reales, HCM real.
- Lector de pantalla real (NVDA/JAWS/VoiceOver/TalkBack).
- Full 23/23; `tunnel`/`preflight`.
- Estudio con 5 personas.

## Riesgos residuales

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Venta legacy sin reconciliación guiada de 502 | P2 | Caja nueva es la fuente; aviso de draft y nav “Clásica”; portar en C |
| `/ventas` N+1/filtros | P2 | No bloquea B.1; C |
| 404/ayuda/catálogo v2 | P2 | C/D |
| Datos demo y reales comparten proceso/base | P2 conocido | No usar reset sobre base principal; suites aisladas |
| `latest.json` full ausente | Bloqueo público | No declarar público |

## Firma

**GO local con residuales P2/P3 aceptados. GO demo con guion ampliado. NO-GO público. Oleada C no iniciada.**
