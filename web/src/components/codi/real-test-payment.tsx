"use client";

import { useEffect, useState } from "react";

import { FlaskConical } from "lucide-react";

import "./real-test-payment.css";
import { TianguisQr } from "@/components/ui/tianguis-qr";

type Payment = { status: string; paidConfirmed: boolean; qrString: string | null };

export function RealTestPayment() {

  const [enabled, setEnabled] = useState(false);

  const [payment, setPayment] = useState<Payment | null>(null);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [qr, setQr] = useState<{ payload: string; url: string } | null>(null);

  async function refresh() {

    const response = await fetch("/api/real-test/payment", { cache: "no-store" });

    setEnabled(response.ok);

    if (response.ok) setPayment((await response.json()).payment);

  }

  useEffect(() => {

    let active = true;

    void fetch("/api/real-test/payment", { cache: "no-store" }).then(async response => {

      const data = response.ok ? await response.json() : null;

      if (active) { setEnabled(response.ok); if (data) setPayment(data.payment); }

    }).catch(() => { if (active) setEnabled(false); });

    return () => { active = false; };

  }, []);

  useEffect(() => {

    let active = true;

    if (payment?.qrString) void import("qrcode").then(module => module.default.toDataURL(payment.qrString!, { errorCorrectionLevel: "M", margin: 4, width: 360 })).then(value => { if (active) setQr({ payload: payment.qrString!, url: value }); }).catch(() => setError("No se pudo mostrar el QR. No generes otro."));

    return () => { active = false; };

  }, [payment?.qrString]);

  async function create() {

    setBusy(true); setError("");

    try {

      const response = await fetch("/api/real-test/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });

      if (!response.ok) { setError("No se pudo confirmar la generación. No repitas la prueba."); await refresh(); return; }

      setPayment((await response.json()).payment);

    } catch { setError("No se pudo confirmar la generación. No repitas la prueba."); }

    finally { setBusy(false); }

  }

  return <section className="tr-real-test" aria-label="Prueba bancaria real">

    {enabled && <p className="tr-real-test__note">Dinero real al banco de pruebas de Pey; no llega a tu negocio.</p>}

    <button type="button" aria-label="Prueba real de un centavo" title={!enabled ? "Esta prueba todavía no está habilitada" : "Prueba bancaria real de un centavo"} disabled={!enabled || busy || !!payment} onClick={() => void create()}><FlaskConical size={18} aria-hidden="true" /> $0.01</button>

    {!enabled && <span className="sr-only">Esta prueba todavía no está habilitada</span>}

    {error && <p role="alert">{error}</p>}

    {payment && <div aria-live="polite"><p>{payment.paidConfirmed ? "Pago real confirmado por Pey" : payment.status === "unknown" ? "Resultado incierto. No generes otro cobro." : "Esperando confirmación de Pey"}</p>

      {/* QR is generated locally from the exact provider payload. */}

      {/* eslint-disable-next-line @next/next/no-img-element */}

      {qr?.payload === payment.qrString && <TianguisQr original={qr.url} payload={payment.qrString} alt="QR para pagar un centavo real al banco de pruebas de Pey" width={280} height={280} />}

      <button type="button" disabled={busy} onClick={() => void refresh().catch(() => setError("No se pudo consultar el estado."))}>Consultar estado</button>

    </div>}

  </section>;

}

