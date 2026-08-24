"use client";

import { useEffect, useState } from "react";
import { Badge, Card, color, spacing, typography } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { formatToman } from "../../lib/format";
import { walletApi, type WalletTransactionDto } from "../../lib/wallet-api";
import { SkeletonBlock } from "../common/SkeletonBlock";
import { WalletEmptyState, WalletErrorState } from "./WalletStates";

interface TaggedTransaction extends WalletTransactionDto {
  walletKind: "main" | "reward";
}

const KIND_LABEL: Record<"main" | "reward", string> = { main: "اصلی", reward: "جایزه" };
const TYPE_LABEL: Record<WalletTransactionDto["type"], string> = {
  topup: "واریز",
  spend: "برداشت",
  refund: "بازگشت وجه",
  gateway_settlement: "تسویه درگاه",
};
const IS_INCOMING: Record<WalletTransactionDto["type"], boolean> = {
  topup: true,
  spend: false,
  refund: true,
  gateway_settlement: false,
};

/**
 * `GET /transactions` (the merged endpoint) tags rows with `walletId`
 * only, not `kind` (docs/wallet-ui-contract.md §4's flagged gap). Rather
 * than cross-referencing `walletId` against a separate `GET /wallet`
 * call, this fetches `GET /wallet/:kind/transactions` for both kinds in
 * parallel — each result set is already known to be that kind, so no
 * cross-referencing is needed at all. Simpler than the gap implied,
 * using only existing endpoints, per the contract.
 */
export function TransactionList() {
  const [transactions, setTransactions] = useState<TaggedTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      walletApi.listWalletTransactions("main"),
      walletApi.listWalletTransactions("reward"),
    ])
      .then(([main, reward]) => {
        if (cancelled) return;
        const tagged: TaggedTransaction[] = [
          ...main.map((t) => ({ ...t, walletKind: "main" as const })),
          ...reward.map((t) => ({ ...t, walletKind: "reward" as const })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTransactions(tagged);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "خطا در دریافت تراکنش‌ها.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section style={{ padding: `${spacing.xl}px ${spacing.xl}px 0` }}>
      <h2 style={{ margin: `0 0 ${spacing.md}px`, ...typography.h3, color: color.deep }}>تراکنش‌ها</h2>

      {error && <WalletErrorState message={error} />}

      {!error && transactions === null && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <SkeletonBlock height={64} radiusPx={18} />
          <SkeletonBlock height={64} radiusPx={18} />
          <SkeletonBlock height={64} radiusPx={18} />
        </div>
      )}

      {!error && transactions !== null && transactions.length === 0 && (
        <WalletEmptyState message="هنوز تراکنشی ثبت نشده." />
      )}

      {!error && transactions !== null && transactions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {transactions.map((transaction) => (
            <TransactionListItem key={transaction.id} transaction={transaction} />
          ))}
        </div>
      )}
    </section>
  );
}

function TransactionListItem({ transaction }: { transaction: TaggedTransaction }) {
  const incoming = IS_INCOMING[transaction.type];
  const date = new Date(transaction.createdAt).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
          <strong style={{ ...typography.body, fontWeight: 700, color: color.ink }}>
            {TYPE_LABEL[transaction.type]}
          </strong>
          <Badge tone="neutral">{KIND_LABEL[transaction.walletKind]}</Badge>
        </div>
        <strong style={{ ...typography.body, fontWeight: 800, color: incoming ? "#1f9d55" : color.ink }}>
          {incoming ? "+" : "−"}
          {formatToman(transaction.amount)}
        </strong>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>
          {transaction.description}
        </span>
        <span style={{ ...typography.caption, fontWeight: 400, color: color.muted, direction: "ltr" }}>
          {date}
        </span>
      </div>
    </Card>
  );
}
