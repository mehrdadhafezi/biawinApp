"use client";

import { PlaceholderContent } from "../../components/shell/PlaceholderContent";
import { AppShell } from "../../components/shell/AppShell";

/** Placeholder only — Rewards feature is out of scope for Stage 5.2. */
export default function RewardsPage() {
  return (
    <AppShell activeNavKey="rewards">
      <PlaceholderContent title="جایزه" />
    </AppShell>
  );
}
