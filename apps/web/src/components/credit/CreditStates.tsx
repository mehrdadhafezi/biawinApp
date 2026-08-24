import { Card, color, typography } from "@biawin/ui";

/** Shared empty/error presentation for Credit Overview — same pattern as Wallet's WalletStates. */
export function CreditEmptyState({ message }: { message: string }) {
  return (
    <Card>
      <p style={{ margin: 0, ...typography.body, color: color.muted }}>{message}</p>
    </Card>
  );
}

export function CreditErrorState({ message }: { message: string }) {
  return <p style={{ margin: 0, ...typography.body, color: "#c0392b" }}>{message}</p>;
}
