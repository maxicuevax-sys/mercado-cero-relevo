# B · Caja, pagos, Ayuda y Ajustes

Cierre técnico local en `revision/caja-b`, base `d1fe344`. Sin merge, push ni despliegue. No se operó el puerto 4497 ni se modificó `mercado-cero-rehearsal-ab`.

## Fuente y alcance

Única referencia visual: `../references/DEFINITIVE/`, manifiesto actualizado `2026-11-06T20:35:41-06:00` (lote nuevo revisado durante la tarea). Se recalcularon los SHA-256 de las refs 02/03/04/09/10/11 contra el manifiesto. Evidencia local: `harness/evidence/exact-parity/b-refs/references.json`, `MANIFEST.snapshot.json` y `SCREEN-MATRIX.snapshot.md`.

| Referencia | SHA-256 (prefijo) |
|---|---|
| 03 método de pago v2 | 319cb87e08f6 |
| 04 pago QR v2 | 8e8b964848ae |
| 09 Ayuda | 961a076f4999 |
| 10 Ajustes | 97518c7cc0a2 |
| 11 pago confirmado | 8420afe52737 |

## Implementación y archivos

- `web/src/components/caja/sale-line-items.tsx`, `sale-voice.tsx`, `caja-spec.css`: targets de textarea/precio de al menos 24 px; botones −/+ de 28×44 px; el nombre accesible incluye el texto visible (unidad, signo y pregunta del dictado). A 320 px no se reducen los botones a 22 px. Cantidad y precio siguen modificando el ticket real.
- `caja-screen.tsx`, `caja-spec-checkout.tsx`, `payment-method-screen.tsx`: M03 es una vista de Caja que reemplaza el formulario de composición, con título/foco, regreso al ticket, total, tarjetas Efectivo/Pago digital/Fiado y Continuar. La revisión conserva efectivo exacto/cambio, cliente, validaciones, Mixto, bloqueo y el flujo de creación/idempotencia existente. Ya no depende de un diálogo.
- `payment-panel.tsx`, `sale-result.tsx`, `payment-states.css`: M04 QR pendiente y resultado/comprobante como vistas separadas; total/QR reales de la API, consulta explícita del estado, compartir QR/comprobante y regreso al inicio. El botón **Confirmar pago · consultar estado** solo hace GET; no marca `paid`. El QR DEMO y el comprobante DEMO dicen que no hay dinero real. El comprobante real depende del estado que devuelve el servidor; no existe un botón para forzarlo.
- `web/src/components/ayuda/help-home.tsx`, `web/src/app/ayuda/{page.tsx,ayuda.css}`: buscador funcional, saludo del asistente, temas, guía, accesos de soporte y asistente local opt-in existente. La búsqueda ignora acentos. Soporte no envía mensajes ni reportes externos.
- `web/src/components/ajustes/settings-home.tsx`, `web/src/app/ajustes/{page.tsx,ajustes.css}`: perfil del negocio, grupos Mi negocio/Cobros/Notificaciones/Seguridad, voz, modo demo, respaldo, Centro de ayuda y Cerrar sesión. Las preferencias avanzadas existentes siguen accesibles en un desplegable. La voz usa la preferencia real de lectura y persiste en el navegador.
- `web/public/assets/spec/b-*.png`: seis recortes de ilustraciones de las refs definitivas 03/09/10/11; no se usan capturas como sustituto de controles o datos.
- `web/scripts/b-refs-ui.py`: reproducer de estados con Chromium, servidor DEMO aislado en 4583 y SQLite dentro del directorio ignorado de evidencia. Sin mocks de rutas ni fixtures `paid` en la prueba UI.
- `web/scripts/oleada-b1-regression.py`: actualizado el selector accesible y la revisión móvil diálogo→M03. El chequeo de foco espera la ruta y el foco real en vez de dormir 500 ms; conserva su condición de aceptación. No se eliminaron las comprobaciones financieras.

