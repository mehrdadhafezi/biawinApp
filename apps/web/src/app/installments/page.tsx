"use client";

import { useEffect, useState } from "react";
import { spacing } from "@biawin/ui";
import { SkeletonStyles } from "../../components/common/SkeletonBlock";
import { InstallmentSummaryCard } from "../../components/installment/InstallmentSummaryCard";
import { InstallmentList } from "../../components/installment/InstallmentList";
import { InstallmentDetail } from "../../components/installment/InstallmentDetail";
import { AppShell } from "../../components/shell/AppShell";
import { installmentApi, type InstallmentDto } from "../../lib/installment-api";
import { ApiError } from "../../lib/api-client";

/**
 * Installment Module v1 (docs/installment-ui-contract.md) — List + Detail
 * only, replacing Stage 5.2's placeholder. Detail is a client-side state
 * toggle rather than a new route, since the approved scope only named a
 * single `/installments` route. Payment Action/History/Creation are all
 * explicitly out of scope — no UI for them exists here at all.
 */
export default function InstallmentsPage() {
  const [installments, setInstallments] = useState<InstallmentDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    installmentApi
      .listInstallments()
      .then((data) => {
        if (!cancelled) setInstallments(data.items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "خطا در دریافت اقساط.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell activeNavKey="home">
      <SkeletonStyles />
      {selectedId ? (
        <InstallmentDetail installmentId={selectedId} onBack={() => setSelectedId(null)} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          {installments && installments.length > 0 && !error && (
            <InstallmentSummaryCard installments={installments} />
          )}
          <InstallmentList installments={installments} error={error} onSelect={setSelectedId} />
        </div>
      )}
    </AppShell>
  );
}
