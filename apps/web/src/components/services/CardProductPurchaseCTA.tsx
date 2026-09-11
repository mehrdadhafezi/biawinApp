"use client";

import { useState } from "react";
import { Button, spacing } from "@biawin/ui";
import type { CardProductDto } from "../../lib/services-api";
import { DisabledCardPurchaseCTA } from "./DisabledCardPurchaseCTA";
import { isCardProductPurchasable } from "./cardProductPresentation";
import { PurchaseSheet } from "./PurchaseSheet";

export interface CardProductPurchaseCTAProps {
  cardProduct: CardProductDto;
}

/**
 * SERVICES-R5.26 — real Purchase Flow entry point, gated by the exact same
 * eligibility rule `OrdersService.create()` enforces server-side
 * (`journeyType === 'PURCHASE'` and a positive `priceAmount` actually
 * resolves): only then is a real, enabled CTA shown — otherwise
 * `DisabledCardPurchaseCTA` stays exactly as it was (R5.18–R5.25), a real
 * `disabled` button, never a fake-looking one. This client-side check is a
 * UX decision only (which CTA to render) — the server independently
 * re-validates everything regardless, so this can never be the actual
 * security boundary and isn't trusted as one.
 *
 * The other `JourneyType` values (`CREDIT_REQUEST`/`LEAD`/
 * `EXTERNAL_REDIRECT`/`QUOTE_REQUEST`/`FREE_SERVICE`) each represent a
 * genuinely different future flow this stage does not build — they
 * correctly keep the disabled CTA rather than being force-fit into the
 * purchase flow.
 */
export function CardProductPurchaseCTA({ cardProduct }: CardProductPurchaseCTAProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!isCardProductPurchasable(cardProduct)) {
    return <DisabledCardPurchaseCTA />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
      <Button type="button" onClick={() => setSheetOpen(true)} style={{ width: "100%" }}>
        خرید کارت
      </Button>
      <PurchaseSheet open={sheetOpen} onClose={() => setSheetOpen(false)} cardProduct={cardProduct} />
    </div>
  );
}
