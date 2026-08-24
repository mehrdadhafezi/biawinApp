import { color, typography } from "@biawin/ui";

/**
 * Small "به‌زودی" caption for elements paired with a real `disabled` button
 * (Stage 4.2 QA finding: buttons that look tappable but silently do
 * nothing). Pass `disabled` on the interactive element itself — this is
 * only the visible explanation for why. Relocated from `components/home/`
 * in Stage 5.2 once a second page needed it.
 */
export function ComingSoonCaption() {
  return (
    <span style={{ ...typography.micro, color: color.muted, fontFamily: "inherit" }}>به‌زودی</span>
  );
}
