import { color } from "@biawin/ui";
import { HOME_STORIES } from "./home.mock";

const RING_GRADIENT: Record<string, string> = {
  why: "linear-gradient(145deg,rgba(8,121,220,.95),rgba(77,165,255,.75))",
  business: "linear-gradient(145deg,#0a78dd,#0a4ea4)",
  special: "linear-gradient(145deg,#ff9f2f,#ff6b00)",
  cards: "linear-gradient(145deg,#0f94ec,#0771d0)",
  credit: "linear-gradient(145deg,#12a1f2,#0d68c7)",
  installment: "linear-gradient(145deg,#36b0ff,#076fd6)",
  services: "linear-gradient(145deg,#0b77dc,#084ea4)",
  wallet: "linear-gradient(145deg,#14a6ec,#0a7dda)",
};

const ICON_PATHS: Record<string, { d: string; extra?: string }[]> = {
  why: [{ d: "M12 8v4m0 4h.01" }],
  business: [{ d: "M4 19V9m6 10V5m6 14v-7m4 7H2" }, { d: "m4 9 6-4 6 7 4-3" }],
  special: [{ d: "m12 3 2.4 5.1 5.6.8-4 3.9.9 5.5-4.9-2.7-4.9 2.7.9-5.5-4-3.9 5.6-.8Z" }],
  cards: [{ d: "M3 10h18M7 15h4" }],
  credit: [{ d: "M4 7h16" }, { d: "M7 14h5" }],
  installment: [{ d: "M8 7h8" }, { d: "M6 3v4m12-4v4" }, { d: "M7 12h10M7 16h4" }],
  services: [{ d: "m20 20-4.2-4.2" }],
  wallet: [{ d: "M5 8h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11" }, { d: "M16 12h5v4h-5a2 2 0 1 1 0-4Z" }],
};

const RECT_TOPICS = new Set(["cards"]);
const CIRCLE_TOPICS = new Set(["why", "services"]);

/**
 * `.home-stories` — 8 intro-story bubbles, pixel-matched to the prototype
 * (`biawin_single_file_app_requested_edits_v15.html` `.stories-strip`).
 * Purely decorative navigation into the intro story viewer, which doesn't
 * exist yet — every bubble is a real `disabled` button rather than a
 * silently-inert tap target.
 */
export function HomeStories() {
  return (
    <section
      aria-label="استوری‌های معرفی بیاوین"
      style={{ padding: "10px 14px 8px", background: "linear-gradient(180deg,#fff 0%,#f9fcff 100%)" }}
    >
      <div className="biawin-home-stories-strip">
        {HOME_STORIES.map((story) => (
          <button
            key={story.topic}
            type="button"
            disabled
            aria-label={`${story.title} — به‌زودی`}
            style={{
              flex: "0 0 auto",
              minWidth: 62,
              border: 0,
              background: "transparent",
              padding: 0,
              color: color.ink,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              cursor: "not-allowed",
            }}
          >
            <span
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                padding: 3,
                background: RING_GRADIENT[story.topic],
                boxShadow: "0 8px 18px rgba(8,121,220,.16)",
              }}
            >
              <span
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), rgba(255,255,255,.04) 38%, rgba(6,49,112,.96) 100%)",
                  display: "grid",
                  placeItems: "center",
                  border: "2px solid rgba(255,255,255,.86)",
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  width={22}
                  height={22}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,.18))" }}
                >
                  {RECT_TOPICS.has(story.topic) && <rect x={3} y={5} width={18} height={14} rx={3} />}
                  {CIRCLE_TOPICS.has(story.topic) && <circle cx={story.topic === "why" ? 12 : 10} cy={story.topic === "why" ? 12 : 10} r={story.topic === "why" ? 8 : 6} />}
                  {ICON_PATHS[story.topic]?.map((p, i) => (
                    <path key={i} d={p.d} />
                  ))}
                </svg>
              </span>
            </span>
            <span style={{ fontSize: 8.5, fontWeight: 700, lineHeight: 1.35, color: color.deep, textAlign: "center", whiteSpace: "nowrap" }}>
              {story.title}
            </span>
          </button>
        ))}
      </div>

      <style>{`
        .biawin-home-stories-strip{display:flex;gap:11px;overflow-x:auto;padding:2px 2px 6px;scrollbar-width:none;align-items:flex-start}
        .biawin-home-stories-strip::-webkit-scrollbar{display:none}
      `}</style>
    </section>
  );
}
