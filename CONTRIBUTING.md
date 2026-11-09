# Colaborar y mantener Trangui

Lee [AGENTS.md](AGENTS.md), [VOZ-TRANGUI.md](VOZ-TRANGUI.md) y [HARNESS.md](HARNESS.md) antes de cambiar código o textos. Para reportar un problema, incluye ruta, pasos, resultado esperado y dispositivo. Usa ejemplos sin datos de clientes ni secretos.

Trabaja en una rama `codex/` por cambio coherente. Adjunta al PR el SHA, las pruebas ejecutadas y sus resultados. Para cambios visuales, añade capturas inspeccionadas en los tamaños afectados. Los contratos y la evidencia exigidos para cada cambio están en HARNESS.md; un resultado de otro SHA requiere una nueva verificación.

## Integración continua

El [workflow harness](.github/workflows/harness.yml) comprueba los PR y los pushes a `main`. También conserva la ejecución diaria y la manual. La rama de trabajo se comprueba mediante su PR; así se evita repetir la misma revisión por `push` y `pull_request`. La [sintaxis de eventos de GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#on) describe estos filtros.

La insignia del README consulta el resultado real de `main`. La validación del despliegue se documenta con su SHA y entorno. La subida de sourcemaps usa el secreto de Sentry exclusivamente en pushes a `main`. El gate completo de release requiere su runner y los secretos del entorno `release`; consulta HARNESS.md antes de ejecutarlo.

## Recuperar una rama del respaldo

El bundle local `all-remote-heads.bundle` del respaldo `20261109` se verificó con 31 referencias antes de la limpieza. Lo acompañan `remote-branches.json` y `bundle-heads.txt`. SHA256 del bundle:

```text
4887D0A61D20B2E0F76DE777D42B514FFDAA6F6107A52EB84FBD6F8045063659
```

Los mantenedores pueden consultar el [borrador de respaldo](https://github.com/maxicuevax-sys/mercado-cero-relevo/releases/tag/untagged-bcc2de1f262e266a108c). Comprueba que el asset del bundle esté disponible antes de descargarlo; los borradores requieren acceso al repositorio. También puedes usar la copia local verificada. Para descargar los archivos disponibles con GitHub CLI:

```sh
gh release download github-backup-20261109-merged-cleanup --repo maxicuevax-sys/mercado-cero-relevo --pattern all-remote-heads.bundle --pattern remote-branches.json --pattern bundle-heads.txt
```

Desde un checkout limpio, verifica el SHA256 descargado y las referencias. En PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 ./all-remote-heads.bundle
git bundle verify ./all-remote-heads.bundle
git bundle list-heads ./all-remote-heads.bundle
```

Elige la referencia exacta de `bundle-heads.txt` y recupérala en una rama nueva. Ejemplo existente en ese respaldo:

```sh
git fetch ./all-remote-heads.bundle refs/remotes/github-audit/codex/desktop-consistency:refs/heads/codex/recuperar-desktop-consistency
git switch codex/recuperar-desktop-consistency
```

Revisa el diff y ejecuta las pruebas del cambio antes de abrir un PR. Recuperar una rama histórica requiere revisar su compatibilidad con la aplicación actual antes de integrarla.
