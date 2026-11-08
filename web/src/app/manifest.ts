import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trangui · Tu puesto, con menos pendientes",
    short_name: "Trangui",
    description:
      "Lleva ventas, fiados y caja. Explora QR y CoDi en modo demo, sin mover dinero real.",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f9f6ee",
    theme_color: "#0f3d36",
    lang: "es-MX",
    dir: "ltr",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        src: "/icons/trangui-192-v1.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/trangui-512-v1.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/trangui-maskable-512-v1.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

