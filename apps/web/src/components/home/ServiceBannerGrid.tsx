"use client";

import { useRouter } from "next/navigation";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { CategoriesSummary } from "./useCategories";

interface BannerTheme {
  categoryName: string;
  icon: string;
  kicker: string;
  gradient: string;
  wide?: boolean;
}

/** `.services .banner-grid` — 5 named categories, matched to real seeded `Category` rows by name (all 5 exist in the live catalog). */
const BANNERS: BannerTheme[] = [
  { categoryName: "اتومبیل", icon: "🚗", kicker: "اعتبار و اقساط منعطف", gradient: "linear-gradient(160deg,#3a3a42,#16161a)" },
  { categoryName: "لوازم خانگی", icon: "🧊", kicker: "برندهای معتبر و متنوع", gradient: "linear-gradient(160deg,#8d6e63,#54352b)" },
  { categoryName: "پوشاک", icon: "👗", kicker: "خرید از برندهای منتخب", gradient: "linear-gradient(160deg,#9c27b0,#581878)" },
  { categoryName: "طلا و جواهر", icon: "💍", kicker: "خرید مطمئن و هدفمند", gradient: "linear-gradient(160deg,#ffc107,#8a6107)" },
  { categoryName: "گردشگری", icon: "🧳", kicker: "تجربه سفر با پرداخت مرحله‌ای", gradient: "linear-gradient(160deg,#44a047,#1a4a1e)", wide: true },
];

/**
 * `.services` (`#services`) — the featured-category banner grid, restyled
 * from Stage 4.3's `FeaturedServiceBanner` to pixel-match the prototype's
 * bigger, image-style tiles. No `imageUrl` resolution exists for
 * `Category.imageKey` yet (docs/services-ui-contract.md §6 Gap #3) — a
 * themed gradient + large icon stands in for the prototype's photo, same
 * category-fallback reasoning `ServiceCard` already uses. Tiles now link
 * to the real `/services/[categoryId]` route (Stage 9.1 shipped it) —
 * Stage 4.3's version predates that route and had nothing to link to.
 */
export function ServiceBannerGrid({ categories, error }: CategoriesSummary) {
  const router = useRouter();
  if (error) return null;

  const banners = categories
    ? BANNERS.map((b) => ({ ...b, category: categories.find((c) => c.name === b.categoryName) })).filter((b) => b.category)
    : null;

  return (
    <section style={{ padding: "34px 18px 48px", background: "#f6faff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>خدمات منتخب بیاوین</h3>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6f8497" }}>خرید اقساطی در دسته‌بندی‌های پرکاربرد</p>
        </div>
        <a href="#top" style={{ fontSize: 11, color: "#0879dc", fontWeight: 700, textDecoration: "none" }}>
          بازگشت به بالا
        </a>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 13 }}>
        {banners === null
          ? [0, 1, 2, 3].map((i) => <SkeletonBlock key={i} height={150} radiusPx={22} />)
          : banners.map((banner) => (
              <button
                key={banner.categoryName}
                type="button"
                onClick={() => router.push(`/services/${banner.category!.id}`)}
                style={{
                  all: "unset",
                  gridColumn: banner.wide ? "1/-1" : undefined,
                  minHeight: banner.wide ? 200 : 150,
                  borderRadius: 22,
                  position: "relative",
                  overflow: "hidden",
                  cursor: "pointer",
                  background: banner.gradient,
                  display: "flex",
                  alignItems: "flex-end",
                }}
              >
                <span aria-hidden="true" style={{ position: "absolute", top: 16, left: 16, fontSize: 34, opacity: 0.5 }}>
                  {banner.icon}
                </span>
                <div style={{ padding: 16, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div>
                    <strong style={{ display: "block", fontSize: banner.wide ? 21 : 15 }}>{banner.categoryName}</strong>
                    <small style={{ fontSize: 11, opacity: 0.85 }}>{banner.kicker}</small>
                  </div>
                  <span style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#fff" strokeWidth={2}>
                      <path d="m15 18-6-6 6-6" />
                    </svg>
                  </span>
                </div>
              </button>
            ))}
      </div>
    </section>
  );
}
