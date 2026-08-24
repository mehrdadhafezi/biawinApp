import { Card, color, typography } from "@biawin/ui";

/** Shared empty/error presentation for Installments — same pattern as WalletStates/CreditStates. */
export function InstallmentEmptyState({ message }: { message: string }) {
  return (
    <Card>
      <p style={{ margin: 0, ...typography.body, color: color.muted }}>{message}</p>
    </Card>
  );
}

export function InstallmentErrorState({ message }: { message: string }) {
  return <p style={{ margin: 0, ...typography.body, color: "#c0392b" }}>{message}</p>;
}
