import { Badge, Card, color, spacing, typography } from "@biawin/ui";
import type { ServiceDto } from "../../lib/services-api";

export interface ServiceInfoProps {
  service: ServiceDto;
}

/**
 * Benefits/tags/FAQ — the parts of `docs/services-ui-contract.md`'s
 * `FeatureList`/`FaqAccordion` that fit inside this stage's narrower
 * `ServiceInfo` component. FAQ uses native `<details>`/`<summary>`
 * rather than a new Accordion — the contract flagged Accordion as a
 * missing `packages/ui` primitive, and this stage says not to add one
 * yet, so this avoids needing it at all instead of building a
 * module-local stand-in for something already flagged as a real,
 * reusable gap (Profile needs the same primitive later).
 */
export function ServiceInfo({ service }: ServiceInfoProps) {
  const hasContent = service.benefits.length > 0 || service.tags.length > 0 || service.faq.length > 0;
  if (!hasContent) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      {service.benefits.length > 0 && (
        <Card style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          <strong style={{ ...typography.h3, color: color.deep }}>مزایا</strong>
          <ul style={{ margin: 0, paddingInlineStart: spacing.lg, ...typography.body, color: color.ink }}>
            {service.benefits.map((benefit, i) => (
              <li key={i}>{benefit}</li>
            ))}
          </ul>
        </Card>
      )}

      {service.tags.length > 0 && (
        <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>
          {service.tags.map((tag) => (
            <Badge key={tag} tone="neutral">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {service.faq.length > 0 && (
        <Card style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <strong style={{ ...typography.h3, color: color.deep }}>سوالات متداول</strong>
          {service.faq.map((item, i) => (
            <details key={i}>
              <summary style={{ ...typography.body, fontWeight: 700, color: color.ink, cursor: "pointer" }}>
                {item.question}
              </summary>
              <p style={{ margin: `${spacing.xs}px 0 0`, ...typography.body, color: color.muted }}>{item.answer}</p>
            </details>
          ))}
        </Card>
      )}
    </div>
  );
}
