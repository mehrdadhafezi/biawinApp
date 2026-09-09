"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { spacing } from "@biawin/ui";
import { AppShell } from "../../../../../../components/shell/AppShell";
import { SkeletonBlock, SkeletonStyles } from "../../../../../../components/common/SkeletonBlock";
import { CardProductHero } from "../../../../../../components/services/CardProductHero";
import { CardProductInfo } from "../../../../../../components/services/CardProductInfo";
import { DisabledCardPurchaseCTA } from "../../../../../../components/services/DisabledCardPurchaseCTA";
import { ServicesErrorState } from "../../../../../../components/services/ServicesStates";
import { belongsToCategory, cardProductBelongsToService } from "../../../../../../components/services/serviceValidation";
import { servicesApi, cardProductsApi, type ServiceDto, type CardProductDto } from "../../../../../../lib/services-api";
import { ApiError } from "../../../../../../lib/api-client";

/**
 * Card Product Detail (SERVICES-R5.18) —
 * `/services/[categoryId]/[serviceId]/cards/[cardProductId]`.
 *
 * Read-only: `GET /services/:id` then `GET /cards/:id` only. The single
 * purchase-adjacent control on this page is `DisabledCardPurchaseCTA`
 * ("خرید کارت") — visual only, does nothing when tapped, exactly like
 * `DisabledPurchaseCTA` elsewhere in this module. No Order/payment/
 * wallet/credit/installment/CustomerCardInstance-issuance logic exists
 * here or anywhere in this stage.
 *
 * Relationship validation mirrors the Merchant Detail route
 * (`[merchantId]/page.tsx`) exactly, one hop further into the new
 * catalog: the real Service must belong to the URL's Category
 * (`belongsToCategory`), AND the real, ACTIVE CardProduct fetched by ID
 * must actually reference the URL's Service (`cardProductBelongsToService`)
 * — a real, active CardProduct fetched by ID alone proves nothing about
 * whether it belongs to THIS Service. Any mismatch renders the same
 * "not found" state established since SERVICES-R3.
 */
export default function CardProductDetailPage() {
  const params = useParams<{ categoryId: string; serviceId: string; cardProductId: string }>();
  const [service, setService] = useState<ServiceDto | null>(null);
  const [cardProduct, setCardProduct] = useState<CardProductDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    servicesApi
      .getService(params.serviceId)
      .then(async (data) => {
        if (cancelled) return;
        if (!belongsToCategory(data, params.categoryId)) {
          setNotFound(true);
          return;
        }
        try {
          const cardProductData = await cardProductsApi.getCardProduct(params.cardProductId);
          if (cancelled) return;
          if (!cardProductBelongsToService(cardProductData, params.serviceId)) {
            setNotFound(true);
            return;
          }
          setService(data);
          setCardProduct(cardProductData);
        } catch (err: unknown) {
          if (cancelled) return;
          if (err instanceof ApiError && err.status === 404) {
            setNotFound(true);
          } else {
            setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات کارت محصول.");
          }
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات خدمت.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.serviceId, params.categoryId, params.cardProductId]);

  const ready = service !== null && cardProduct !== null;

  return (
    <AppShell activeNavKey="services">
      <SkeletonStyles />
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        {error && <ServicesErrorState message={error} />}

        {!error && notFound && <ServicesErrorState message="این کارت محصول یافت نشد." />}

        {!error && !notFound && !ready && (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
            <SkeletonBlock height={160} />
            <SkeletonBlock height={100} />
          </div>
        )}

        {!error && !notFound && ready && (
          <>
            <CardProductHero cardProduct={cardProduct} />
            <CardProductInfo cardProduct={cardProduct} />
            <DisabledCardPurchaseCTA />
          </>
        )}
      </div>
    </AppShell>
  );
}
