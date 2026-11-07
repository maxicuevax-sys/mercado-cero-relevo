# Diferencia entre diseño de UI y assets reales

El screenshot 1448×1086 NO contiene recursos gráficos separados con capas limpias. Los iconos, ilustraciones y motivos se deben proporcionar como componentes SVG, PNG transparentes o CSS reales; el mockup no puede ser la textura entera de fondo.

Para la pantalla Inicio faltan como producción, si no están ya en el repo:
- ilustración de registradora con mantel para hero Nueva venta (sin texto ni botones);
- mujer comerciante con tableta para tarjeta sugerencia (sin texto);
- motivo papel picado con transparencia superior derecha;
- plantas/bolsa decorativa para base de sidebar;
- logo/ícono de puesto y líneas de acento;
- iconos KPI en una familia coherente;
- variantes escala 1x/2x/3x solo cuando corresponda.

El viejo paquete contiene algunos SVG hechos por reconstrucción, pero NO son copias exactas de la imagen generada. Si no consiguen correspondencia suficiente, usar placeholders tipográficos discretos y emitir lista de activos faltantes: NO disfrazar la carencia con tarjetas grises.

Los QR de ejemplo en imágenes NO son QR de pago funcional. Generar QR real con los datos validables de proveedor y estado backend, nunca incrustar QR ilustrativo como si cobrara.
