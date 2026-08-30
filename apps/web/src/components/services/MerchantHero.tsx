import { color, radius, spacing, typography } from "@biawin/ui";
import type { MerchantDto } from "../../lib/services-api";

/**
 * SERVICES-R4 — Merchant Detail's identity header. Deliberately minimal:
 * the prototype has NO Merchant Detail screen at all (confirmed
 * exhaustively this stage — zero matches for "merchant"/"فروشنده"/
 * "شعبه" anywhere in the 26MB prototype file, the third independent
 * confirmation of this exact fact across SERVICES-R1/R3/R4), so there is
 * no prototype visual to be faithful to. This renders only the 4 real
 * `Merchant` fields that exist in the schema — `name`, `description`,
 * `logoKey` (text fallback, same "no imageUrl resolver yet" pattern
 * every other Services image already uses), `active` (not shown
 * directly — an inactive merchant is still real data, just not
 * specially flagged here, matching how `Category`/`Service` handle
 * `active` today). No rating, branches, address, phone, or discount —
 * none of those exist in the real domain; see
 * docs/services-r4-merchant-detail-report.md for the full field matrix.
 */
export function MerchantHero({ merchant }: { merchant: MerchantDto }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.lg,
        border: `1px solid ${color.line}`,
        borderRadius: radius.xl,
        background: color.white,
        boxShadow: "0 9px 28px rgba(4,79,152,.08)",
      }}
    >
      <span
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
          background: color.ice,
          border: `1px solid ${color.line}`,
        }}
        aria-hidden="true"
      >
        🏬
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, minWidth: 0 }}>
        <span style={{ ...typography.caption, color: color.muted }}>فروشنده این خدمت</span>
        <h1 style={{ margin: 0, ...typography.h2, color: color.deep }}>{merchant.name}</h1>
        {merchant.description && <p style={{ margin: 0, ...typography.body, color: color.muted }}>{merchant.description}</p>}
      </div>
    </div>
  );
}
