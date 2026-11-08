# Trangui — candidato sobre la versión de DSH

## Decisión del usuario

La aplicación pasa a llamarse **Trangui**. La fuente visual/funcional es la
versión que DSH sirve en 4580, no el build antiguo del VPS ni la maqueta de
registro rechazada. Se conservan colores, tipografía, ilustraciones, rutas,
hub CoDi, cámara, micrófono y pendientes de DSH.

## Procedencia comprobada

- Base del candidato: `f2980e7a37f193f4b39e389badf4d3557a4f4b3e`, rama local
  `revision/assembly-fixes`, worktree `integration-candidate-fixes`.
- Se verificó ese SHA en `/api/health` de 4580 y en su BUILD_SHA; árbol limpio
  al tomar la base. DSH continúa siendo dueño de ese servidor y checkout.
- Mi setup previo: `86be89a4ed1115e6c973fe5e4b3442b0a6f0924a`, publicado en
  `codex/vps-pilot`. Se trasladaron sus archivos técnicos de identidad, pruebas
  y despliegue; no su versión anterior de Inicio/Caja ni sus maquetas.
- Rama de Diego consultada: `diego/onboarding`, SHA
  `5fe09f24ff4b6af7b1d9bfc6c7bb267bfedf024b` en GitHub.
- Esa rama contiene pagos, sincronización y cambios de paleta Mineral/Slate;
  no es solamente una pantalla de registro. Tiene raíz Git diferente a la
  rama local de DSH; no se intentó unir ambas historias ni copiarla completa.
  Comparar e incorporar solo los cambios que falten sobre la base de DSH.

## Qué aporta este candidato

- Nombre visible Trangui en marcas de texto, encabezados/metadatos, manifiesto
  PWA, títulos, ayudas y comprobantes. Pictogramas y estilo visual existentes.
- Dockerfile/standalone, snapshots, configuración y herramientas operativas del
  piloto. Se conservan las cabeceras privadas de Movimientos de DSH.
- Better Auth 1.7.18, Playwright 1.65.0 y axe 4.14.0 fijados, manteniendo ZXing
  de DSH en package.json/lock. Identidad separada, registro cerrado por defecto.
- Pruebas `test:pilot-identity` y `test:pilot-browser`, sin ruta pública de auth
  montada. No confundir identidad probada con aislamiento de ventas terminado.
- Corrección mínima del lint de cámara heredado de DSH: actualizar el callback
  ref dentro de un efecto y mantener el control ZXing en el ámbito del efecto.
  Los tres errores se reprodujeron antes y quedaron en cero después; no se
  deshabilitó ninguna regla ni se cambió la interfaz del escáner.

## Límites y continuidad

El dominio y los identificadores operativos existentes se conservan: renombrar
el producto no implica migrar DNS, bases, servicios, secretos ni preferencias
guardadas como `mercado-cero:*`. La aplicación pública sigue en el build
`09b4f8d`; este candidato NO se desplegó al VPS.

El usuario suministrará los nuevos diseños de acceso/registro. Antes de abrir
cuentas: aislamiento de negocio por usuario, protección completa de rutas,
cuotas, cuenta propietaria, respaldo/restauración conjunta y canary. Pey real
sigue desactivado. Revisar por separado los contratos de sync-pey y webhook
de los aportes de Diego antes de activar pagos reales.

Los SHA de imágenes/unidades de `deploy/ops` describen el piloto que está
funcionando, no una instrucción para publicar este candidato. Actualizarlos
solo durante un despliegue autorizado y verificado, con rollback.

## Entrega para ensamblar

Usar la rama `codex/trangui-setup` del repositorio mercado-cero-relevo. Está
basada en el commit de DSH indicado arriba. Consultar el reporte
`trangui-setup-report.md` y la evidencia del SHA del candidato antes de probar
o publicar. Sin merge a main ni cambio en 4580.
