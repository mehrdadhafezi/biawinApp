import { Input, color } from "@biawin/ui";

/**
 * Category View's product search — pixel-matched to the prototype's real
 * `.category-search` (mined this stage): `height:46px`, `border-radius:16px`,
 * `background:#f8fbfe`, `border:1px solid #d9e9f8`,
 * `box-shadow:0 9px 24px rgba(6,73,135,.06)`, and an icon stroked with the
 * category's own accent color (`stroke:var(--category-accent)` in the
 * prototype). Page-local state only, client-side filter over the
 * already-fetched category's services — no backend change, same "fetch
 * once, filter client-side" shape `useServiceCatalog` already uses.
 *
 * Deliberately NOT the same control as `GlobalHeader`'s shell-level search
 * box (which stays disabled/shared — see
 * docs/services-r1-fidelity-report.md "Deferred" for why wiring that one
 * up is out of this stage's scope, a Home-shared-chrome change, not a
 * Services-local one).
 *
 * Deliberate deviation from the prototype's `font-size:12px` input text —
 * kept at `Input`'s own 16px (see that component's own comment: under
 * 16px triggers iOS Safari's auto-zoom-on-focus). Not reverted for
 * "fidelity" — that would reintroduce a real, previously-fixed bug.
 */
export function ServiceSearchInput({
  value,
  onChange,
  placeholder,
  accent,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  accent?: string;
}) {
  return (
    <label style={{ position: "relative", display: "block" }}>
      <svg
        viewBox="0 0 24 24"
        width={18}
        height={18}
        fill="none"
        stroke={accent ?? color.primary}
        strokeWidth={2}
        aria-hidden="true"
        style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", insetInlineStart: 14, pointerEvents: "none" }}
      >
        <circle cx={11} cy={11} r={7} />
        <path d="m20 20-3.2-3.2" />
      </svg>
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          paddingInlineStart: 40,
          borderRadius: 16,
          background: "#f8fbfe",
          border: "1px solid #d9e9f8",
          boxShadow: "0 9px 24px rgba(6,73,135,.06)",
        }}
      />
    </label>
  );
}
