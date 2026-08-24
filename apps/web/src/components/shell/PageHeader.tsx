import type { ReactNode } from "react";
import { color, spacing, typography } from "@biawin/ui";
import { SkeletonBlock } from "../common/SkeletonBlock";
import { GlobalHeader } from "./GlobalHeader";

export interface PageHeaderProps {
  /** From `currentUser`/`Profile`, never hardcoded (docs/navigation-route-contract.md §4). `null` while still loading. */
  firstName: string | null;
  /** The page-context line, e.g. "خلاصه حساب", "کیف پول", "پروفایل". */
  pageLabel: string;
  /** Home: "سلام {firstName}". Every other page: just "{firstName}". */
  greeting?: boolean;
  end?: ReactNode;
}

/**
 * `AppShell`'s composition of `GlobalHeader` — the dynamic-identity +
 * page-context pattern every screen uses (docs/navigation-route-contract.md
 * §4). Supersedes Stage 5.1's Home-only `HomeHeader`, which duplicated
 * this exact shape (greeting/name line + page-label line) as one-off JSX;
 * every future page gets it for free instead of re-implementing it.
 */
export function PageHeader({ firstName, pageLabel, greeting = false, end }: PageHeaderProps) {
  return (
    <GlobalHeader
      start={
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
          {firstName === null ? (
            <SkeletonBlock height={18} width={110} radiusPx={6} />
          ) : (
            <strong style={{ ...typography.h3, color: color.deep }}>
              {greeting ? `سلام ${firstName}` : firstName}
            </strong>
          )}
          <small style={{ ...typography.caption, color: color.muted }}>{pageLabel}</small>
        </div>
      }
      end={end}
    />
  );
}
