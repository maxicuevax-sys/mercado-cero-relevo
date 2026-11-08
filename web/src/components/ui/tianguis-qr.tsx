"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { tianguisQrDataUrl } from "@/lib/tianguis-qr";

export function TianguisQr({ original, payload, decodeOriginal = false, alt, width, height, style }: {
  original: string;
  payload?: string | null;
  decodeOriginal?: boolean;
  alt: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
}) {
  const [art, setArt] = useState<{ original: string; payload?: string | null; src: string } | null>(null);
  const [canonical, setCanonical] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    async function prepare() {
      try {
        if (!payload && !decodeOriginal) return;
        // Demo images encode a payment URL, not their bookkeeping qrString JSON.
        // Decode the actual original whenever its precise payload is unavailable.
        const value = payload ?? (await new (await import("@zxing/browser")).BrowserQRCodeReader().decodeFromImageUrl(original)).getText();
        const src = tianguisQrDataUrl(value);
        if (active) setArt({ original, payload, src });
      } catch {
        // Provider images and unrecognized formats remain usable unchanged.
      }
    }
    void prepare();
    return () => { active = false; };
  }, [original, payload, decodeOriginal]);
  const available = (payload || decodeOriginal) && art?.original === original && art.payload === payload ? art.src : null;
  const showOriginal = canonical === original;
  return <>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={!showOriginal && available ? available : original} alt={alt} width={width} height={height} style={style} onError={() => setCanonical(original)} />
    {available ? <button type="button" aria-pressed={showOriginal} onClick={() => setCanonical(showOriginal ? null : original)} style={{ display: "block", margin: "8px auto", minHeight: 44, padding: "8px 14px", border: "1px solid currentColor", borderRadius: 8, background: "#fffdf6", color: "#064b3c", font: "inherit", cursor: "pointer" }}>{showOriginal ? "QR tianguis" : "QR original"}</button> : null}
  </>;
}
