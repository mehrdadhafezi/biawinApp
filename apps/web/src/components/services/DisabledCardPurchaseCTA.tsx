import { Button, spacing } from "@biawin/ui";
import { ComingSoonCaption } from "../common/ComingSoonCaption";

/**
 * SERVICES-R5.18 — the CardProduct-level analog of `DisabledPurchaseCTA`:
 * a real `disabled` button + visible "به‌زودی" caption, same established
 * pattern (Stage 4.2 QA finding), never a button that looks tappable and
 * silently does nothing. This is the ONE real purchase-adjacent CTA this
 * stage renders anywhere — per this stage's explicit domain rule, a
 * Service is never purchased, only a CardProduct is, so this lives on the
 * Card Product Detail page, not the Service Detail page. Purchase
 * execution (Order → payment → CustomerCardInstance issuance) remains
 * exactly as out of scope as R5.1/R5.16 already established.
 */
export function DisabledCardPurchaseCTA() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: spacing.xs }}>
      <Button type="button" disabled aria-label="خرید کارت — به‌زودی" style={{ width: "100%" }}>
        خرید کارت
      </Button>
      <ComingSoonCaption />
    </div>
  );
}
