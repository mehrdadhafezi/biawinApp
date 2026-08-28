import { color, font } from "@biawin/ui";

/**
 * Shared chip visual for Services — extracted from `CategorySelector`'s
 * original inline chip (Stage 9.1) so `MethodFilterChips` (SERVICES-R1,
 * the P1 filter-chip fidelity fix) can reuse the identical look without
 * duplicating styles. Deliberately kept local to `components/services/`,
 * not promoted to `packages/ui`, per this stage's explicit instruction not
 * to globally mutate shared chip components — `docs/services-ui-contract.md`
 * §9 already flagged a real Chip/segmented-control primitive as a future
 * `packages/ui` candidate once a second, non-Services consumer exists;
 * this isn't that decision.
 */
export function Chip({ label, active, onClick, accent }: { label: string; active: boolean; onClick: () => void; accent?: string }) {
  const accentColor = accent ?? color.primary;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flexShrink: 0,
        fontFamily: font.family,
        fontSize: 13,
        fontWeight: 700,
        padding: "8px 16px",
        borderRadius: 999,
        border: `1px solid ${active ? accentColor : color.line}`,
        background: active ? accentColor : color.white,
        color: active ? color.white : color.ink,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
