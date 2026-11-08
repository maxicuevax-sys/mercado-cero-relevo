# Identidad de Trangui

**Tu puesto, con menos pendientes.**

El QR artístico suministrado por el responsable del proyecto es el centro de esta identidad: un tianguis visto desde arriba, lonas de colores y fondo de papel. El nombre y el slogan se colocan debajo. Hearth y Alder son las fuentes existentes de Trangui; sus licencias y procedencia siguen en los archivos del proyecto.

## Descargas

| Archivo | Uso | Tamaño |
| --- | --- | --- |
| [Identidad principal](trangui-identidad.png) | Portada del README | 1200 × 1340 |
| [Avatar cuadrado](trangui-avatar.png) | Archivo descargable para perfiles | 1200 × 1200 |
| [Portada horizontal](trangui-social.png) | Compartir el repositorio | 1280 × 640 |
| [QR original](qr-original.png) | Fuente suministrada, sin modificaciones | 1080 × 1920 |
| [Composición editable](identity.html) | Nombre y slogan fuera del QR | HTML |

La cuenta personal de GitHub conserva su avatar. GitHub no ofrece un avatar independiente por repositorio. La portada del README identifica Trangui al abrir esta repo; no cambia la visibilidad ni los permisos del proyecto.

## Integridad y lectura del QR

Se conserva el PNG original byte por byte. SHA-256:

`e9d6461bc41c201648f221fef92ea62f7c4c120ea7e692b5e81e81ce6d4cead7`

Las composiciones principal y cuadrada conservan los 784 × 784 píxeles del área del QR exactamente iguales a los del original. Solo se redistribuye el espacio exterior y se añade texto debajo; no se regenera, recolorea, redibuja ni superpone texto al código. La portada horizontal reduce la imagen proporcionalmente.

ZXing-C++ decodificó el original y los tres PNG finales al mismo destino: `https://xn--hw9h.st/`. Ese destino respondió HTTP 200 y mostró Trangui al comprobarlo el 8 de noviembre de 2026. La lectura por software no garantiza lectura con toda cámara, tamaño o impresión; para escanear usa el original o la versión principal a tamaño suficiente. Este QR abre la aplicación; no acredita pagos.

## Reproducir

Con Python y Playwright instalados, desde la raíz del repositorio:

```powershell
python docs/brand/render.py
```

`identity.html` utiliza directamente el PNG original y las fuentes del proyecto. El proceso exporta una composición HTML con Chromium; no utiliza generación de imágenes para reconstruir el QR. Los materiales suministrados conservan sus derechos y procedencia; esta carpeta no les atribuye una licencia nueva.
