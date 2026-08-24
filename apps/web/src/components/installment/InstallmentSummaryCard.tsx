import { Card, color, spacing, typography } from "@biawin/ui";
import { formatToman } from "../../lib/format";
import type { InstallmentDto } from "../../lib/installment-api";

export interface InstallmentSummaryCardProps {
  installments: InstallmentDto[];
}

/**
 * Aggregate summary — active count + total monthly commitment, both
 * derived client-side from the same GET /installments response (no new
 * endpoint, matching docs/installment-ui-contract.md §4's
 * "InstallmentSummary" being a computed view, not a fetched one). A new
 * concept neither Wallet nor Credit's v1 needed, since a user can have
 * many installments (`Installment.orderId` is unique per order) where
 * Wallet had exactly 2 wallets and Credit typically has 1 line.
 */
export function InstallmentSummaryCard({ installments }: InstallmentSummaryCardProps) {
  const active = installments.filter((i) => i.status === "active");
  const totalMonthlyCommitment = active.reduce((sum, i) => sum + i.monthlyAmount, 0);

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <div>
        <span style={{ ...typography.caption, color: color.muted }}>تعهد ماهانه فعلی</span>
        <strong style={{ display: "block", ...typography.h1, color: color.deep }}>
          {formatToman(totalMonthlyCommitment)}
        </strong>
      </div>
      <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>
        {active.length} قسط فعال از مجموع {installments.length} خرید اقساطی
      </span>
    </Card>
  );
}
