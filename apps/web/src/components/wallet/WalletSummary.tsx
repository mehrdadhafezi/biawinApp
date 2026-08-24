"use client";

import { useEffect, useState } from "react";
import { breakpoint, color, spacing, typography } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { walletApi, type WalletDto } from "../../lib/wallet-api";
import { WalletErrorState } from "./WalletStates";
import { WalletOverviewCard } from "./WalletOverviewCard";

/**
 * Wallet Overview's balance section — fetches `GET /wallet` once, renders
 * both wallets. Independent of `TransactionList`'s own fetch (a failed
 * transaction load must not block this from rendering, per
 * docs/wallet-ui-contract.md §1/§4).
 */
export function WalletSummary() {
  const [wallets, setWallets] = useState<WalletDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    walletApi
      .listWallets()
      .then((result) => {
        if (!cancelled) setWallets(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "خطا در دریافت موجودی کیف پول.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const main = wallets?.find((w) => w.kind === "main");
  const reward = wallets?.find((w) => w.kind === "reward");

  return (
    <section style={{ padding: `${spacing.xl}px ${spacing.xl}px 0` }}>
      <h2 style={{ margin: `0 0 ${spacing.md}px`, ...typography.h3, color: color.deep }}>موجودی</h2>

      {error && <WalletErrorState message={error} />}

      {!error && (
        <div className="biawin-wallet-summary-grid" style={{ display: "grid", gap: spacing.sm }}>
          <WalletOverviewCard kind="main" wallet={wallets === null ? undefined : main} />
          <WalletOverviewCard kind="reward" wallet={wallets === null ? undefined : reward} />
        </div>
      )}

      <style>{`
        .biawin-wallet-summary-grid{ grid-template-columns: 1fr; }
        @media (min-width:${breakpoint.md}px){
          .biawin-wallet-summary-grid{ grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </section>
  );
}