La comparación contra la base conserva sin cambios shell/navegación A, Inicio, Ventas, Fiados, Corte, Metas, Pendientes, globals, `lib/`, APIs financieras y `/pay/**`: `preservation.json`. M02 solo recibe el ajuste A11Y solicitado. No hay cambios en webhooks, contratos de dinero, autenticación ni secretos.

## Capturas reales

Directorio: `harness/evidence/exact-parity/b-refs/`. Todas las filas tienen captura completa; su hermana `-viewport.png` registra el encuadre inicial. Viewports 390×844 y 320×693. `ui.json` guarda los hashes, el SHA inicial/final y los resultados; los PNG son artefactos locales ignorados, disponibles en este worktree.

| Pantalla/estado | 390 px | 320 px |
|---|---|---|
| M02 Caja A11Y | [captura](harness/evidence/exact-parity/b-refs/390-M02-caja.png) | [captura](harness/evidence/exact-parity/b-refs/320-M02-caja.png) |
| M03 método | [captura](harness/evidence/exact-parity/b-refs/390-M03-method.png) | [captura](harness/evidence/exact-parity/b-refs/320-M03-method.png) |
| M03 Fiado seleccionado | [captura](harness/evidence/exact-parity/b-refs/390-M03-credit.png) | [captura](harness/evidence/exact-parity/b-refs/320-M03-credit.png) |
| M03 efectivo/revisión | [captura](harness/evidence/exact-parity/b-refs/390-M03-cash-review.png) | [captura](harness/evidence/exact-parity/b-refs/320-M03-cash-review.png) |
| M03 digital seleccionado | [captura](harness/evidence/exact-parity/b-refs/390-M03-digital.png) | [captura](harness/evidence/exact-parity/b-refs/320-M03-digital.png) |
| M04 QR por cobrar | [captura](harness/evidence/exact-parity/b-refs/390-M04-qr.png) | [captura](harness/evidence/exact-parity/b-refs/320-M04-qr.png) |
| M04 comprobante DEMO | [captura](harness/evidence/exact-parity/b-refs/390-M04-confirmed-DEMO.png) | [captura](harness/evidence/exact-parity/b-refs/320-M04-confirmed-DEMO.png) |
| M09 Ayuda | [captura](harness/evidence/exact-parity/b-refs/390-M09-help.png) | [captura](harness/evidence/exact-parity/b-refs/320-M09-help.png) |
| M09 búsqueda/tema | [captura](harness/evidence/exact-parity/b-refs/390-M09-search.png) | [captura](harness/evidence/exact-parity/b-refs/320-M09-search.png) |
| M09 asistente consultado | [captura](harness/evidence/exact-parity/b-refs/390-M09-assistant.png) | [captura](harness/evidence/exact-parity/b-refs/320-M09-assistant.png) |
| M10 Ajustes | [captura](harness/evidence/exact-parity/b-refs/390-M10-settings.png) | [captura](harness/evidence/exact-parity/b-refs/320-M10-settings.png) |
| M10 límite de Cerrar sesión | [captura](harness/evidence/exact-parity/b-refs/390-M10-logout-limit.png) | [captura](harness/evidence/exact-parity/b-refs/320-M10-logout-limit.png) |

También se capturan Caja, M03, QR, comprobante, Ayuda y Ajustes con raíz de texto a 32 px (200%) y alto contraste: sufijos `-text200-HC.png`. Se revisaron visualmente los encuadres de las seis pantallas en ambos anchos y el reflujo. Las hojas `contact-390.png` y `contact-320.png` resumen los encuadres; no sustituyen a las capturas completas.

## Deltas frente a las referencias

