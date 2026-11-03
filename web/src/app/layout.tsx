import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Fraunces } from "next/font/google";
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
 * Atkinson Hyperlegible para toda la interfaz: letras abiertas y distinguibles
 * para leer precios, nombres y renglones de un vistazo.
 */
const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
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
      className={`${fraunces.variable} ${atkinson.variable} h-full antialiased`}
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
