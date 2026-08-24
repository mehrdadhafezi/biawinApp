import { spacing } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { InstallmentDto } from "../../lib/installment-api";
import { InstallmentEmptyState, InstallmentErrorState } from "./InstallmentStates";
import { InstallmentItem } from "./InstallmentItem";

export interface InstallmentListProps {
  installments: InstallmentDto[] | null;
  error: string | null;
  onSelect: (id: string) => void;
}

/** Loading (null)/error/empty/populated states for the installment list — mirrors WalletList/CreditUsageList precedent. */
export function InstallmentList({ installments, error, onSelect }: InstallmentListProps) {
  if (error) {
    return <InstallmentErrorState message={error} />;
  }

  if (installments === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
        <SkeletonBlock height={84} />
        <SkeletonBlock height={84} />
        <SkeletonBlock height={84} />
      </div>
    );
  }

  if (installments.length === 0) {
    return <InstallmentEmptyState message="هنوز خرید اقساطی‌ای ثبت نشده." />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
      {installments.map((installment) => (
        <InstallmentItem key={installment.id} installment={installment} onSelect={onSelect} />
      ))}
    </div>
  );
}
