import QRCode from "qrcode";

/**
 * Módulo aislado a propósito: `qrcode` solo se descarga al abrir un cobro QR.
 * Al importarlo dinámicamente desde la caja, Turbopack lo separa del bundle
 * inicial en vez de fusionarlo con `next/image`.
 */
export async function qrDataUrl(value: string): Promise<string> {
  return QRCode.toDataURL(value, {
    width: 640,
    margin: 1,
    color: { dark: "#143D2F", light: "#FFFFFF" },
  });
}
