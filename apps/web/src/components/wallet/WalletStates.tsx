import { Card, color, typography } from "@biawin/ui";

/**
 * Shared empty/error presentation for Wallet sections (docs/wallet-ui-contract.md
 * §1, §4) — `WalletSummary` and `TransactionList` each manage their own
 * fetch/loading/error state independently (a failed transaction fetch
 * must not block the balance cards from rendering), but both show the
 * same visual pattern, so it lives in one place instead of two.
 */
export function WalletEmptyState({ message }: { message: string }) {
  return (
    <Card>
      <p style={{ margin: 0, ...typography.body, color: color.muted }}>{message}</p>
    </Card>
  );
}

export function WalletErrorState({ message }: { message: string }) {
  return (
    <p style={{ margin: 0, ...typography.body, color: "#c0392b" }}>{message}</p>
  );
}
