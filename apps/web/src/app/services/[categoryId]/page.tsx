"use client";

import { useParams } from "next/navigation";
import { RedirectToCategoryLanding } from "../../../components/services/RedirectToCategoryLanding";

/**
 * Formerly the Category View (a Service grid with search/method filters).
 * The Category Landing (`/categories/[slug]`) is now the one and only
 * category page — see `RedirectToCategoryLanding` for why this route
 * remains as a redirect.
 */
export default function ServiceCategoryPage() {
  const params = useParams<{ categoryId: string }>();
  return <RedirectToCategoryLanding categoryId={params.categoryId} />;
}
