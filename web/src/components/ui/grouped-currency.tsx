import { Fragment } from "react";
import { currencyGroups } from "./currency-groups";

/** Local reflow for large dashboard totals, preserving the full spoken amount. */
export function GroupedCurrency({ cents, label }: { cents: number; label: string }) {
  const groups = currencyGroups(cents);
  return <output aria-label={`${label}: ${groups.join("")} MXN`} aria-live="off">
    {groups.map((group, index) => <Fragment key={index}>
      {index > 0 ? <wbr /> : null}
      <span data-currency-group="" style={{ whiteSpace: "nowrap", display: "inline-block" }}>{group}</span>
    </Fragment>)}
  </output>;
}