- Se conserva el shell/navegación A. No se copia la barra de estado del teléfono ni se cambia el destino Gastos de la referencia por una navegación nueva. La ilustración ambiental y el papel picado de M03/M04 no se reproducen completos; las tarjetas, jerarquía y estados sí se implementan con controles reales.
- Importes, folio, hora y QR vienen del ticket/API; no se fijan los $70/$120 ni el folio ficticio de la referencia. El ticket demo existente suma $140. Mixto sigue disponible como opción secundaria.
- La referencia 04 mezcla “Por cobrar”, un botón de confirmación y “Pago verificado”. Se separan pendiente y resultado para evitar afirmar un pago inexistente. La referencia 11 se acredita visualmente en su variante **DEMO**, con color/etiqueta de simulación. No hay captura de un cobro real por pey.
- A 320 px, los temas de Ayuda pasan a una columna para que los títulos no se corten. A 200% los importes, controles QR y comprobante se apilan. El contenido puede requerir scroll vertical.
- Ayuda usa iconos funcionales y una guía local; no ofrece soporte humano, videos ni IA remota inexistentes. Enviar mensaje/Reportar problema explican ese límite.
- El switch de voz controla lectura, no concede permiso al micrófono. Modo demo refleja el servidor y no lo conmuta. Perfil/configuración/respaldo muestran la información o el límite disponible. **Cerrar sesión es UI explicativa sin backend:** no borra datos, no simula autenticar ni promete cerrar un acceso externo.

## Verificación

Runtime comprobado en **`8bfd6f8bfef5ceb9b745db54bed9fd9ae57314b1`**, con árbol limpio y SHA estable durante la captura.

| Comando | Resultado comprobado | Evidencia local |
|---|---|---|
| `python scripts/b-refs-ui.py` | **80 PASS / 0 FAIL**, 72 PNG con hashes; 12 auditorías axe del main sin violaciones; 390/320 y reflujo al 200%/HC | `ui.json`, `ui-run.txt` |
| `npm run test:security` | **58/58** | `security.txt` |
| `npm run test:demo-pay` | **66 PASS / 0 FAIL**, árbol limpio y buildSha correcto | `demo-pay.txt` |
| `npm run test:b1-regression` | **68 PASS / 0 FAIL** | `b1.txt`, `b1/oleada-b1-regression.json` |
| `npm run verify:fast` | **3/3** en checkpoint `bae8683`; sus tres gates se repitieron dentro del static del código final | `fast.txt`, `static-code.txt` |
| `npm run build` / `npm run verify:static` | **BUILD OK + compiled successfully**, **5/5** en el SHA de runtime | `static-code.txt`, `harness/evidence/latest-static.json` |
| `npm run verify:evidence -- --static` | **EVIDENCIA OK**, SHA/dirty/build/hashes comprobados | `verify-code.txt`; cierre documental: `verify-evidence.txt` |

Las pruebas UI ejercitan edición de precio, −/+, selección/revisión de métodos, validación de cliente para fiado, generación del QR, consulta sin mutación del pago pendiente, simulación únicamente `demo_paid`, `verify:false`, búsqueda, asistente local, persistencia de voz y límite de cierre de sesión. Compartir copia el código QR exacto y un comprobante con advertencia DEMO. No se registraron pageerrors.

La prueba B.1 detectó una espera fija de foco insuficiente bajo carga concurrente; se sustituyó por espera de la ruta y el foco reales. La corrida completa posterior es la que acredita **68/0**. Los fallos intermedios de codificación/reflujo fueron corregidos y sus capturas se regeneraron; no se presentan como evidencia final.


La evidencia estática final se genera después del commit documental, sobre árbol limpio y HEAD estable, y se verifica con `npm run verify:evidence -- --static`. `latest-static.json` y el log de cierre son la autoridad para su SHA final.

## Límites

No se ejecutó `verify:full`, túnel, despliegue, cobro real, lector de cámara, hoja nativa de compartir en teléfono, Safari/iOS ni lector de pantalla físico. El fallback de compartir al portapapeles sí se ejercita con el código QR real y el comprobante etiquetado DEMO. Las auditorías axe son del main y no certifican WCAG completo ni aceptación humana. No se declara paridad gráfica exacta ni GO público.
