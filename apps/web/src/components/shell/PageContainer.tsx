import type { ReactNode } from "react";
import { layout } from "@biawin/ui";

/**
 * The scrollable content area inside `AppShell` — extracted from Home's
 * inline `<main>` (docs/app-shell-contract.md §2). Bottom padding reserves
 * space for `BottomNavigation` so content never renders underneath it.
 */
export function PageContainer({ children }: { children: ReactNode }) {
  return <main style={{ flex: 1, paddingBottom: layout.bottomNavHeight + 24 }}>{children}</main>;
}
