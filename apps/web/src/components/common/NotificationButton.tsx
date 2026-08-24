import { color } from "@biawin/ui";
import { ComingSoonCaption } from "./ComingSoonCaption";

/**
 * The header notification bell. No unread badge yet — `GET
 * /notifications/unread-count` doesn't exist (documented gap,
 * docs/home-final-spec.md) and no notification feed screen exists either,
 * so it's a real `disabled` button with a "به‌زودی" caption rather than a
 * live-looking button that silently does nothing. Extracted from
 * `HomeHeader` in Stage 5.2 so any page's `GlobalHeader` `end` slot can
 * reuse it, not just Home's.
 */
export function NotificationButton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <button
        type="button"
        disabled
        aria-label="اعلان‌ها — به‌زودی"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: `1px solid ${color.line}`,
          background: color.ice,
          display: "grid",
          placeItems: "center",
          cursor: "not-allowed",
          opacity: 0.75,
          fontSize: 18,
        }}
      >
        🔔
      </button>
      <ComingSoonCaption />
    </div>
  );
}
