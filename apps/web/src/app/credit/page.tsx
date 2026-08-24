"use client";

import { useEffect, useState } from "react";
import { spacing } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { creditApi, type CreditLineDto } from "../../lib/credit-api";
import { SkeletonBlock, SkeletonStyles } from "../../components/common/SkeletonBlock";
import { CreditOverviewCard } from "../../components/credit/CreditOverviewCard";
import { CreditEmptyState, CreditErrorState } from "../../components/credit/CreditStates";
import { CreditStatusCard } from "../../components/credit/CreditStatusCard";
import { AppShell } from "../../components/shell/AppShell";

/**
 * Credit Module v1 (docs/credit-ui-contract.md) — Credit Overview only:
 * limit/used/available + status. Usage History, Purchase-with-Credit,
 * Repayment, and Installment flow are all explicitly out of scope — no
 * UI for any of them exists on this page.
 *
 * A single `GET /credit` fetch backs the whole page (unlike Wallet,
 * which had two genuinely independent data sources — balance and
 * transactions — Credit has exactly one), so there's one shared loading/
 * empty/error state here rather than per-section ones.
 */
export default function CreditPage() {
  const [creditLines, setCreditLines] = useState<CreditLineDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    creditApi
      .listCreditLines()
      .then((result) => {
        if (!cancelled) setCreditLines(result.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات اعتبار.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const creditLine = creditLines?.[0];

  return (
    <AppShell activeNavKey="home">
      <SkeletonStyles />
      <div style={{ padding: `${spacing.xl}px ${spacing.xl}px 0`, display: "flex", flexDirection: "column", gap: spacing.md }}>
        {error && <CreditErrorState message={error} />}

        {!error && creditLines === null && (
          <>
            <SkeletonBlock height={140} radiusPx={24} />
            <SkeletonBlock height={64} radiusPx={18} />
          </>
        )}

        {!error && creditLines !== null && creditLines.length === 0 && (
          <CreditEmptyState message="هنوز خط اعتباری فعالی نداری." />
        )}

        {!error && creditLine && (
          <>
            <CreditOverviewCard creditLine={creditLine} />
            <CreditStatusCard creditLine={creditLine} />
          </>
        )}
      </div>
    </AppShell>
  );
}
