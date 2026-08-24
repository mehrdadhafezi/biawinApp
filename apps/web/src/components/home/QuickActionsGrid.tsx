"use client";

import { Button, color, spacing, typography } from "@biawin/ui";
import { ComingSoonCaption } from "../common/ComingSoonCaption";

/**
 * Fixed, non-fetched shortcuts (docs/home-ui-contract.md §4 — `QuickAction`
 * is intentionally static config, not admin-managed content). The 3 with a
 * real target scroll to their matching card in `AccountFinancialCards`
 * rather than routing to a standalone screen (those screens are documented
 * as separate 🆕 screens in the contract, out of scope here). "خدمات" has
 * no target yet (Services isn't built) — real `disabled` + "به‌زودی" caption
 * instead of a button that looks tappable but silently does nothing
 * (Stage 4.2 QA finding).
 */
const QUICK_ACTIONS = [
  { key: "wallet", label: "کیف پول", icon: "💳", targetId: "wallet-section" },
  { key: "credit", label: "اعتبار من", icon: "📈", targetId: "credit-section" },
  { key: "installments", label: "اقساط من", icon: "🧾", targetId: "installments-section" },
  { key: "services", label: "خدمات", icon: "🛍️", targetId: null },
] as const;

export function QuickActionsGrid() {
  function handleClick(targetId: string | null) {
    if (!targetId) return;
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section style={{ padding: `${spacing.lg}px ${spacing.xl}px 0` }}>
      <h2 style={{ margin: `0 0 ${spacing.md}px`, ...typography.h3, color: color.deep }}>دسترسی سریع</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: spacing.sm }}>
        {QUICK_ACTIONS.map((action) => {
          const disabled = action.targetId === null;
          return (
            <div key={action.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                aria-label={disabled ? `${action.label} — به‌زودی` : action.label}
                onClick={() => handleClick(action.targetId)}
                style={{
                  flexDirection: "column",
                  gap: spacing.xs,
                  padding: `${spacing.md}px ${spacing.xs}px`,
                  ...typography.caption,
                  width: "100%",
                  opacity: disabled ? 0.6 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <span style={{ fontSize: 20 }} aria-hidden="true">
                  {action.icon}
                </span>
                {action.label}
              </Button>
              {disabled && <ComingSoonCaption />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
