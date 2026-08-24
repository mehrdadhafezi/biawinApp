import { StoryCard, color, spacing, typography } from "@biawin/ui";

/**
 * Intro story strip — first section on the prototype's Home
 * (docs/01-prototype-analysis.md §2: "استوری‌های معرفی"), missing entirely
 * from the Stage 4.1 build per Stage 4.2's QA review. Same 4 topics as
 * `LandingPanels` (the prototype's story content is a single static set,
 * not duplicated per screen — see docs/prototype-to-production-mapping.md
 * §15). Static, no API — same as `LandingPanels`. Tapping a story would
 * open the full-screen Story Viewer (mapping.md §15), which doesn't exist
 * yet — disabled rather than silently inert.
 */
const STORIES = [
  { index: "۰۱", accent: "#1269b5", title: "کسب و کار" },
  { index: "۰۲", accent: "#168cd8", title: "چرا بیاوین" },
  { index: "۰۳", accent: "#f28a2d", title: "فرصت‌های خاص" },
  { index: "۰۴", accent: "#075db2", title: "کارت بیاوین" },
] as const;

export function HomeStories() {
  return (
    <section style={{ paddingTop: spacing.lg }}>
      <h2 style={{ margin: `0 ${spacing.xl}px ${spacing.md}px`, ...typography.h3, color: color.deep }}>
        معرفی بیاوین
      </h2>
      <div
        style={{
          display: "flex",
          gap: spacing.md,
          overflowX: "auto",
          padding: `0 ${spacing.xl}px ${spacing.xs}px`,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {STORIES.map((story) => (
          <StoryCard
            key={story.index}
            title={story.title}
            ringFrom={story.accent}
            ringTo={color.primary}
            disabled
            aria-label={`${story.title} — به‌زودی`}
            style={{ flex: "0 0 auto", cursor: "not-allowed", opacity: 0.85 }}
          >
            {story.index}
          </StoryCard>
        ))}
      </div>
    </section>
  );
}
