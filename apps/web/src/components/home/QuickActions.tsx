"use client";

import { useRouter } from "next/navigation";
import { ComingSoonCaption } from "../common/ComingSoonCaption";

interface QuickAction {
  key: string;
  label: string;
  iconPaths: string[];
  route: string | null;
}

/**
 * `.home-quick-actions` — 4 shortcuts, pixel-matched to the prototype.
 * Unlike Stage 4.1's `QuickActionsGrid` (which scrolled to an in-page
 * section), 3 of these now `router.push` to the real dedicated pages that
 * exist today (Services/Credit/Installments all shipped since Stage
 * 6.1–9.1) — a genuine capability upgrade, not a redesign, since those
 * routes didn't exist when the original grid was built. "افزایش موجودی"
 * (wallet top-up) has no backend (docs/wallet-ui-contract.md — Deposit is
 * BLOCKED) — real `disabled` + "به‌زودی", same as every other unbuilt
 * feature in this app.
 */
const QUICK_ACTIONS: QuickAction[] = [
  { key: "services", label: "پیدا کردن خدمت", iconPaths: ["m20 20-4.2-4.2"], route: "/services" },
  { key: "credit", label: "اعتبار من", iconPaths: ["M8 9h8M8 13h5"], route: "/credit" },
  { key: "installments", label: "اقساط من", iconPaths: ["M7 5h10M7 10h10M7 15h7"], route: "/installments" },
  { key: "topup", label: "افزایش موجودی", iconPaths: ["M12 5v14M5 12h14"], route: null },
];

export function QuickActions() {
  const router = useRouter();

  return (
    <section aria-label="میانبرهای کاربردی" style={{ padding: "0 14px 14px", background: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 7, padding: 6, border: "1px solid #dfeaf3", borderRadius: 18, background: "#f8fbfe" }}>
        {QUICK_ACTIONS.map((action) => (
          <div key={action.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <button
              type="button"
              disabled={action.route === null}
              aria-label={action.route === null ? `${action.label} — به‌زودی` : action.label}
              onClick={() => action.route && router.push(action.route)}
              style={{
                minWidth: 0,
                width: "100%",
                minHeight: 68,
                border: "1px solid #e0ebf4",
                borderRadius: 14,
                background: "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "7px 3px",
                color: "#123f60",
                cursor: action.route === null ? "not-allowed" : "pointer",
                opacity: action.route === null ? 0.6 : 1,
              }}
            >
              <span style={{ width: 30, height: 30, borderRadius: 10, background: "#eef7ff", color: "#0879dc", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
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
              <strong style={{ display: "block", fontSize: 8, fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap", color: "#123f60" }}>
                {action.label}
              </strong>
            </button>
            {action.route === null && <ComingSoonCaption />}
          </div>
        ))}
      </div>
    </section>
  );
}
