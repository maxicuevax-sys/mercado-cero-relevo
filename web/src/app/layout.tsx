import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mercado Cero · La caja que habla",
  description:
    "Cobra por voz, acepta CoDi, tarjeta y efectivo, y confirma un pago solo cuando el banco lo confirma.",
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
