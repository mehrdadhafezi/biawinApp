import type { HTMLAttributes } from "react";
import { color, font, radius } from "../tokens";

export interface WalletCardProps extends HTMLAttributes<HTMLDivElement> {
  chipLabel: string;
  balanceLabel: string;
  currencyLabel: string;
}

/** Wallet balance summary card (prototype's `.profile-wallet-card` / `.reward-wallet-card`). */
export function WalletCard({ chipLabel, balanceLabel, currencyLabel, style, ...props }: WalletCardProps) {
  return (
    <div
      {...props}
      style={{
        fontFamily: font.family,
        background: `linear-gradient(135deg, ${color.primary}, ${color.deep})`,
        color: color.white,
        borderRadius: radius.xl,
        padding: 20,
        ...style,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <small style={{ opacity: 0.85, fontSize: 11 }}>کیف‌پول بیاوین</small>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1,
            background: "rgba(255,255,255,.18)",
            borderRadius: 999,
            padding: "4px 10px",
          }}
        >
          {chipLabel}
        </span>
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 6 }}>
        <strong style={{ fontSize: 27, fontWeight: 800 }}>{balanceLabel}</strong>
        <span style={{ fontSize: 12, opacity: 0.82 }}>{currencyLabel}</span>
      </div>
    </div>
  );
}
