# Trangui: identidad del repositorio, 8 de noviembre de 2026

Alcance autorizado: añadir nombre y slogan debajo del QR suministrado, presentar Trangui al abrir el repositorio y actualizar su descripción. El usuario eligió conservar el avatar personal y recibir un archivo de avatar descargable.

Base: `dca4c5bd9215e9374e5ef74e17a19db21421123b`. Commit de las piezas y README: `1f44656`. Se añade después únicamente este informe. No se cambia código de la aplicación, despliegue, DNS, pagos, datos ni visibilidad del repositorio.

## Entrega

- `docs/brand/`: QR original, identidad principal, avatar cuadrado, portada horizontal, composición HTML, exportador y hashes/comparación de píxeles en `verification.json`.
- README: portada al inicio y enlaces a Trangui, descargas y pitch; se conserva todo el contenido anterior.
- Descripción: «Trangui · Tu puesto, con menos pendientes. Mostrador digital para tianguis: ventas, cobros, fiados y caja. Demo y código fuente.» Enlace del sitio: `https://xn--hw9h.st/`.
- Las tipografías Hearth y Alder y la frase breve proceden de Trangui. El PNG original se conserva byte por byte; el área de QR conserva sus píxeles en la identidad principal y el avatar. No se reconstruyó con IA.

## Comprobación

- Inspección visual de los tres PNG exportados: nombre y slogan debajo del QR, sin superposición ni texto cortado.
- ZXing-C++ decodifica los cuatro PNG (original y tres composiciones) a `https://xn--hw9h.st/`.
- Comparación de los 784 × 784 píxeles del QR: cero diferencias en identidad principal y avatar. SHA-256 del original y derivados en `docs/brand/verification.json`.
- Destino del QR: HTTP 200, título de Trangui, comprobado en esta sesión. No se presenta como QR de pago ni prueba de depósito.
- `git diff --check`: sin errores.
- `npm run verify:fast`: 3/3 PASS sobre `1f44656`, árbol limpio. Evidencia local ignorada: `harness/evidence/runs/2026-11-08T19-49-16-637Z-fast.json`. No acredita full, static ni un build desplegado.

## Límite de GitHub y reversión

El repositorio es privado y sus ajustes no ofrecen una primera carga de vista previa social. GitHub solo permite esa carga en repos públicos o privados con imagen cargada previamente: [documentación oficial](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview). La portada horizontal queda descargable; no se cambia la privacidad para activarla.

La portada principal se publica mediante el README. Para retirar esta identidad, revertir los commits de esta entrega. Para restaurar metadatos, dejar vacío el enlace del sitio y restablecer la descripción anterior: «Trangui: mostrador digital para tianguis. Ventas, fiados y caja con menos pendientes en la cabeza. Demo y código abierto.» No se ha necesitado ejecutar rollback.
