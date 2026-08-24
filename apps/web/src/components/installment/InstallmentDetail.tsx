"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, color, spacing, typography } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import { formatToman } from "../../lib/format";
import { installmentApi, type InstallmentDto } from "../../lib/installment-api";
import { ApiError } from "../../lib/api-client";
import { formatDueDate, INSTALLMENT_STATUS_LABEL, INSTALLMENT_STATUS_TONE } from "./installmentStatus";
import { InstallmentErrorState } from "./InstallmentStates";

export interface InstallmentDetailProps {
  installmentId: string;
  onBack: () => void;
}

/**
 * Read-only detail view for a single installment (GET /installments/:id).
 * No Payment Action UI at all — out of scope per docs/installment-ui-contract.md
 * (no backing payment-log table, no prototype precedent).
 */
export function InstallmentDetail({ installmentId, onBack }: InstallmentDetailProps) {
  const [installment, setInstallment] = useState<InstallmentDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    installmentApi
      .getInstallment(installmentId)
      .then((data) => {
        if (!cancelled) setInstallment(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات قسط.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [installmentId]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
      <Button variant="ghost" onClick={onBack} style={{ alignSelf: "flex-start" }}>
        بازگشت به فهرست
      </Button>

      {error && <InstallmentErrorState message={error} />}

      {!error && installment === null && (
        <Card style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <SkeletonBlock height={28} width="60%" />
          <SkeletonBlock height={18} width="40%" />
          <SkeletonBlock height={18} width="50%" />
          <SkeletonBlock height={18} width="45%" />
        </Card>
      )}

      {!error && installment !== null && (
        <Card style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ ...typography.h1, color: color.deep }}>
              {formatToman(installment.monthlyAmount)} / ماه
            </strong>
            <Badge tone={INSTALLMENT_STATUS_TONE[installment.status]}>
              {INSTALLMENT_STATUS_LABEL[installment.status]}
            </Badge>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            <DetailRow label="اقساط پرداخت‌شده" value={`${installment.paidCount} از ${installment.totalMonths}`} />
            <DetailRow label="سررسید بعدی" value={formatDueDate(installment.nextDueDate)} />
            <DetailRow label="مبلغ ماهانه" value={formatToman(installment.monthlyAmount)} />
          </div>
        </Card>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>{label}</span>
      <span style={{ ...typography.body, color: color.deep }}>{value}</span>
    </div>
  );
}
