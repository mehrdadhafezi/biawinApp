import { spacing } from "@biawin/ui";
import { Chip, type ChipAccent } from "./Chip";
import { PURCHASE_METHOD_LABEL } from "./serviceMethod";
import type { PurchaseMethod } from "../../lib/services-api";

export type MethodFilter = "all" | PurchaseMethod;

const FILTER_ORDER: MethodFilter[] = ["all", "credit", "installment", "cash", "free"];
const FILTER_LABEL: Record<MethodFilter, string> = { all: "همه", ...PURCHASE_METHOD_LABEL };

/**
 * Category View's payment-method filter row — the P1 fidelity gap this
 * stage resolves (docs/services-prototype-analysis.md §10/§23#7). The
 * prototype's own 5 chips (همه/اقساطی/اعتباری/تخفیفی/ترکیبی — mined from
 * `#categoryFilters`) include two values, "تخفیفی" and "ترکیبی", that have
 * no representation anywhere in the real `PurchaseMethod` schema
 * (`credit | installment | cash | free`) — building them literally would
 * mean two permanently-empty filter results, a fake affordance, not a
 * fidelity win. This uses the real 4 enum values (plus "همه") instead,
 * with the exact same chip visual/interaction the prototype's row has —
 * preserving the *behavior* (a horizontally-scrollable, single-select
 * filter row) and the *domain model* (real `PurchaseMethod`), per this
 * stage's explicit instruction, without inventing a fake schema.
 */
export function MethodFilterChips({
  value,
  onChange,
  accent,
}: {
  value: MethodFilter;
  onChange: (value: MethodFilter) => void;
  accent?: ChipAccent;
}) {
  return (
    // SERVICES-R2: row padding + hidden scrollbar mined from the real
    // `.category-filter-row` (`padding:12px 0 3px;scrollbar-width:none`
    // + a WebKit `::-webkit-scrollbar{display:none}` — inline styles
    // can't express the WebKit pseudo-element, so this keeps the native
    // (visible) scrollbar there; a real, minor, documented gap).
    <div
      style={{
        display: "flex",
        gap: spacing.sm,
        overflowX: "auto",
        padding: "12px 0 3px",
        scrollbarWidth: "none",
      }}
    >
      {FILTER_ORDER.map((filter) => (
        <Chip key={filter} label={FILTER_LABEL[filter]} active={value === filter} onClick={() => onChange(filter)} accent={accent} />
      ))}
    </div>
  );
}

export function matchesMethodFilter(availableMethods: PurchaseMethod[], filter: MethodFilter): boolean {
  if (filter === "all") return true;
  return availableMethods.includes(filter);
}
