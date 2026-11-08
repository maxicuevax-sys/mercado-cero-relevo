import { withPilotPage } from "../../../../lib/auth/pilot-page";
import type { Metadata } from "next";
import { connection } from "next/server";
import { AppShell } from "@/components/shell/app-shell";
import { TopBar } from "@/components/shell/top-bar";
import {
  operationalFoot,
  operationalMobileMore,
  operationalNav,
} from "@/components/shell/nav";
import { AbonoEmpty } from "@/components/fiados/abono/abono-empty";
import { AbonoScreen } from "@/components/fiados/abono/abono-screen";
import { firstName, nameSlug, normalizeName } from "@/components/fiados/abono/flow-utils";
import { MERCHANT, isDemoMode } from "@/lib/config";
import { getCredit, listCredits } from "@/lib/db";

export const metadata: Metadata = {
  title: "Registrar abono · Trangui",
};

// El saldo vivo no se puede servir desde un snapshot de build.
export const instant = false;

async function AbonoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ credito?: string }>;
}) {
  await connection();
  const [{ slug: paramSlug }, query] = await Promise.all([params, searchParams]);
  const slug = paramSlug ?? "juan";
  const demo = isDemoMode();
  const initial = MERCHANT.owner.charAt(0).toUpperCase();
  const desired = normalizeName(slug);

  const openCredits = listCredits().filter(
    (credit) => credit.status !== "settled" && credit.balanceCents > 0,
  );
  const preferred = query.credito ? getCredit(query.credito) : null;
  const credit =
    (preferred && preferred.balanceCents > 0 ? preferred : null) ??
    openCredits.find((item) => nameSlug(firstName(item.customerName ?? "")) === nameSlug(slug)) ??
    openCredits.find((item) => normalizeName(item.customerName ?? "").includes(desired)) ??
    openCredits[0] ??
    null;

  if (!credit) {
    return (
      <AppShell
        activeHref="/fiados"
        mainId="abono-main"
        contentClassName="mc-abono-main"
        focusTargetId="abono-main"
        nav={operationalNav}
        foot={operationalFoot}
        mobileMoreItems={operationalMobileMore}
        topbar={
          <TopBar
            merchant={MERCHANT.name}
            address={MERCHANT.address}
            initial={initial}
            demo={demo}
          />
        }
      >
        <AbonoEmpty
          initial={initial}
          name={firstName(slug) || "este cliente"}
          backHref="/fiados"
        />
      </AppShell>
    );
  }

  const name = credit.customerName ?? "Cliente";
  const customerSlug = nameSlug(firstName(name)) || nameSlug(slug);
  const backHref = `/fiados/${customerSlug}`;
  // En demo la lámina arranca con un abono sugerido (tope $200); en real el
  // campo empieza vacío para no inducir un cobro.
  const prefillCents = demo ? Math.min(20_000, credit.balanceCents) : 0;

  return (
    <AppShell
      activeHref="/fiados"
      mainId="abono-main"
      contentClassName="mc-abono-main"
      focusTargetId="abono-main"
      nav={operationalNav}
      foot={operationalFoot}
      mobileMoreItems={operationalMobileMore}
      topbar={
        <TopBar
          merchant={MERCHANT.name}
          address={MERCHANT.address}
          initial={initial}
          demo={demo}
        />
      }
    >
      <AbonoScreen
        credit={{
          id: credit.id,
          name,
          balanceCents: credit.balanceCents,
          originalCents: credit.originalCents,
        }}
        initial={initial}
        backHref={backHref}
        prefillCents={prefillCents}
      />
    </AppShell>
  );
}

export default withPilotPage(AbonoPage);
