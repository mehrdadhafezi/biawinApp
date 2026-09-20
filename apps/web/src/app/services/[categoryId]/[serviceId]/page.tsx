"use client";

import { useParams } from "next/navigation";
import { RedirectToCategoryLanding } from "../../../../components/services/RedirectToCategoryLanding";

/**
 * Formerly Service Detail — the extra customer-facing layer between the
 * Category and the CardProduct (it listed "محصولات این خدمت", a second
 * card-selection step). `Service` is an internal entity, not a page: the
 * customer chooses a CardProduct on the Category Landing and lands directly
 * on its detail. Old links to this route continue to a real page — the
 * service's Category Landing — see `RedirectToCategoryLanding`.
 */
export default function ServiceDetailPage() {
  const params = useParams<{ categoryId: string; serviceId: string }>();
  return <RedirectToCategoryLanding categoryId={params.categoryId} />;
}
