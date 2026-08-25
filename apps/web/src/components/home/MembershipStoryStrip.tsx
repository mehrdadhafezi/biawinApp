import { color } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import { MEMBERSHIP_TIER_IMAGE } from "./home.mock";
import type { MembershipSummary } from "./useMembershipSummary";

/**
 * `.story-strip-section` — the 8 subscription-tier circles ("کارت‌های
 * اشتراک بیاوین"), real photos this time (Stage 5.13 correction — the
 * first pass used a 🎫 emoji instead of the prototype's actual per-tier
 * images, extracted this session — see docs/home-prototype-asset-map.md).
 * Keeps Stage 4.1's real `MembershipPlanDto` fetch (`tier !== null`) —
 * the backend already models exactly these 8 tiers, matched to their
 * real photo by the exact `plan.title` string. Tapping a tier would open
 * Card Detail, which doesn't exist yet — disabled, same as before.
 *
 * Stage 5.14.1 fix: live-staging asset audit found the "lifestyle" tier's
 * circle rendering with no image at all (silent lookup miss, not a broken
 * `<img>` — `MEMBERSHIP_TIER_IMAGE[plan.title]` returned `undefined`, so
 * the `? <img> : null` guard below correctly rendered nothing). Root
 * cause confirmed directly against `GET /subscriptions` on staging: every
 * other tier's real `plan.title` is prefixed `"کارت ..."`, but this one
 * tier's title is the bare `"سبک زندگی"` (no prefix) — `home.mock.ts`'s
 * map had been keyed `"کارت سبک زندگی"` since Stage 5.13, a guess that
 * never matched the live data. Fixed by correcting that one key.
 */
export function MembershipStoryStrip({ plans, error }: MembershipSummary) {
  if (error) return null;
  const tierPlans = plans?.filter((plan) => plan.tier !== null) ?? null;

  return (
    <section className="biawin-story-strip-section">
      <div className="biawin-story-strip-title">
        <strong>کارت‌های اشتراک بیاوین</strong>
        <small>روی هر کارت بزنید؛ استوری‌ها با تایمر نمایش داده می‌شوند و برای دیدن بقیه به چپ و راست ورق بزنید</small>
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
                className="biawin-story-circle-btn"
              >
                <span className="biawin-story-circle-ring">
                  <span className="biawin-story-circle-inner">
                    {MEMBERSHIP_TIER_IMAGE[plan.title] ? (
                      <img src={MEMBERSHIP_TIER_IMAGE[plan.title]} alt={plan.title} loading="lazy" />
                    ) : null}
                  </span>
                </span>
                <span className="biawin-story-circle-name">{plan.title}</span>
              </button>
            ))}
      </div>

      <style>{`
        .biawin-story-strip-section{padding:19px 12px 2px}
        .biawin-story-strip-title{padding:0 6px 8px}
        .biawin-story-strip-title strong{display:block;font-size:13px;font-weight:700;color:${color.ink}}
        .biawin-story-strip-title small{display:block;font-size:10px;color:${color.muted};margin-top:2px}
        .biawin-story-circle-track{display:flex;gap:13px;overflow-x:auto;scrollbar-width:none;padding:3px 1px 6px}
        .biawin-story-circle-track::-webkit-scrollbar{display:none}
        .biawin-story-circle-btn{all:unset;flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:not-allowed}
        .biawin-story-circle-ring{
          width:66px;height:66px;border-radius:50%;padding:3px;display:block;
          background:linear-gradient(145deg,#0a7cdc,#45bdff 58%,#ff983e);box-shadow:0 8px 20px rgba(8,121,220,.18);
        }
        .biawin-story-circle-inner{display:block;width:100%;height:100%;border-radius:50%;overflow:hidden;border:3px solid #fff;background:#fff}
        .biawin-story-circle-inner img{width:100%;height:100%;object-fit:cover}
        .biawin-story-circle-name{font-size:9px;font-weight:700;color:#234962;white-space:nowrap}

        @media(min-width:621px){
          .biawin-story-strip-section{padding-top:24px;padding-bottom:12px}
          .biawin-story-circle-track{gap:14px;padding:6px 4px 10px}
          .biawin-story-circle-ring{width:70px;height:70px}
          .biawin-story-circle-name{font-size:10px}
        }
      `}</style>
    </section>
  );
}
