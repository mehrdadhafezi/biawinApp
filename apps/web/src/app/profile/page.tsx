"use client";

import { PlaceholderContent } from "../../components/shell/PlaceholderContent";
import { AppShell } from "../../components/shell/AppShell";

/** Placeholder only — Profile feature is out of scope for Stage 5.2. */
export default function ProfilePage() {
  return (
    <AppShell activeNavKey="profile">
      <PlaceholderContent title="پروفایل" />
    </AppShell>
  );
}
