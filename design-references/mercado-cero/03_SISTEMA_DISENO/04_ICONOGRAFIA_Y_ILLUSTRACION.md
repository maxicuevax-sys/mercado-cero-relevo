# Manual de iconos e ilustración

Se incluyen SVG de línea propia 24×24 en `02_ASSETS/icons`, con `currentColor` y ancho 1.8. Son bases funcionales editables, no copia exacta de los iconos visibles en la captura. **No reutilizar íconos en contextos con significados ambiguos** (por ejemplo, el símbolo de una caja para reportes de ventas).

## Convenciones

- Trazos redondeados, peso visual uniforme. En navegación 20–24 px; CTA 20–24 px; ilustraciones fuera de tareas de cobro.
- Alt: para iconos que duplican etiqueta textual usar `aria-hidden='true'`; para icono de acción sin etiqueta, `aria-label` contextual e inequívoco.
- No usar emoji como pictogramas de producto/estado financiero; pueden variar por dispositivo y lector.
- Se permiten ilustraciones en onboarding, vacíos, ayuda y objetivos. En cobros: máximo una señalización ilustrada pequeña si cumple una necesidad real.
- El QR ilustrativo `telefono-qr.svg` es **decorativo y no es un QR de cobro real**.

## Catálogo

`inicio`, `ventas`, `caja`, `fiado`, `corte`, `metas`, `pendientes`, `inventario`, `proveedores`, `reportes`, `ayuda`, `ajustes`, `digital`, `qr`, `efectivo`, `ahorro`, `monedas`, `persona`, `grupo`, `microfono`, `verificado`, `pendiente`, `error`, `borrador`, `sin-conexion`, `exportar`, `seguridad`, `calendario`, `reloj`, `campana`, `editar`, `mas`, `flecha`, `compras`, `cambiar-cuenta`, `sol`, `contraste`, `tickets`, `alimentos`, `guardar`.

## Futuras ilustraciones

Crear artboards individuales con silueta, paleta, escala y sombra coherentes. No usar rostros generados como supuesto testimonio de clientes. Nunca poner texto dentro del SVG de ilustraciones narrativas que requiera localización; el texto de UI va en HTML accesible.
