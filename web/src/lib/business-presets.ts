import type { BusinessType } from "./business-profile";

/** Suggestions only: never insert a ticket line or change a price automatically. */
export const BUSINESS_PRESETS: Record<BusinessType, {
  example: string;
  suggestions: readonly { label: string; text: string; image?: string }[];
}> = {
  produce: {
    example: "Ej. 1 kilo de jitomate a 30 pesos",
    suggestions: [
      { label: "Manzana", text: "1 kilo de manzana a 30 pesos", image: "manzana" },
      { label: "Jitomate", text: "1 kilo de jitomate a 25 pesos", image: "jitomate" },
      { label: "Verdura", text: "2 zanahorias a 5 pesos" },
    ],
  },
  food: {
    example: "Ej. 3 tacos a 15 pesos",
    suggestions: [
      { label: "Tacos", text: "3 tacos a 15 pesos" },
      { label: "Agua", text: "2 vasos de agua a 20 pesos" },
      { label: "Antojitos", text: "2 quesadillas a 25 pesos" },
    ],
  },
  goods: {
    example: "Ej. 2 playeras a 100 pesos",
    suggestions: [
      { label: "Playera", text: "2 playeras a 100 pesos" },
      { label: "Calzado", text: "1 par de tenis a 200 pesos" },
      { label: "Bolsa", text: "1 bolsa a 50 pesos" },
    ],
  },
  general: {
    example: "Ej. 2 productos a 25 pesos",
    suggestions: [
      { label: "Producto", text: "2 productos a 25 pesos" },
      { label: "Servicio", text: "1 servicio a 50 pesos" },
      { label: "Artículo", text: "1 artículo a 30 pesos" },
    ],
  },
};
