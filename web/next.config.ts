import { spawnSync } from "node:child_process";

import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Identidad del build. El harness exige que el servidor que responde en
 * BASE_URL haya sido construido desde el mismo commit que gitAtStart.
 * `build-gate.mjs` pasa BUILD_SHA; si se corre `next build` a mano, se usa
 * el HEAD actual como respaldo.
 */
function resolveBuildSha(): string {
  const fromEnv = (process.env.BUILD_SHA ?? process.env.NEXT_PUBLIC_BUILD_SHA ?? "").trim();
  if (fromEnv) return fromEnv;
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  const sha = result.status === 0 ? result.stdout.trim() : "";
  return sha || "unknown";
}

const buildSha = resolveBuildSha();

/**
 * CSP conservadora: Next inyecta scripts inline para hidratar, así que
 * `script-src` necesita 'unsafe-inline'. No se usa nonce porque el App Router
 * lo aplica a sus propios scripts y rompería el arranque del cliente.
 * En desarrollo se añade 'unsafe-eval' para el refresh de React.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  ...(isProduction
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : []),
];

/**
 * Los chunks de Next ya llevan hash de contenido; se pueden cachear para
 * siempre. No se cachean HTML ni APIs: el primero cambia entre despliegues y
 * las segundas devuelven datos privados de la caja.
 */
const immutableStaticHeaders = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

/**
 * Assets públicos sin hash (fotos, iconos, audio TTS). Una semana con
 * revalidación en segundo plano evita descargas repetidas sin arriesgar
 * servir una versión vieja durante meses.
 */
const publicAssetHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=604800, stale-while-revalidate=86400",
  },
];

/** Datos de la caja y enlaces de pago: nunca en caché compartida ni del navegador. */
const privateHeaders = [
  {
    key: "Cache-Control",
    value: "private, no-store, max-age=0, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  // `BUILD_SHA` queda disponible en el servidor y `NEXT_PUBLIC_BUILD_SHA`
  // en el cliente. /api/health lo devuelve para que el harness compare el
  // SHA servido con el SHA de git sin adivinar.
  env: {
    BUILD_SHA: buildSha,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
  },
  // gzip de respuestas y assets en `next start`. Si un proxy/túnel comprime
  // por su cuenta, este valor no desactiva esa capa; se verifica con
  // `Accept-Encoding: gzip` y `Content-Encoding` en el contrato de perf.
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Next bufferiza el cuerpo para que el Proxy y la ruta puedan leerlo. Este
    // tope acota esa copia a 64 KB (máximo de las rutas normales) y permite
    // responder 413 al llenarlo, sin esperar a que el cliente termine. No es
    // una defensa "antes de leer": el cuerpo se lee hasta el tope.
    // /api/voice/transcribe queda fuera del matcher del Proxy y lee su
    // multipart por stream con su propio tope de 12 MB.
    proxyClientMaxBodySize: "64kb",
    // Evita que los barrels de iconos y QR entren completos al bundle.
    optimizePackageImports: ["lucide-react", "qrcode"],
  },
  images: {
    // AVIF primero para el menor peso; WebP como respaldo universal.
    formats: ["image/avif", "image/webp"],
    // Solo tamaños que la app puede pedir en un teléfono de 360–430 px.
    deviceSizes: [360, 420, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    qualities: [75],
  },
  // El indicador de desarrollo sale en capturas y en el video de respaldo.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // En dev Next necesita sus propios headers para el hot reload; en
      // producción el valor coincide con el que ya emite Next y lo deja explícito.
      ...(isProduction
        ? [{ source: "/_next/static/:path*", headers: immutableStaticHeaders }]
        : []),
      {
        source: "/icons/:path*",
        headers: publicAssetHeaders,
      },
      {
        source: "/tts/:path*",
        headers: publicAssetHeaders,
      },
      { source: "/favicon.ico", headers: publicAssetHeaders },
      { source: "/puesto-flores.jpg", headers: publicAssetHeaders },
      { source: "/tianguis-metepequense.jpg", headers: publicAssetHeaders },
      { source: "/tianguis-zitacuaro.jpg", headers: publicAssetHeaders },
      // Las rutas de lectura de perf-data negocian su propio Cache-Control
      // privado con ETag/304. Solo los endpoints sensibles o mutadores quedan
      // forzados a no-store; no se pisa la caché de dashboard/orders/credits/
      // analytics/tasks.
      { source: "/api/cash", headers: privateHeaders },
      { source: "/api/cash/:path+", headers: privateHeaders },
      { source: "/api/checkout/:path+", headers: privateHeaders },
      { source: "/api/credits/:path+", headers: privateHeaders },
      { source: "/api/demo/:path+", headers: privateHeaders },
      { source: "/api/goals", headers: privateHeaders },
      { source: "/api/goals/:path+", headers: privateHeaders },
      { source: "/api/orders/:path+", headers: privateHeaders },
      { source: "/api/reconcile", headers: privateHeaders },
      { source: "/api/tasks/:path+", headers: privateHeaders },
      { source: "/api/tts", headers: privateHeaders },
      { source: "/api/verify", headers: privateHeaders },
      { source: "/api/voice/:path+", headers: privateHeaders },
      { source: "/api/webhooks/:path+", headers: privateHeaders },
      {
        source: "/pay/:path*",
        headers: privateHeaders,
      },
      {
        // Shell público de la caja: el navegador revalida, el CDN puede
        // reutilizarlo un minuto. Los datos se piden por API con no-store.
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
