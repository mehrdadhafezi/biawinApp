import { Card, color, spacing, typography } from "@biawin/ui";
import type { CardProductDto } from "../../lib/services-api";

export interface CardProductInfoProps {
  cardProduct: CardProductDto;
}

/**
 * SERVICES-R5.18 — benefits + validity, the only two "if available"
 * fields this stage's task asked for that actually exist on the real
 * `CardProduct` model. No `usageGuide`/`terms` field exists anywhere in
 * the schema (`backend/prisma/schema.prisma`) — only `benefits` and
 * `validityDays` — so no "usage guide"/"terms" section is rendered here;
 * inventing one would mean showing text with no real backend behind it,
 * exactly what this engagement has consistently avoided since SERVICES-R1.
 * See docs/services-r5-18-customer-card-catalog-ui.md for this finding.
 */
export function CardProductInfo({ cardProduct }: CardProductInfoProps) {
  const hasContent = cardProduct.benefits.length > 0 || cardProduct.validityDays !== null;
  if (!hasContent) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      {cardProduct.benefits.length > 0 && (
        <Card style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <strong style={{ ...typography.h3, color: color.deep }}>مزایا</strong>
          <ul style={{ margin: 0, paddingInlineStart: spacing.lg, ...typography.body, color: color.ink }}>
            {cardProduct.benefits.map((benefit, i) => (
              <li key={i}>{benefit}</li>
            ))}
          </ul>
        </Card>
      )}

      {cardProduct.validityDays !== null && (
        <Card style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <strong style={{ ...typography.h3, color: color.deep }}>مدت اعتبار</strong>
          <span style={{ ...typography.body, color: color.ink }}>{cardProduct.validityDays} روز از فعال‌سازی</span>
        </Card>
      )}
    </div>
  );
}
