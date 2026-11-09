# Reflow de texto ampliado: Fiados, Corte y Metas

Base `6e3b4dc`, rama `codex/trangui-accessibility-200`, copia aislada. Sin push ni despliegue.

## Cambio

A 320px con raíz32px (200% emulado), el encabezado de Fiados pasa a dos filas y el importe obtiene una fila completa. Corte permite envolver su título y redistribuye ilustración, total y resumen. Metas redistribuye su resumen. Consultas de contenedor relativas al texto preservan la fuente del usuario.

`GroupedCurrency` se usa exclusivamente en los tres totales: conserva `formatMxn`, símbolo, todos los grupos de miles y dos centavos. Inserta `wbr` entre grupos, cada grupo es indivisible y el último incluye los centavos. Un importe arbitrariamente largo puede ocupar varias filas sin truncar ni reducir fuente. Su nombre accesible conserva el importe completo en MXN. El componente global `CurrencyAmount` y los cálculos contables permanecen intactos.

La versión previa sin agrupación sólo probaba una unidad de $100,000.00. Ese importe no es el máximo saldo: una orden válida admite10unidades por ese precio ($1m), y los agregados pueden superar cualquier orden individual. Se reemplazó esa estrategia; las capturas anteriores de6eef no certifican el nuevo componente.

## Pruebas y límites

- `node --no-warnings --test scripts/currency-groups.test.mjs`: test de grupos pasó de módulo ausente (rojo) a verde;2tests comprueban $1,000,050.00 y $1,234,567,890,123.45, dos decimales, separadores íntegros, renderReact con saltos explícitos y nombre accesible. No constituyen evidencia geométrica del navegador.
- TypeScript focal ejecutado sin errores tras el helper. El gate estático final se registra separadamente en `harness/evidence/latest-static.json`; el resultado previo6eef no sustituye al final.
- Las24capturas previas demostraron normal320/390/1448 y200% para importes hasta100k, con seis auditorías axe sin violaciones. La prueba real1m y el nuevo render agrupado deben validarse en el canary final por el coordinador; no se afirma un rojo/verde1m local no obtenido.
- El intento de iniciar Next local4688 fue rechazado por revisión automática con `blocked by policy`, sin motivo adicional. No se repitió el lanzamiento mediante otro agente.

## QA final coordinado

`BASE_URL=http://127.0.0.1:4599 python scripts/a11y-200-reflow.py --phase after --guest-canary --require-clean`

El modo `--guest-canary` permite únicamente loopback4599. Cada contexto tiene su propio invitado y perfil general, sin exportar cookies ni invocar `/api/demo/reset`. Los casos normales usan semilla propia; los ampliados crean una orden real de10×10,000,000centavos con crédito100,000,000centavos. El contrato admite salto entre grupos y verifica cifra/cents/aria íntegros y límites horizontales. El modo local4688 permanece restringido a demo exclusiva y sí reinicia su propia base. No ejecutar el modo local en un canary compartido.

WebKit no es Safari físico. El control de la app «Muy grande» sigue125%; raíz32px es una emulación independiente de200%. Este parche no certifica toda la app ni producción. Reversión: revertir este commit.
