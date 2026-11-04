import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import "./barrio.css";

/**
 * Fraunces en un solo peso de título: el archivo latin queda pequeño y el
 * contraste de escala lo da el tamaño, no una colección de pesos.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

/**
 * Inter variable para toda la interfaz: la dirección del kit pide una UI
 * funcional y compacta, con cifras tabulares y buena lectura en móvil.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mercado Cero · La caja que habla",
  description:
    "Cobra por voz, acepta CoDi, tarjeta y efectivo, y confirma un pago solo cuando el banco lo confirma.",
  applicationName: "Mercado Cero",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
    date: false,
  },
  appleWebApp: {
    capable: true,
    title: "Mercado Cero",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: "#0F3D36",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica tamaño de texto y contraste antes del primer paint para que
            el checkout público no refluya después de hidratar. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var r=document.documentElement;var s=localStorage.getItem('mercado-cero:text-size');if(s==='large'||s==='xlarge')r.dataset.textSize=s;var mq=window.matchMedia&&window.matchMedia('(forced-colors: active)');function fc(){if(!mq)return;if(mq.matches&&location.pathname==='/inicio'){r.dataset.contrast='high';r.dataset.forcedContrast='1';}else if(r.dataset.forcedContrast==='1'){delete r.dataset.forcedContrast;if(localStorage.getItem('mercado-cero:contrast')!=='high')delete r.dataset.contrast;}}if(localStorage.getItem('mercado-cero:contrast')==='high')r.dataset.contrast='high';if(mq){if(mq.addEventListener)mq.addEventListener('change',fc);else if(mq.addListener)mq.addListener(fc);fc();}}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
