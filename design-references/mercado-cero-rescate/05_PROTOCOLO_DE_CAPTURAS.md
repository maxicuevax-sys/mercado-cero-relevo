# Protocolo reproducible de screenshot visual

## Nunca comparar vistas diferentes

La captura que motivó este parche compara Inicio con Caja; no tiene valor como prueba de paridad. También compara 1448×1086 con 1440×1000. Ambos son problemas bloqueantes.

## Pasos

1. Localizar ruta de Inicio desde el router real; no adivinar `/` si la app usa otra.
2. Preparar usuario DEMO/fixture seguro y documentar los datos; no escribirlos en producción.
3. Capturar referencia canónica y aplicación a 1448×1086 (o normalizar a mismo tamaño con justificación, nunca por escalado silencioso).
4. Asegurar fonts `document.fonts.ready` en la ejecución del navegador; deshabilitar transiciones para captura.
5. Capturar `fullPage: false` para evaluar exactamente el primer viewport; además una `fullPage: true` para identificar desbordamientos.
6. Guardar un `metadata.json`: ruta, fecha, commit, viewport, DPI, modo demo, estado de fuentes.
7. Registrar comparaciones por región + diffs justificados.

## Esqueleto Playwright (adaptar URL y autenticación al repo)

```ts
import { test, expect } from '@playwright/test';

test('Inicio desktop coincide en estructura con referencia', async ({ page }) => {
  await page.setViewportSize({width: 1448, height: 1086});
  // Configurar previamente el fixture demo con mecanismos del proyecto.
  await page.goto(process.env.MC_HOME_URL ?? 'http://localhost:3100/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', {name: /buen día|mi negocio|resumen/i})).toBeVisible();
  await expect(page.getByRole('link', {name: /^Inicio$/i})).toBeVisible();
  for (const label of ['Ventas hoy','Cobrado hoy','Por cobrar','Meta del mes']) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Nueva venta', {exact: true})).toBeVisible();
  await page.screenshot({path:'artifacts/inicio-1448x1086.png', fullPage:false, animations:'disabled'});
});
```

Esqueleto ilustrativo: NO ejecutar si las rutas o nombres reales difieren; primero mapear DOM/router. La prueba automatizada de imágenes requiere baseline consensuado y datos deterministas.

## Comparación a realizar

- Conteo de KPI cards (4).
- Orden vertical y horizontal de bloques.
- Anchura sidebar (objetivo aprox 236px).
- Existencia y tamaño relativo hero Nueva venta.
- Contraste, foco, etiquetas y textos al 200% de zoom.
- No se exige similitud exacta de números, avatares ni fecha del demo.
