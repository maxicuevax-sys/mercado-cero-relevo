# Mercado Cero · Kit de diseño y orquestación para OpenCode

**Lee esto primero.** Paquete creado a partir de la imagen proporcionada `image(7).png`, de 1536 × 1024 px. Contiene recortes de referencia, iconos/ilustraciones SVG **reconstruidos como propuestas originales**, una guía de marca, tokens, matrices, especificaciones, prompts y agentes.

## Lo que sí contiene

- `01_REFERENCIAS/00_MASTER_1536x1024.png`: composición original sin modificaciones.
- `01_REFERENCIAS/recortes/`: **26 recortes PNG** para cada región importante; las coordenadas exactas están en JSON.
- `02_ASSETS/`: **40 iconos SVG** originales, **8 ilustraciones SVG** y motivos SVG, además de versiones del logo.
- `03_SISTEMA_DISENO/`: tokens JSON/CSS, tipografía, colores, iconos, matriz de componentes, semántica.
- `04_PANTALLAS/`: especificaciones para las pantallas de producto, no meros mockups.
- `05_PROMPTS/`: prompts de arranque, por módulo y de auditoría.
- `06_OPENCODE_COPIAR_AL_REPO/`: agentes OpenCode y skill en estructura `.opencode`.
- `07_QA/`: pruebas, escenarios y herramientas de verificación adaptables.
- `08_PREVIEW/`: catálogo HTML local para navegar imágenes y activos.
- `09_GOBERNANZA/`: decisiones de propiedad, independencia y entrega.

## Honestidad sobre las imágenes

El diseño fuente **es una sola imagen rasterizada**. Los recortes conservan píxeles y son referencias; no equivalen a componentes de Figma, PSD o capas SVG recuperadas. Los elementos `02_ASSETS` son **interpretaciones vectoriales editables**, no extracción perfecta de los iconos o ilustraciones originales. Antes de producción, validar letras, cifras, etiquetas y comportamientos contra la lógica real del repositorio.

## Instalación recomendada en Windows PowerShell

1. Extrae este ZIP **fuera** del repo primero.
2. Abre `08_PREVIEW/index.html` y revisa imágenes y sistema.
3. Copia solo `06_OPENCODE_COPIAR_AL_REPO/.opencode/agents/` y `.../skills/` dentro del repo; **revisa permisos antes de hacerlo**.
4. Lleva `01_REFERENCIAS`, `02_ASSETS`, `03_SISTEMA_DISENO`, `04_PANTALLAS`, `05_PROMPTS`, `07_QA` al directorio `design-references/mercado-cero/` de tu repo (o ajusta rutas con OpenCode).
5. Abre OpenCode con el repositorio actual como raíz y usa el prompt `05_PROMPTS/00_INICIO_ORQUESTADOR.md`.
6. **No reemplaces** tu `opencode.json`, `.env`, scripts de build, base de datos o configuración de proveedor. Usa `06_OPENCODE_COPIAR_AL_REPO/opencode.config.EJEMPLO.json` solo como referencia opcional.

## Inicio sin complicaciones

Dale al agente primario este mensaje: `Lee design-references/mercado-cero/05_PROMPTS/00_INICIO_ORQUESTADOR.md y síguelo. Primero audita; no modifiques archivos antes del mapa de dependencias, capturas base y plan.`

## Objetivos de producto

- P0: venta registrable sin IA; estado financiero verificable, borradores recuperables, corte sin doble contabilización y accesibilidad básica.
- P1: dashboard, fiados, pendientes, onboarding de práctica, diseño móvil excelente.
- P2: catálogo, proveedores, metas, asistente opcional, ilustraciones elaboradas y animaciones.

## Verificaciones incluidas

`python 07_QA/scripts/verificar_kit.py` revisa existencia de referencias, SVG y enlaces relativos. `python 07_QA/scripts/contraste.py` mide contraste de tokens relevantes. **Esas pruebas comprueban el kit, no la app**.

### Restricciones críticas

Nunca afirmar pago verificado por mostrar QR; nunca inferir dinero depositado a partir de un sobre virtual; nunca mezclar fiado nuevo con abono ni venta nueva con cobro antiguo. Cualquier cambio de cálculo/persistencia bancaria requiere un agente específico, pruebas y aprobación del responsable. Sin credenciales ni datos reales en demos.
