# Assets de Inicio

Recortes y SVGs usados por la ruta `/inicio`. La fuente canónica es
`design-references/mercado-cero-rescate/00_REFERENCIA_CANONICA_INICIO_1448x1086.png`.

- `hero-registradora.png`: cutout RGBA de la registradora y la mesa. Se eliminó el
  fondo verde y se conserva la mesa completa.
- `sugerencia-lupita.png`: cutout RGBA de Lupita con la tableta. Las primeras
  filas son transparentes para no duplicar el borde de la tarjeta.
- `sidebar-plantas.png`: plantas y bolsa completas sobre el verde original. La
  interfaz aplica una máscara superior para integrarlo con el sidebar.
- `papel-picado.png`: motivo decorativo transparente; no es información
  interactiva.
- `brand-shop-cream.svg`: símbolo de tienda crema para el sidebar, sin placa
  blanca.
- `logo-simbolo.svg`: símbolo del kit para el topbar.
- `icons/`: iconos del kit usados como máscaras CSS con `currentColor`.

No se usa el QR ilustrado de la referencia como QR real. No se usa la captura
completa como fondo de la aplicación. Los assets no son capas vectoriales
editables salvo los SVG; los recortes se documentan en `manifest.json`.
