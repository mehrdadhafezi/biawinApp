import { Badge, Card, color, spacing, typography } from "@biawin/ui";
import { formatToman } from "../../lib/format";
import type { InstallmentDto } from "../../lib/installment-api";
import { formatDueDate, INSTALLMENT_STATUS_LABEL, INSTALLMENT_STATUS_TONE } from "./installmentStatus";

export interface InstallmentItemProps {
  installment: InstallmentDto;
  onSelect: (id: string) => void;
}

/** One row in InstallmentList — tapping it opens InstallmentDetail (client-side state, no new route). */
export function InstallmentItem({ installment, onSelect }: InstallmentItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(installment.id)}
      style={{ all: "unset", display: "block", width: "100%", cursor: "pointer" }}
    >
      <Card style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <strong style={{ ...typography.h3, color: color.deep }}>
            {formatToman(installment.monthlyAmount)} / ماه
          </strong>
          <Badge tone={INSTALLMENT_STATUS_TONE[installment.status]}>
            {INSTALLMENT_STATUS_LABEL[installment.status]}
          </Badge>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>
            {installment.paidCount} از {installment.totalMonths} قسط پرداخت‌شده
          </span>
          <span style={{ ...typography.caption, fontWeight: 400, color: color.muted, direction: "ltr" }}>
            {formatDueDate(installment.nextDueDate)}
          </span>
        </div>
      </Card>
    </button>
  );
}
