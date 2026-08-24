"use client";

import { useEffect, useState } from "react";
import { Badge, Card, WalletCard, breakpoint, color, spacing, typography } from "@biawin/ui";
import { ApiError } from "../../lib/api-client";
import { formatToman } from "../../lib/format";
import {
  homeApi,
  type CreditLineDto,
  type InstallmentDto,
  type WalletDto,
} from "../../lib/home-api";
import { SkeletonBlock } from "../common/SkeletonBlock";

const sectionTitleStyle = { margin: `0 0 ${spacing.sm}px`, ...typography.h3, color: color.deep };
const emptyStateStyle = { margin: 0, ...typography.body, color: color.muted };

function useFetch<T>(fetcher: () => Promise<T>): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, error };
}

function WalletsCard() {
  const { data: wallets, error } = useFetch(homeApi.listWallets);
  const main = wallets?.find((w) => w.kind === "main");
  const reward = wallets?.find((w) => w.kind === "reward");

  return (
    <div id="wallet-section">
      <h3 style={sectionTitleStyle}>کیف پول</h3>
      {error && <p style={{ ...emptyStateStyle, color: "#c0392b" }}>{error}</p>}
      {!error && !wallets && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <SkeletonBlock height={92} radiusPx={24} />
          <SkeletonBlock height={92} radiusPx={24} />
        </div>
      )}
      {!error && wallets && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          <WalletCard chipLabel="اصلی" balanceLabel={formatWalletBalance(main)} currencyLabel="" />
          <WalletCard
            chipLabel="جایزه"
            balanceLabel={formatWalletBalance(reward)}
            currencyLabel=""
            style={{ background: `linear-gradient(135deg, ${color.accentOrange}, #c96a12)` }}
          />
        </div>
      )}
    </div>
  );
}

function formatWalletBalance(wallet: WalletDto | undefined): string {
  return wallet ? formatToman(wallet.balance) : formatToman(0);
}

const creditStatusTone: Record<CreditLineDto["status"], "success" | "warning" | "neutral"> = {
  active: "success",
  suspended: "warning",
  closed: "neutral",
};
const creditStatusLabel: Record<CreditLineDto["status"], string> = {
  active: "فعال",
  suspended: "معلق",
  closed: "بسته‌شده",
};

function CreditCard() {
  const { data, error } = useFetch(homeApi.listCreditLines);
  const lines = data?.items ?? [];

  return (
    <div id="credit-section">
      <h3 style={sectionTitleStyle}>اعتبار من</h3>
      {error && <p style={{ ...emptyStateStyle, color: "#c0392b" }}>{error}</p>}
      {!error && data && lines.length === 0 && (
        <Card>
          <p style={emptyStateStyle}>هنوز خط اعتباری فعالی نداری.</p>
        </Card>
      )}
      {!error && data === null && <SkeletonBlock height={92} radiusPx={24} />}
      {!error &&
        lines.map((line) => {
          const available = line.limitAmount - line.usedAmount;
          const usedPercent = line.limitAmount > 0 ? Math.round((line.usedAmount / line.limitAmount) * 100) : 0;
          return (
            <Card key={line.id} style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ ...typography.h3, color: color.deep }}>{formatToman(available)}</strong>
                <Badge tone={creditStatusTone[line.status]}>{creditStatusLabel[line.status]}</Badge>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: color.line, overflow: "hidden" }}>
                <div
                  style={{ height: "100%", width: `${usedPercent}%`, background: color.primary, borderRadius: 999 }}
                />
              </div>
              <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>
                {formatToman(line.usedAmount)} از {formatToman(line.limitAmount)} استفاده‌شده
              </span>
            </Card>
          );
        })}
    </div>
  );
}

const installmentStatusTone: Record<InstallmentDto["status"], "info" | "success" | "warning" | "neutral"> = {
  active: "info",
  completed: "success",
  defaulted: "warning",
  cancelled: "neutral",
};
const installmentStatusLabel: Record<InstallmentDto["status"], string> = {
  active: "در حال پرداخت",
  completed: "تسویه‌شده",
  defaulted: "معوق",
  cancelled: "لغوشده",
};

function InstallmentsCard() {
  const { data, error } = useFetch(homeApi.listInstallments);
  const installments = data?.items ?? [];

  return (
    <div id="installments-section">
      <h3 style={sectionTitleStyle}>اقساط من</h3>
      {error && <p style={{ ...emptyStateStyle, color: "#c0392b" }}>{error}</p>}
      {!error && data && installments.length === 0 && (
        <Card>
          <p style={emptyStateStyle}>هنوز خرید اقساطی‌ای ثبت نشده.</p>
        </Card>
      )}
      {!error && data === null && <SkeletonBlock height={92} radiusPx={24} />}
      {!error && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
          {installments.map((installment) => (
            <Card key={installment.id} style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ ...typography.h3, color: color.deep }}>
                  {formatToman(installment.monthlyAmount)} / ماه
                </strong>
                <Badge tone={installmentStatusTone[installment.status]}>
                  {installmentStatusLabel[installment.status]}
                </Badge>
              </div>
              <span style={{ ...typography.caption, fontWeight: 400, color: color.muted }}>
                {installment.paidCount} از {installment.totalMonths} قسط پرداخت‌شده
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Wallet/Credit/Installment summary cards — docs/home-ui-contract.md §3/§4. */
export function AccountFinancialCards() {
  return (
    <section style={{ padding: `${spacing.xl}px ${spacing.xl}px 0` }}>
      <div className="biawin-home-financial-grid" style={{ display: "grid", gap: spacing.xl }}>
        <WalletsCard />
        <CreditCard />
        <InstallmentsCard />
      </div>
      <style>{`
        .biawin-home-financial-grid{ grid-template-columns: 1fr; }
        @media (min-width:${breakpoint.md}px){
          .biawin-home-financial-grid{ grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </section>
  );
}
