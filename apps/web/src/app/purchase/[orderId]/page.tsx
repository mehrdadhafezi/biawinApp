"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, color, spacing, typography } from "@biawin/ui";
import { AppShell } from "../../../components/shell/AppShell";
import { SkeletonBlock, SkeletonStyles } from "../../../components/common/SkeletonBlock";
import { ServicesErrorState } from "../../../components/services/ServicesStates";
import { ordersApi, type OrderDto } from "../../../lib/orders-api";
import { formatToman } from "../../../lib/format";
import { ApiError } from "../../../lib/api-client";

const STATUS_LABEL: Record<OrderDto["status"], string> = {
  pending: "در انتظار پرداخت",
  processing: "در حال پردازش",
  awaiting_payment: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
};

/**
 * SERVICES-R5.26 — the Purchase Flow's persisted handoff state:
 * `PurchaseSheet.tsx` routes here immediately after `POST /orders`
 * succeeds. Read-only (`GET /orders/:id`, already built R5.1/R5.19,
 * ownership-scoped to the authenticated user — a real order belonging to
 * someone else 404s here exactly like every other "not found" state in
 * this app, never leaks). This stage creates the Order and stops here —
 * "سفارش شما ایجاد شد و آماده پرداخت است" is the honest, real state; no
 * gateway is called, no payment is executed, and the Order's real
 * `status` is displayed verbatim (always `pending` for anything this
 * stage itself creates) rather than a fabricated "paid"/"processing"
 * label. The real, persisted `orderId` in the URL is the clean starting
 * point R5.27 (Payment/Gateway) needs — refreshable, shareable, not an
 * ephemeral in-memory sheet state that vanishes on reload.
 */
export default function PurchaseResultPage() {
  const params = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<OrderDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    ordersApi
      .getOrder(params.orderId)
      .then((data) => {
        if (!cancelled) setOrder(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات سفارش.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.orderId]);

  return (
    <AppShell activeNavKey="services">
      <SkeletonStyles />
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        {error && <ServicesErrorState message={error} />}

        {!error && notFound && <ServicesErrorState message="این سفارش یافت نشد." />}

        {!error && !notFound && !order && (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <SkeletonBlock height={160} />
          </div>
        )}

        {!error && !notFound && order && (
          <Card style={{ display: "flex", flexDirection: "column", gap: spacing.md, alignItems: "center", textAlign: "center" }}>
            <span style={{ fontSize: 40 }} aria-hidden="true">
              ✅
            </span>
            <strong style={{ ...typography.h2, color: color.deep }}>سفارش شما ثبت شد و آماده پرداخت است</strong>
            <span style={{ ...typography.caption, color: color.muted }}>شماره سفارش: {order.orderNumber}</span>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: spacing.sm, background: color.ice, borderRadius: 14, width: "100%" }}>
              <span style={{ ...typography.caption, color: color.muted }}>مبلغ قابل پرداخت</span>
              <strong style={{ ...typography.h1, color: color.deep }}>{formatToman(order.amount)}</strong>
            </div>

            <span style={{ ...typography.body, fontWeight: 700, color: color.primary }}>وضعیت: {STATUS_LABEL[order.status]}</span>

            <p style={{ margin: 0, ...typography.caption, color: color.muted }}>
              درگاه پرداخت به‌زودی فعال می‌شود. سفارش شما ذخیره شده و پس از فعال‌سازی پرداخت، از همین صفحه قابل تکمیل خواهد بود.
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
