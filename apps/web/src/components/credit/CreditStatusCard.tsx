import { Badge, Card, color, typography } from "@biawin/ui";
import type { CreditLineDto } from "../../lib/credit-api";

const STATUS_LABEL: Record<CreditLineDto["status"], string> = {
  active: "فعال",
  suspended: "معلق",
  closed: "بسته‌شده",
};
const STATUS_TONE: Record<CreditLineDto["status"], "success" | "warning" | "neutral"> = {
  active: "success",
  suspended: "warning",
  closed: "neutral",
};

export interface CreditStatusCardProps {
  creditLine: CreditLineDto;
}

export function CreditStatusCard({ creditLine }: CreditStatusCardProps) {
  const expiresLabel = creditLine.expiresAt
    ? new Date(creditLine.expiresAt).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" })
    : "بدون تاریخ انقضا";

  return (
    <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ ...typography.caption, color: color.muted }}>وضعیت خط اعتباری</span>
        <span style={{ ...typography.body, fontWeight: 400, color: color.ink, direction: "ltr" }}>
          {expiresLabel}
        </span>
      </div>
      <Badge tone={STATUS_TONE[creditLine.status]}>{STATUS_LABEL[creditLine.status]}</Badge>
    </Card>
  );
}
