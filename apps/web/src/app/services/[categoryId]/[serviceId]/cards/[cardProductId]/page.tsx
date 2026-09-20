"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { layout, spacing } from "@biawin/ui";
import { AppShell } from "../../../../../../components/shell/AppShell";
import { SkeletonBlock, SkeletonStyles } from "../../../../../../components/common/SkeletonBlock";
import { CardProductDetailStyles } from "../../../../../../components/services/CardProductDetailStyles";
import { ServicesPageHeader } from "../../../../../../components/services/ServicesPageHeader";
import { CardProductDetailHero } from "../../../../../../components/services/CardProductDetailHero";
import { CardProductDetailSummary } from "../../../../../../components/services/CardProductDetailSummary";
import {
  CardProductBenefits,
  CardProductProcess,
  CardProductFaq,
} from "../../../../../../components/services/CardProductDetailSections";
import { CardProductBuyBar } from "../../../../../../components/services/CardProductBuyBar";
import { ServicesErrorState } from "../../../../../../components/services/ServicesStates";
import { belongsToCategory, cardProductBelongsToService } from "../../../../../../components/services/serviceValidation";
import { useServiceCatalog } from "../../../../../../components/services/useServiceCatalog";
import { servicesApi, cardProductsApi, type ServiceDto, type CardProductDto } from "../../../../../../lib/services-api";
import { ApiError } from "../../../../../../lib/api-client";

/**
 * Card Product Detail (SERVICES-R5.18, purchase flow added R5.26) —
 * `/services/[categoryId]/[serviceId]/cards/[cardProductId]`.
 *
 * Read-only data fetch (`GET /services/:id` then `GET /cards/:id`); the
 * purchase-adjacent control is `CardProductBuyBar`, which renders a REAL,
 * enabled "خرید کارت" button (opening `PurchaseSheet`, which calls the
 * real `POST /orders`) for any CardProduct that is genuinely purchasable,
 * and a real `disabled` button for everything else. No payment/wallet/
 * credit/installment/CustomerCardInstance-issuance logic exists here or
 * anywhere in this stage; a successful purchase only ever creates a
 * `pending` Order (see `PurchaseSheet.tsx`'s own doc comment).
 *
 * Presentation follows the approved prototype's cardOnly detail view
 * (header → hero → selected-card summary/facts → benefits → process → FAQ →
 * sticky buy bar) — see `CardProductDetailStyles.tsx`.
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
  // Card Product Detail Experience (Sep 2026) — the real Category name for
  // the hero badge / "حوزه استفاده" fact, same hook + same
  // gate-on-both-fetches discipline Service Detail already established
  // (docs/services-r3-service-detail-fidelity-report.md's R3.1 fix) so the
  // same async-race content gap (a real fact rendering blank because
  // `categories` hadn't resolved yet) can't recur here.
  const { categories } = useServiceCatalog();
  const category = categories?.find((c) => c.id === params.categoryId);
  const categoryName = category?.name ?? "";
  // "Back" with no history lands on the Category Landing this card was chosen
  // from — the previous customer-facing level — never on a Service page.
  const landingHref = category?.slug ? `/categories/${category.slug}` : "/services";

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

  const ready = service !== null && cardProduct !== null && categories !== null;

  return (
    <AppShell activeNavKey="services">
      <SkeletonStyles />
      <CardProductDetailStyles />

      {(error || notFound || !ready) && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
          {error && <ServicesErrorState message={error} />}

          {!error && notFound && <ServicesErrorState message="این کارت محصول یافت نشد." />}

          {!error && !notFound && !ready && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
              <SkeletonBlock height={160} />
              <SkeletonBlock height={100} />
            </div>
          )}
        </div>
      )}

      {!error && !notFound && ready && (
        // `PageContainer` reserves `bottomNavHeight + 24` of bottom padding for
        // the nav. The negative margin hands that space back to this wrapper —
        // the sticky buy bar's containing block — so at the end of the page the
        // bar rests flush against the nav instead of floating above a gap.
        <div className="cpd-page" style={{ marginBottom: -(layout.bottomNavHeight + 24) }}>
          <ServicesPageHeader
            variant="detail"
            title="جزئیات کارت"
            shareTitle={cardProduct.title}
            shareText={cardProduct.description || cardProduct.subtitle}
            fallbackHref={landingHref}
          />
          <div className="cpd-main">
            <CardProductDetailHero cardProduct={cardProduct} categoryName={categoryName} />
            <CardProductDetailSummary cardProduct={cardProduct} categoryName={categoryName} />
            <CardProductBenefits cardProduct={cardProduct} />
            <CardProductProcess />
            <CardProductFaq cardProduct={cardProduct} />
          </div>
          <CardProductBuyBar cardProduct={cardProduct} />
        </div>
      )}
    </AppShell>
  );
}
