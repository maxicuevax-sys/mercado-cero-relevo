import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

/**
 * Fraunces se usa solo en su caja normal. No se piden ejes opcionales
 * (`opsz`/SOFT/WONK): el archivo variable latin queda en ~36 KiB y el dibujo
 * es el mismo porque esos ejes conservan su valor por defecto.
 */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Manrope es una fuente variable: un solo woff2 cubre 400–700, los pesos que
 * usa la interfaz. No se descargan pesos adicionales.
 */
const manrope = Manrope({
  variable: "--font-manrope",
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
  colorScheme: "light",
  themeColor: "#f3ece0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-MX"
      suppressHydrationWarning
      className={`${fraunces.variable} ${manrope.variable} h-full antialiased`}
    >
      <head>
        {/* Aplica tamaño de texto y contraste antes del primer paint para que
            el checkout público no refluya después de hidratar. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var r=document.documentElement;var s=localStorage.getItem('mercado-cero:text-size');if(s==='large'||s==='xlarge')r.dataset.textSize=s;if(localStorage.getItem('mercado-cero:contrast')==='high')r.dataset.contrast='high';}catch(e){}})();",
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
