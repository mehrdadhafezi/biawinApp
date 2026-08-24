import { Card, color, spacing, typography } from "@biawin/ui";
import { formatToman } from "../../lib/format";
import type { CreditLineDto } from "../../lib/credit-api";
import { CreditProgress } from "./CreditProgress";

export interface CreditOverviewCardProps {
  creditLine: CreditLineDto;
}

/**
 * Headline available-credit figure + the limit/used breakdown.
 * docs/credit-ui-contract.md §3 recommended against `FinancialCard` here
 * (it's shaped for the bank-card visual — brand name, masked number,
 * fixed aspect ratio — not a credit-limit summary) in favor of the plain
 * `Card` + typography-tokens pattern Home's existing `CreditCard` already
 * uses. Followed that recommendation rather than forcing a mismatched
 * component just because it was in this stage's design-system reuse
 * list.
 */
export function CreditOverviewCard({ creditLine }: CreditOverviewCardProps) {
  const available = creditLine.limitAmount - creditLine.usedAmount;

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <div>
        <span style={{ ...typography.caption, color: color.muted }}>اعتبار در دسترس</span>
        <strong style={{ display: "block", ...typography.h1, color: color.deep }}>
          {formatToman(available)}
        </strong>
      </div>
      <CreditProgress limitAmount={creditLine.limitAmount} usedAmount={creditLine.usedAmount} />
    </Card>
  );
}
