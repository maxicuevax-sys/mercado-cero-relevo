# Integración Trangui

## Fuentes y alcance

- DSH final: `77a9f54c69cbfa5712ccbf9aa9cd6e3757df8353`, servido en 4580; su export GitHub `978d98944f0ad788a4a6abb5b075ceb8660db7fc` coincide en web salvo `.env.example`. Checkout y puerto sin modificar.
- Diego: PR #3, `bfa9bedd2ccc99ebf16dce47ffe86b0ab6c23041`. Rama original sin modificar.
- Main canónico: `4d2597f6a25aa72de571cba75837b387be331b9a`. Su web coincide con el snapshot local `53b1f61` salvo `.env.example`. Los snapshots exportados tienen raíces Git diferentes: reconciliación con merge-tree usando ese ancestro de contenido y commit de dos padres; sin sobrescribir main.
- Se conserva la base visual verde/crema de DSH y navegación real. Se excluye la paleta Slate del PR.
- Registro: referencia del usuario con taquero/toldo rojo; título negro, marca Trangui, campos HTML y botón verde. Login conserva el tianguis de toldo amarillo.

## Revisión y correcciones

PR #3 recibió REQUEST_CHANGES: moneda ausente aceptada, cierre de venta por consulta S2S contrario a AGENTS y regresión visual. La integración exige MXN explícito; sync-pey solo informa PAID pendiente de webhook firmado.

Se reprodujeron y corrigieron un 500 por transacciones SQLite anidadas en abonos firmados, el reuso del mismo transactionId entre ventas/fiados y el recorte silencioso de sobrepagos. Se usan savepoints, guardas cruzadas y rechazo atómico. Pruebas con payloads firmados y base temporal, sin proveedor real.

## Límites vigentes

Acceso y registro permanecen cerrados con 503: no se simula una sesión. Falta conectar la identidad al aislamiento completo de datos por comerciante antes de abrir cuentas de jueces. Pey real continúa desactivado. Este lote no cambia el VPS ni Cloudflare.

## Evidencia

Los resultados verificables se guardan en `harness/evidence/runs/trangui-access/`, `harness/evidence/runs/trangui-pr-review/` y la corrida del harness identificada por SHA. No contar evidencia de un build anterior como prueba de esta integración.

Revisión independiente: se reprodujo una asignación incorrecta por numRef compartido entre venta y fiado. Ahora las referencias ambiguas o contradictorias devuelven 409 sin escrituras. Siete pruebas del contrato pasan; las colisiones de generación requieren renovar la referencia, no asignar el dinero por prioridad.
