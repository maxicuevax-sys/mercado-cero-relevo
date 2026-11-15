# Rotación de llaves de pey

Procedimiento para cambiar `PEY_API_KEY` y `PEY_WEBHOOK_SECRET` sin exponerlas.

**Cuándo:** si una llave o el secreto aparecieron en un chat, un log, una captura o un
repositorio. También de forma preventiva al cerrar el hackatón.

## 1. Rotar en el portal de pey

1. Entra al portal de desarrolladores de pey (no lo hago por ti: requiere tu sesión).
2. En **API keys**, revoca la llave expuesta y crea una nueva.
   - Anota el `apiKeyId` y la llave nueva (`sk_live_…`). No la pegues en ningún chat.
3. En **Webhooks**, rota el secreto de firma y actualiza la URL si hace falta:
   - URL: `https://xn--hw9h.st/api/webhooks/pey`
   - Eventos: `codi.qr.payment_received`, `codi.pn.payment_received`,
     `payment_link.status_updated`.

## 2. Cargar las llaves nuevas en el servidor

Sin escribirlas en la línea de comandos ni en el historial:

```bash
# En tu máquina, con un archivo temporal 0600:
cat > /tmp/pey-rotate.json <<'JSON'
{"PEY_API_KEY":"sk_live_…","PEY_WEBHOOK_SECRET":"whsec_…"}
JSON
chmod 600 /tmp/pey-rotate.json
scp -o BatchMode=yes /tmp/pey-rotate.json zicua-vps:/tmp/pey-rotate.json
rm /tmp/pey-rotate.json
ssh -o BatchMode=yes zicua-vps 'chmod 600 /tmp/pey-rotate.json && python3 /tmp/rotate_pey_env.py'
```

El script `rotate_pey_env.py` (en `prod-deploy/`) respalda `compose.json`, cambia solo las dos
variables, recrea el contenedor con la misma imagen, espera el health y borra el archivo
temporal. Nunca imprime los valores.

## 3. Verificar después de rotar

```bash
# 1) El contenedor está sano y en el commit esperado
curl -s https://xn--hw9h.st/api/health

# 2) Sin firma: 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' \
  -d '{}' https://xn--hw9h.st/api/webhooks/pey

# 3) Con firma del secreto nuevo: la verificación pasa (404/422 por pedido inexistente,
#    nunca 401). Usa el script validate_pey_secret.py con el secreto nuevo en un JSON 0600.
```

Si el paso 2 no da 401 o el 3 da 401, la llave no quedó cargada: revisa
`docker logs trangui-public-emoji` y vuelve al respaldo
`/opt/mercado-cero/public-emoji/rollback-pey-rotate-<fecha>/compose.json`.

## 4. Después de rotar

- Redeploy no necesario: las llaves viven en el entorno, no en la imagen.
- Borra cualquier copia temporal en `/tmp`.
- Si la llave expuesta se usó para cobros, revisa `payments` y `payment_events` en la base.
- Registra la fecha de rotación en el canal del equipo, no la llave.

## Qué NO hacer

- No pegar llaves en GitHub, en issues, en mensajes de chat ni en capturas.
- No subir `.env` ni `compose.json` a un repositorio público.
- No cambiar la URL del webhook sin volver a validar la firma.
