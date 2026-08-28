import { Input, color } from "@biawin/ui";

/**
 * Category View's product search — pixel-matched to `#categorySearch`
 * (`.category-search` label + magnifier SVG + `input`). Page-local state
 * only, client-side filter over the already-fetched category's services —
 * no backend change, same "fetch once, filter client-side" shape
 * `useServiceCatalog` already uses.
 *
 * Deliberately NOT the same control as `GlobalHeader`'s shell-level search
 * box (which stays disabled/shared — see
 * docs/services-r1-fidelity-report.md "Deferred" for why wiring that one
 * up is out of this stage's scope, a Home-shared-chrome change, not a
 * Services-local one).
 */
export function ServiceSearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label style={{ position: "relative", display: "block" }}>
      <svg
        viewBox="0 0 24 24"
        width={18}
        height={18}
        fill="none"
        stroke={color.primary}
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
        style={{ paddingInlineStart: 40 }}
      />
    </label>
  );
}
