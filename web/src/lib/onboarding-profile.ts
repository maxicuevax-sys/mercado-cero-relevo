/**
 * Perfil local del onboarding.
 *
 * Vive solo en el navegador: no crea cuentas, no toca la base de datos y no
 * registra dinero. La venta de ejemplo se guarda como `kind: "onboarding-demo"`
 * y nunca se envía a /api/orders ni al checkout.
 */

export const ONBOARDING_STORAGE_KEY = "mercado-cero:onboarding:v1";

export type OnboardingSampleSale = {
  id: string;
  description: string;
  quantity: number;
  unitCents: number;
  totalCents: number;
  kind: "onboarding-demo";
  demo: true;
  createdAt: string;
};

export type OnboardingProfile = {
  version: 1;
  name: string;
  giro: string;
  sampleSale: OnboardingSampleSale | null;
  completedAt: string | null;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseProfile(raw: string): OnboardingProfile | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;

    const name = typeof value.name === "string" ? value.name : "";
    const giro = typeof value.giro === "string" ? value.giro : "";
    const completedAt =
      typeof value.completedAt === "string" ? value.completedAt : null;
    const updatedAt =
      typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString();

    let sampleSale: OnboardingSampleSale | null = null;
    if (isRecord(value.sampleSale)) {
      const sale = value.sampleSale;
      if (
        typeof sale.id === "string" &&
        typeof sale.description === "string" &&
        typeof sale.quantity === "number" &&
        typeof sale.unitCents === "number" &&
        typeof sale.totalCents === "number" &&
        typeof sale.createdAt === "string" &&
        sale.kind === "onboarding-demo"
      ) {
        sampleSale = {
          id: sale.id,
          description: sale.description,
          quantity: sale.quantity,
          unitCents: sale.unitCents,
          totalCents: sale.totalCents,
          kind: "onboarding-demo",
          demo: true,
          createdAt: sale.createdAt,
        };
      }
    }

    return {
      version: 1,
      name: name.slice(0, 80),
      giro: giro.slice(0, 80),
      sampleSale,
      completedAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function readOnboardingProfile(): OnboardingProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return raw ? parseProfile(raw) : null;
  } catch {
    return null;
  }
}

export function saveOnboardingProfile(
  patch: Partial<Omit<OnboardingProfile, "version" | "updatedAt">>,
): OnboardingProfile {
  const now = new Date().toISOString();
  const previous = readOnboardingProfile();
  const next: OnboardingProfile = {
    version: 1,
    name: patch.name ?? previous?.name ?? "",
    giro: patch.giro ?? previous?.giro ?? "",
    sampleSale:
      patch.sampleSale !== undefined ? patch.sampleSale : (previous?.sampleSale ?? null),
    completedAt:
      patch.completedAt !== undefined ? patch.completedAt : (previous?.completedAt ?? null),
    updatedAt: now,
  };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Modo privado o almacenamiento lleno: el recorrido sigue funcionando en
      // memoria; simplemente no sobrevive a la recarga.
    }
  }

  return next;
}
