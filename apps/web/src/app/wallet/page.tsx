"use client";

import { SkeletonStyles } from "../../components/common/SkeletonBlock";
import { TransactionList } from "../../components/wallet/TransactionList";
import { WalletSummary } from "../../components/wallet/WalletSummary";
import { AppShell } from "../../components/shell/AppShell";

/**
 * Wallet Module v1 (docs/wallet-ui-contract.md) — Wallet Overview + real
 * transaction history, replacing Stage 5.2's placeholder. Deposit/
 * Withdraw/Payment Gateway are explicitly out of scope for this pass —
 * no button or UI for them exists on this page at all yet, not even a
 * disabled one, since they weren't in this stage's component tree.
 */
export default function WalletPage() {
  return (
    <AppShell activeNavKey="home" pageLabel="کیف پول">
      <SkeletonStyles />
      <WalletSummary />
      <TransactionList />
    </AppShell>
  );
}
