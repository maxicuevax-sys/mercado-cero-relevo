# 12 — Pendientes para Oleada C

No se inició Oleada C. Estos puntos no bloquean el cierre local de B.1, pero deben atenderse antes de presentar el producto como migración completa.

## Residuales de B.1

| ID | Residual | Severidad | Propuesta |
|---|---|---|---|
| R-01 | La Caja legacy conserva su flujo histórico de venta; no tiene la reconciliación guiada de 502 de `/caja`. Sí tiene aviso y bloqueo por draft v2. | P2 heredado | En Oleada C, retirar la venta legacy o portar `unknownResult`/reconciliación. |
| R-02 | `/ventas` mantiene N+1 de créditos, sin filtros, búsqueda ni detalle de pagos. | P2 | Read model con join y filtros; 20/página o decisión documentada. |
| R-03 | 404 de Next en inglés; `/pay/inexistente` responde 200 con UI de no encontrado. | P2 | `app/not-found.tsx` y `notFound()` en checkout. |
| R-04 | `?ayuda=1` en `/caja`/`/ventas` sigue saliendo a la ayuda legacy. | P2 | Hoja de ayuda compartida o retirar el enlace hasta tenerla. |
| R-05 | Catálogo `productId`/`sku` se descarta; no hay contrato v2. | P2 | `SaleItemInputV2` y hash explícito. |
| R-06 | Sin auth/roles; la app es single-user local. | Decisión de producto | No presentar como multiusuario. |
| R-07 | Sin exportación, impresión de folio completo ni agrupación por día. | P3/P2 | Oleada D. |

## Bloqueos de handoff público

- `tunnel` y `preflight` sin URL pública estable.
- `latest.json` full del HEAD no existe; no se puede declarar full 23/23.
- pey real, webhook real, QR escaneado, lector físico, iOS/Safari y lector de pantalla real no probados.
- No se ejecutó estudio con 5 personas.

## Regla para C

Oleada C debe partir del SHA de cierre de B.1 y no reutilizar la base principal para pruebas destructivas. El motor financiero sigue congelado hasta que exista dueño explícito y pruebas de regresión.
