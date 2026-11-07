# Plantillas para adaptar al repo REAL

Estos archivos son ejemplos `@playwright/test`, **no están conectados a una app aquí**. Ajustar rutas, `data-testid`, scripts y dependencias después del inventario. No instalar ciegamente paquetes sobre el proyecto. Para axe, usar el adaptador oficial de `@axe-core/playwright` que corresponda a versión de Playwright.

```powershell
# SOLO SI Playwright existe en el proyecto y las rutas están adaptadas:
npx playwright test --project=chromium
```

La prueba de screenshot puede ser sensible a fuentes de red: preferir fuentes autocontenidas en producción y fijar animación reducida.
