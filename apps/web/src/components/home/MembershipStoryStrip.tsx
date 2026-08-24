import { color } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import type { MembershipSummary } from "./useMembershipSummary";

/**
 * `.story-strip-section` — the 8 subscription-tier circles ("کارت‌های
 * اشتراک بیاوین"), pixel-matched to the prototype's `.story-circle-*`.
 * Unlike `BiawinCardsCarousel`'s 3 static demo cards, this keeps Stage
 * 4.1's real `MembershipPlanDto` fetch (`tier !== null`) — the backend
 * already models exactly these 8 tiers, so reusing real data here is
 * strictly better than inventing mock content the prototype's own copy
 * already has a live equivalent for. Tapping a tier would open Card
 * Detail, which doesn't exist yet — disabled, same as before.
 */
export function MembershipStoryStrip({ plans, error }: MembershipSummary) {
  if (error) return null;
  const tierPlans = plans?.filter((plan) => plan.tier !== null) ?? null;

  return (
    <section style={{ padding: "19px 12px 2px" }}>
      <div style={{ padding: "0 6px 8px" }}>
        <strong style={{ display: "block", fontSize: 13, fontWeight: 700, color: color.ink }}>کارت‌های اشتراک بیاوین</strong>
        <small style={{ display: "block", fontSize: 10, color: color.muted, marginTop: 2 }}>
          روی هر کارت بزنید؛ استوری‌ها با تایمر نمایش داده می‌شوند و برای دیدن بقیه به چپ و راست ورق بزنید
        </small>
      </div>
      <div className="biawin-story-circle-track">
        {tierPlans === null
          ? [0, 1, 2, 3, 4].map((i) => <SkeletonBlock key={i} height={66} width={66} radiusPx={999} />)
          : tierPlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                disabled
                aria-label={`${plan.title} — به‌زودی`}
                style={{ all: "unset", flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "not-allowed" }}
              >
                <span
                  style={{
                    width: 66,
                    height: 66,
                    borderRadius: "50%",
                    padding: 3,
                    background: `linear-gradient(145deg, ${plan.accentColor}, ${plan.deepColor} 58%, #ff983e)`,
                    boxShadow: "0 8px 20px rgba(8,121,220,.18)",
                    display: "block",
                  }}
                >
                  <span
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "3px solid #fff",
                      background: "#fff",
                      fontSize: 22,
                    }}
                    aria-hidden="true"
                  >
                    🎫
                  </span>
                </span>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#234962", whiteSpace: "nowrap" }}>{plan.title}</span>
              </button>
            ))}
      </div>

      <style>{`
        .biawin-story-circle-track{display:flex;gap:13px;overflow-x:auto;scrollbar-width:none;padding:3px 1px 6px}
        .biawin-story-circle-track::-webkit-scrollbar{display:none}
      `}</style>
    </section>
  );
}
