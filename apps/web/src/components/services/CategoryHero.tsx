import { color, spacing, typography } from "@biawin/ui";
import type { CategoryDto } from "../../lib/services-api";
import { getCategoryAccent, toPersianDigits, CATEGORY_ICON, CATEGORY_ICON_FALLBACK } from "./serviceCategoryVisual";

/**
 * Category View's header — pixel-matched to the prototype's real
 * `.category-hero` (mined directly from `biawin_single_file_app_requested_edits_v15.html`
 * this stage, docs/services-r2-category-filter-fidelity-report.md
 * "Category Hero decisions"), using real `Category.name`/`.description`,
 * not the prototype's synthetic `serviceCopy` fallback text.
 *
 * PROTOTYPE-DERIVED, kept: the "کارت‌های خدمات بیاوین" label badge
 * (verbatim, identical for every category in the prototype too), the
 * meta-chip row (item count + two static phrases, also identical for
 * every category in the prototype), the 4-color accent theme mined from
 * `openServiceCategory()`'s `style.setProperty()` calls, and the
 * per-category dynamic item count.
 *
 * IMPLEMENTATION DECISION, deliberately NOT reproduced: the prototype's
 * real hero is a full-bleed photo (`#categoryHeroImage`, `object-fit:
 * cover`) under a dark gradient scrim with white text. The real backend
 * has no per-category hero photo — `Category.imageKey` is null for all 19
 * real rows, and the only real, migrated per-category assets are the 220×
 * 220px round icon thumbnails (apps/web/public/services/icon-*.webp,
 * SERVICES-R1). Stretching a 220px icon to a ~760px-wide full-bleed hero
 * would visibly blur/pixelate it — reusing it as a real icon, at its own
 * native scale, integrates the actual migrated asset without degrading
 * it. If real per-category photography is ever sourced, the dark-photo-
 * hero treatment should be revisited then, not faked now.
 *
 * No back button here — `GlobalHeader`/`AppShell` provide the shared,
 * fixed shell chrome (no per-page header slot exists, unlike the
 * prototype's own per-view `<header>`), and Next.js's router already
 * gives correct browser-back behavior without one (verified,
 * docs/services-v1-implementation-report.md "Responsive validation").
 * Adding a duplicate in-page back control was judged unnecessary chrome,
 * not a fidelity gap — the prototype's back button exists because *it*
 * has no browser history to rely on (a single-file hash app, confirmed
 * again this stage: `openView()` uses `history.replaceState`, never
 * `pushState` — a constraint that doesn't apply to this real multi-route
 * Next.js app).
 */
export function CategoryHero({ category, serviceCount }: { category: CategoryDto; serviceCount: number }) {
  const theme = getCategoryAccent(category.name);
  const iconSrc = CATEGORY_ICON[category.name] ?? CATEGORY_ICON_FALLBACK;

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 28,
        overflow: "hidden",
        background: theme.soft,
        border: `1px solid ${theme.accent}33`,
        boxShadow: "0 20px 44px rgba(5,72,135,.10)",
        padding: spacing.lg,
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }}>
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, minWidth: 0 }}>
          {/* Prototype's `.category-hero-label` — verbatim text, every category. */}
          <span
            style={{
              alignSelf: "flex-start",
              ...typography.caption,
              color: theme.deep,
              background: `${theme.accent}22`,
              border: `1px solid ${theme.accent}38`,
              borderRadius: 999,
              padding: "7px 11px",
            }}
          >
            کارت‌های خدمات بیاوین
          </span>
          <h1 style={{ margin: 0, fontSize: 25, fontWeight: 900, lineHeight: 1.35, color: theme.deep }}>{category.name}</h1>
        </div>
        {/* Real, migrated icon asset — native 220×220 scale, not stretched. */}
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            overflow: "hidden",
            border: `3px solid ${color.white}`,
            boxShadow: "0 8px 20px rgba(8,121,220,.13)",
            background: color.white,
            flexShrink: 0,
          }}
        >
          {/* Plain <img>, matching every other Services image today (no imageUrl resolver exists) — see CategoryGrid.tsx's own comment. */}
          <img src={iconSrc} alt="" aria-hidden="true" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </span>
      </div>

      <p style={{ margin: 0, ...typography.body, color: color.muted, maxWidth: "92%" }}>{category.description}</p>

      {/*
       * Prototype's `.category-hero-meta` row — 1 real (item count), 2
       * static (identical for every category in the prototype too). The
       * prototype's own middle phrase is "اقساطی، اعتباری و تخفیفی"
       * ("...and discounted") — "تخفیفی" has no real PurchaseMethod
       * backing (the same mismatch already resolved for the filter chips,
       * SERVICES-R1), so this lists the real 4 PurchaseMethod values
       * instead of the prototype's literal, partly-fictional phrase.
       */}
      <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap", marginTop: spacing.xs }}>
        {[`${toPersianDigits(serviceCount)} خدمت قابل انتخاب`, "اقساطی، اعتباری، نقدی و رایگان", "ویژه اعضای بیاوین"].map((label) => (
          <span
            key={label}
            style={{
              padding: "7px 10px",
              borderRadius: 12,
              background: color.white,
              border: `1px solid ${theme.accent}2a`,
              ...typography.micro,
              color: theme.deep,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
