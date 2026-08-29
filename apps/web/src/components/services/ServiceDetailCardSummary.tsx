import { color, spacing, typography } from "@biawin/ui";
import type { ServiceDto } from "../../lib/services-api";
import { PURCHASE_METHOD_LABEL } from "./serviceMethod";

/**
 * SERVICES-R3 — the Services-origin `cardOnly` experience's real
 * "مشخصات همین کارت" section, mined this stage directly from the
 * prototype (`#detailCardOnlyInfo`, `.detail-selected-card-summary`,
 * `.detail-card-facts`, `.detail-card-tags`) — a compact fact-card
 * summary that only ever renders in the prototype's cardOnly mode
 * (`display:none` by default, `.card-only-mode` reveals it), never in
 * full mode. This route is unconditionally cardOnly-equivalent today
 * (see the page's own doc comment), so this section always renders here.
 *
 * DOMAIN-DERIVED, no invented fields: the prototype's `#detailCardName`/
 * `#detailCardSummary`/`#detailCardValue`/`#detailCardFactType`/
 * `#detailCardFactHeadline`/`#detailCardFactCategory`/`#detailCardTags`
 * are all populated from `openServiceDetail()`'s caller-supplied
 * `title`/`description`/`price`/`cardType`/`cardHeadline`/`category`/
 * `cardTags` — a synthetic per-card payload with no real backend behind
 * it. This component maps the SAME conceptual fields onto the real
 * `Service`/`Category` catalog instead:
 *   - CardTypeTag / CardFactType  -> the service's first real
 *     `PurchaseMethod` label (matches `ServiceCard`'s own established
 *     "show the primary method" precedent, SERVICES-R1)
 *   - CardName    -> `service.title` (real)
 *   - CardSummary -> `service.subtitle` (real; the DTO has no separate
 *     long-form description field)
 *   - CardValue   -> `service.priceLabel` (real)
 *   - CardFactHeadline -> the best available real "main condition" text:
 *     `creditMultiplierLabel`, else an installment month range, else the
 *     real `badge` field — never an invented phrase
 *   - CardFactCategory -> the real `Category.name` (passed in from the
 *     page, which already fetches it via `useServiceCatalog`)
 *   - CardTags -> `service.tags` (real)
 */
export interface ServiceDetailCardSummaryProps {
  service: ServiceDto;
  categoryName: string;
}

function primaryMethodLabel(service: ServiceDto): string {
  const first = service.availableMethods[0];
  return first ? PURCHASE_METHOD_LABEL[first] : "نامشخص";
}

function mainConditionLabel(service: ServiceDto): string {
  if (service.creditMultiplierLabel) return service.creditMultiplierLabel;
  if (service.availableMethods.includes("installment") && (service.installmentMinMonths || service.installmentMaxMonths)) {
    return `اقساط ${service.installmentMinMonths ?? "؟"} تا ${service.installmentMaxMonths ?? "؟"} ماهه`;
  }
  return service.badge || "شرایط قابل مشاهده در همین صفحه";
}

export function ServiceDetailCardSummary({ service, categoryName }: ServiceDetailCardSummaryProps) {
  const typeLabel = primaryMethodLabel(service);
  const conditionLabel = mainConditionLabel(service);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.sm,
        padding: spacing.lg,
        border: "1px solid #dcebf7",
        borderRadius: 22,
        background: "linear-gradient(145deg,#f7fbff,#eef7ff)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ ...typography.caption, color: color.muted }}>مشخصات همین خدمت</span>
          <strong style={{ ...typography.h3, color: color.deep, marginTop: spacing.xs }}>{service.title}</strong>
          <p style={{ margin: `${spacing.xs}px 0 0`, ...typography.body, color: color.muted }}>{service.subtitle}</p>
        </div>
        <div
          style={{
            minWidth: 96,
            padding: "11px 10px",
            borderRadius: 17,
            background: color.white,
            border: `1px solid ${color.line}`,
            boxShadow: "0 8px 20px rgba(5,72,135,.06)",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          <small style={{ display: "block", ...typography.micro, color: color.muted }}>قیمت / سقف</small>
          <b style={{ display: "block", marginTop: spacing.xs, ...typography.caption, color: color.primary }}>{service.priceLabel ?? "قیمت اعلام نشده"}</b>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: spacing.xs }}>
        {[
          { label: "نوع خدمت", value: typeLabel },
          { label: "شرایط اصلی", value: conditionLabel },
          { label: "دسته‌بندی", value: categoryName },
        ].map((fact) => (
          <div
            key={fact.label}
            style={{
              padding: "11px 8px",
              border: `1px solid ${color.line}`,
              borderRadius: 17,
              background: color.white,
              textAlign: "center",
            }}
          >
            <span style={{ display: "block", ...typography.micro, color: color.muted }}>{fact.label}</span>
            <b style={{ display: "block", marginTop: spacing.xs, ...typography.caption, color: color.ink }}>{fact.value}</b>
          </div>
        ))}
      </div>

      {service.tags.length > 0 && (
        <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
          {service.tags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "6px 9px",
                borderRadius: 999,
                background: "#edf7ff",
                border: "1px solid #d5eafb",
                ...typography.micro,
                color: "#1768a7",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
