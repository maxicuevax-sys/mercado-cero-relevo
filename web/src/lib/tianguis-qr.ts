import QRCode from "qrcode";

/** Decoration never changes a module's light/dark value or the encoded payload. */
export function tianguisQrSvg(payload: string): string {
  const { modules } = QRCode.create(payload, { errorCorrectionLevel: "H" });
  // The smallest current QR surface is 180px. Dense bank payloads keep their
  // original image rather than squeezing decorated modules below three pixels.
  if (modules.size + 8 > 180 / 3) throw new RangeError("QR too dense for decorated presentation");
  const unit = 12;
  const quiet = 4;
  const side = (modules.size + quiet * 2) * unit;
  const colors = ["#064b3c", "#153f76", "#852b32", "#67501c", "#185841"];
  const cells: string[] = [];
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) continue;
      const x = (col + quiet) * unit;
      const y = (row + quiet) * unit;
      if (modules.isReserved(row, col)) {
        cells.push(`<rect x="${x}" y="${y}" width="12" height="12" fill="#003e26"/>`);
        continue;
      }
      const color = colors[(row * 7 + col * 11) % colors.length];
      // Roof panels remain entirely dark; folds are clipped to their own cell.
      cells.push(`<svg x="${x}" y="${y}" width="12" height="12" viewBox="0 0 12 12" overflow="hidden"><rect width="12" height="12" fill="${color}"/><path d="M0 0 6 5 12 0V12L6 5 0 12Z" fill="#000" opacity=".16"/><path d="M0 0 6 5 12 0M0 12 6 5 12 12M6 5 6 12" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width=".65"/></svg>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}"><rect width="${side}" height="${side}" fill="#fffdf6"/>${cells.join("")}</svg>`;
}

export function tianguisQrDataUrl(payload: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(tianguisQrSvg(payload))}`;
}
