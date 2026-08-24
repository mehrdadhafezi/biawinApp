import { Card, color, typography } from "@biawin/ui";

/** Shared empty/error presentation for Services — same pattern as WalletStates/CreditStates/InstallmentStates. */
export function ServicesEmptyState({ message }: { message: string }) {
  return (
    <Card>
      <p style={{ margin: 0, ...typography.body, color: color.muted }}>{message}</p>
    </Card>
  );
}

export function ServicesErrorState({ message }: { message: string }) {
  return <p style={{ margin: 0, ...typography.body, color: "#c0392b" }}>{message}</p>;
}
