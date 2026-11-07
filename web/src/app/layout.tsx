import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./barrio.css";

/**
 * Hearth: marca, saludos y encabezados editoriales.
 * Archivo variable del proyecto fontzz, OFL 1.1.
 */
const hearth = localFont({
  src: "../assets/fonts/Hearth-Variable.woff2",
  variable: "--font-hearth",
  weight: "100 900",
  display: "swap",
  preload: true,
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: "Times New Roman",
});

/**
 * Alder: toda la interfaz operativa, importes y estados.
 * Archivo variable del proyecto fontzz, OFL 1.1.
 */
const alder = localFont({
  src: "../assets/fonts/Alder-Variable.woff2",
  variable: "--font-alder",
  weight: "100 900",
  display: "swap",
  preload: true,
  fallback: ["Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: "Arial",
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
      className={`${hearth.variable} ${alder.variable} h-full antialiased`}
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
