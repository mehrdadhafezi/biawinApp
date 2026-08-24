import { color, spacing, typography } from "@biawin/ui";
import { formatToman } from "../../lib/format";

export interface CreditProgressProps {
  limitAmount: number;
  usedAmount: number;
}

/**
 * The usage bar — no `Progress` primitive exists in `packages/ui`
 * (verified in docs/credit-ui-contract.md §8). Home's `CreditCard`
 * already hand-rolls the same bar inline; this is the second place doing
 * it, which is exactly the threshold this codebase has used before
 * (Stage 5.2's `SkeletonBlock`/`ComingSoonCaption`) to extract a shared
 * primitive — not done here since that would mean touching Home's
 * `AccountFinancialCards.tsx`, explicitly out of scope for this stage.
 * Kept local and self-contained instead.
 */
export function CreditProgress({ limitAmount, usedAmount }: CreditProgressProps) {
  const usedPercent = limitAmount > 0 ? Math.min(100, Math.round((usedAmount / limitAmount) * 100)) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
      <div
        role="progressbar"
        aria-valuenow={usedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="میزان استفاده از اعتبار"
        style={{ height: 6, borderRadius: 999, background: color.line, overflow: "hidden" }}
      >
        <div style={{ height: "100%", width: `${usedPercent}%`, background: color.primary, borderRadius: 999 }} />
      </div>
      <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>
        {formatToman(usedAmount)} از {formatToman(limitAmount)} استفاده‌شده ({usedPercent}٪)
      </span>
    </div>
  );
}
