"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { spacing } from "@biawin/ui";
import { AppShell } from "../shell/AppShell";
import { SkeletonBlock, SkeletonStyles } from "../common/SkeletonBlock";
import { servicesApi } from "../../lib/services-api";

/**
 * The Services journey has three customer-facing levels — Services Home,
 * Category Landing, CardProduct Detail. `Service` is an internal entity, not
 * a level, so the routes that used to render a Service-shaped page
 * (`/services/[categoryId]`, the Category View's Service grid, and
 * `/services/[categoryId]/[serviceId]`, Service Detail) no longer render
 * anything of their own: they resolve the Category and replace themselves
 * with its Landing page (`/categories/[slug]`), or with Services Home when
 * the Category has no Landing route.
 *
 * Kept as redirects (not deleted) because live links point at
 * `/services/{categoryId}` — Home's service banners and mosaic tiles — and
 * bookmarks/shared URLs to the old pages must land somewhere real. `replace`,
 * not `push`, so the redirect never adds a history entry (Back skips it).
 */
export function RedirectToCategoryLanding({ categoryId }: { categoryId: string }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    servicesApi
      .listCategories()
      .then((result) => {
        if (cancelled) return;
        const category = result.items.find((c) => c.id === categoryId);
        router.replace(category?.slug ? `/categories/${category.slug}` : "/services");
      })
      .catch(() => {
        if (!cancelled) router.replace("/services");
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, router]);

  return (
    <AppShell activeNavKey="services">
      <SkeletonStyles />
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
        <SkeletonBlock height={160} />
        <SkeletonBlock height={100} />
      </div>
    </AppShell>
  );
}
