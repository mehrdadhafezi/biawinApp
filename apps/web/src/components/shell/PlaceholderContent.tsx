import { Card, color, spacing, typography } from "@biawin/ui";

export interface PlaceholderContentProps {
  title: string;
  description?: string;
}

/**
 * Minimal "به‌زودی" screen body (docs/navigation-route-contract.md §3) —
 * used by every route that exists only as a placeholder today (Wallet,
 * Credit, Installments, Services, Rewards, Profile, Service Category).
 * Not a feature — just enough that the route is real and doesn't 404.
 */
export function PlaceholderContent({ title, description }: PlaceholderContentProps) {
  return (
    <div style={{ padding: `${spacing.xxl}px ${spacing.xl}px` }}>
      <Card style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: spacing.sm }}>
        <strong style={{ ...typography.h3, color: color.deep }}>{title}</strong>
        <p style={{ margin: 0, ...typography.body, color: color.muted }}>
          {description ?? "این بخش به‌زودی فعال می‌شود."}
        </p>
      </Card>
    </div>
  );
}
