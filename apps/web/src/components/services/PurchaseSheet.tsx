"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet, Button, Toast, color, spacing, typography } from "@biawin/ui";
import type { CardProductDto } from "../../lib/services-api";
import { ordersApi } from "../../lib/orders-api";
import { ApiError } from "../../lib/api-client";
import { formatCardProductPrice, formatCardProductValue } from "./cardProductPresentation";
import { trackEvent } from "../../lib/analytics";

export interface PurchaseSheetProps {
  open: boolean;
  onClose: () => void;
  cardProduct: CardProductDto;
}

/**
 * SERVICES-R5.26 — the real Purchase Flow confirmation step, replacing
 * `DisabledCardPurchaseCTA` for any CardProduct that is genuinely
 * purchasable (`journeyType === 'PURCHASE'` and a positive price resolves
 * — see `CardProductDetailPage`'s own gating). Visually the prototype's
 * `#purchaseSheet` (`docs/services-prototype-analysis.md` — "MODAL bottom
 * sheet... close/cancel/backdrop tap all equivalent"), rendered via
 * `packages/ui`'s existing `BottomSheet` (its own doc comment already
 * names this exact use case; unused anywhere in the app until now).
 * Unlike the prototype's own `#purchaseConfirm` — a dead end that closed
 * the sheet and showed a toast, creating nothing — this calls the real,
 * already-built `POST /orders` (R5.19) and hands the customer off to a
 * real, persisted `/purchase/[orderId]` "ready for payment" page (R5.27's
 * clean starting point).
 *
 * `idempotencyKey` is generated exactly ONCE per sheet-open (in `useState`
 * initializer, not regenerated on re-render) — a rapid double-tap of the
 * confirm button reuses the SAME key, so even if the button's own
 * `disabled={submitting}` guard were somehow bypassed, the backend's
 * idempotency contract (R5.1/R5.19, re-verified unchanged this stage)
 * guarantees only one real Order is ever created.
 */
export function PurchaseSheet({ open, onClose, cardProduct }: PurchaseSheetProps) {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleClose() {
    if (submitting) return; // never let a backdrop/cancel tap abandon an in-flight request's UI state
    setErrorMessage(null);
    onClose();
  }

  async function handleConfirm() {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const order = await ordersApi.createCardProductOrder(cardProduct.id, idempotencyKey);
      trackEvent({
        name: "OrderCreated",
        orderId: order.id,
        cardProductId: cardProduct.id,
        serviceId: order.serviceId,
        amount: order.amount,
      });
      onClose();
      router.push(`/purchase/${order.id}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "خطای غیرمنتظره‌ای رخ داد. دوباره تلاش کنید.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <BottomSheet open={open} onClose={handleClose}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <strong style={{ ...typography.h3, color: color.deep }}>تأیید خرید</strong>
          <span style={{ ...typography.body, color: color.ink }}>{cardProduct.title}</span>

          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md, padding: spacing.sm, background: color.ice, borderRadius: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ ...typography.caption, color: color.muted }}>مبلغ پرداختی</span>
              <strong style={{ ...typography.h3, color: color.deep }}>{formatCardProductPrice(cardProduct)}</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ ...typography.caption, color: color.muted }}>ارزش کارت</span>
              <strong style={{ ...typography.body, fontWeight: 700, color: color.primary }}>{formatCardProductValue(cardProduct)}</strong>
            </div>
          </div>

          <div style={{ display: "flex", gap: spacing.sm }}>
            <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting} style={{ flex: 1 }}>
              انصراف
            </Button>
            <Button
              type="button"
              onClick={() => {
                trackEvent({
                  name: "PurchaseCTAClicked",
                  context: "cardProduct",
                  id: cardProduct.id,
                });
                void handleConfirm();
              }}
              disabled={submitting}
              style={{ flex: 2 }}
            >
              {submitting ? "در حال ایجاد سفارش..." : "تأیید و ادامه پرداخت"}
            </Button>
          </div>
        </div>
      </BottomSheet>

      <Toast message={errorMessage ?? ""} open={Boolean(errorMessage)} tone="error" />
    </>
  );
}
