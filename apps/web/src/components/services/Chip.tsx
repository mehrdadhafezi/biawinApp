import { color, font } from "@biawin/ui";

export interface ChipAccent {
  accent: string;
  deep: string;
}

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
 *
 * SERVICES-R2: exact values mined from the prototype's real
 * `.category-filter`/`.category-filter.active` CSS this stage (padding,
 * font-size/weight, inactive color, and the active state's
 * accent→deep gradient + colored shadow — R1 only had the accent's flat
 * color, not the real two-stop gradient the prototype actually uses).
 */
export function Chip({ label, active, onClick, accent }: { label: string; active: boolean; onClick: () => void; accent?: ChipAccent }) {
  const accentColor = accent?.accent ?? color.primary;
  const deepColor = accent?.deep ?? color.deep;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flexShrink: 0,
        fontFamily: font.family,
        fontSize: 10,
        fontWeight: 800,
        padding: "8px 12px",
        borderRadius: 999,
        border: active ? "1px solid transparent" : "1px solid #dbeaf8",
        background: active ? `linear-gradient(135deg, ${accentColor}, ${deepColor})` : color.white,
        boxShadow: active ? `0 9px 20px ${accentColor}2b` : "none",
        color: active ? color.white : "#668097",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
