"use client";

import { useRouter } from "next/navigation";

interface QuickAction {
  key: string;
  label: string;
  route: string | null;
}

/**
 * `.home-quick-actions` — 4 shortcuts, pixel-matched to the prototype,
 * including the `@media(max-width:420px)` tightening (container radius/
 * gap/padding, item min-height/radius/gap/padding, icon-box size, label
 * size) re-added this session — the first pass had no responsive rule at
 * all for this section (Stage 5.13 correction). Unlike Stage 4.1's
 * `QuickActionsGrid` (which scrolled to an in-page section), 3 of these
 * now `router.push` to the real dedicated pages that exist today
 * (Services/Credit/Installments all shipped since Stage 6.1–9.1) — a
 * genuine capability upgrade, not a redesign, since those routes didn't
 * exist when the original grid was built. "افزایش موجودی" (wallet
 * top-up) has no backend (docs/wallet-ui-contract.md — Deposit is
 * BLOCKED) — real `disabled` (and `aria-label` carries the "به‌زودی"
 * hint for assistive tech).
 *
 * Stage 5.14.1 fix: this tile previously also rendered a *visible*
 * "به‌زودی" caption line below the button — not present in the
 * prototype at all, and with real visual side-effects: since
 * `.biawin-home-quick-actions-grid` is `display:grid` (default
 * `align-items:stretch` per row), that one extra text line stretched
 * *all four* tiles taller than the prototype's exact 68px/60px
 * `min-height`, which is also what made the gap down to Brand
 * Introduction look inflated. Same reasoning already applied to the
 * header's App Guide button (Stage 5.13) — a `disabled` control with an
 * `aria-label` communicates "not available yet" without adding visual
 * content the prototype never had.
 */
const QUICK_ACTIONS: QuickAction[] = [
  { key: "services", label: "پیدا کردن خدمت", route: "/services" },
  { key: "credit", label: "اعتبار من", route: "/credit" },
  { key: "installments", label: "اقساط من", route: "/installments" },
  { key: "topup", label: "افزایش موجودی", route: null },
];

export function QuickActions() {
  const router = useRouter();

  return (
    <section aria-label="میانبرهای کاربردی" className="biawin-home-quick-actions">
      <div className="biawin-home-quick-actions-grid">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            disabled={action.route === null}
            aria-label={action.route === null ? `${action.label} — به‌زودی` : action.label}
            onClick={() => action.route && router.push(action.route)}
            className="biawin-home-quick-action"
            style={{ cursor: action.route === null ? "not-allowed" : "pointer", opacity: action.route === null ? 0.6 : 1 }}
          >
              <span className="biawin-home-quick-icon">
                {action.key === "services" ? (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx={10} cy={10} r={6} />
                    <path d="m20 20-4.2-4.2" />
                  </svg>
                ) : action.key === "credit" ? (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x={4} y={5} width={16} height={14} rx={2} />
                    <path d="M8 9h8M8 13h5" />
                  </svg>
                ) : action.key === "installments" ? (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 5h10M7 10h10M7 15h7" />
                    <path d="M5 3h14v18H5z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                )}
              </span>
              <strong>{action.label}</strong>
          </button>
        ))}
      </div>

      <style>{`
        .biawin-home-quick-actions{padding:0 14px 14px;background:#fff}
        .biawin-home-quick-actions-grid{
          display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;padding:6px;
          border:1px solid #dfeaf3;border-radius:18px;background:#f8fbfe;
        }
        .biawin-home-quick-action{
          all:unset;box-sizing:border-box;min-width:0;width:100%;min-height:68px;
          border:1px solid #e0ebf4;border-radius:14px;background:#fff;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
          padding:7px 3px;color:#123f60;
        }
        .biawin-home-quick-icon{
          width:30px;height:30px;border-radius:10px;background:#eef7ff;color:#0879dc;
          display:grid;place-items:center;flex:0 0 auto;
        }
        .biawin-home-quick-action strong{
          display:block;font-size:8px;font-weight:800;line-height:1.2;white-space:nowrap;color:#123f60;
        }
        @media(max-width:420px){
          .biawin-home-quick-actions{padding-inline:10px;padding-bottom:12px}
          .biawin-home-quick-actions-grid{gap:5px;padding:5px;border-radius:16px}
          .biawin-home-quick-action{min-height:60px;border-radius:12px;gap:4px;padding:6px 2px}
          .biawin-home-quick-icon{width:28px;height:28px;border-radius:9px}
          .biawin-home-quick-icon svg{width:15px;height:15px}
          .biawin-home-quick-action strong{font-size:7.2px}
        }
      `}</style>
    </section>
  );
}
