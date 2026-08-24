import { Button, spacing } from "@biawin/ui";
import { ComingSoonCaption } from "../common/ComingSoonCaption";

/**
 * Real `disabled` button + visible "به‌زودی" caption — the established
 * pattern (Stage 4.2 QA finding, reused by every module since) for a
 * feature that isn't wired up rather than a button that looks tappable
 * and silently does nothing. Purchase is explicitly out of scope for
 * this stage (docs/services-ui-contract.md's Tier 2/3 finding: `POST
 * /orders` doesn't actually debit a wallet/credit line or create an
 * installment yet, so a live buy button here would be a fake flow).
 */
export function DisabledPurchaseCTA() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: spacing.xs }}>
      <Button type="button" disabled aria-label="خرید — به‌زودی" style={{ width: "100%" }}>
        خرید این خدمت
      </Button>
      <ComingSoonCaption />
    </div>
  );
}
