"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../../components/shell/AdminShell";
import { AdminRouteGuard } from "../../../../components/shell/AdminRouteGuard";
import { useAdminAuth } from "../../../../lib/auth/admin-auth-context";
import { canManageHomeContent } from "../../../../features/home/rbac";
import { NewsArticleForm } from "../../../../features/home/news/NewsArticleForm";

export default function NewNewsArticlePage() {
  return (
    <AdminRouteGuard mode="require-auth" redirectTo="/login">
      <AdminShell>
        <NewNewsArticleContent />
      </AdminShell>
    </AdminRouteGuard>
  );
}

function NewNewsArticleContent() {
  const router = useRouter();
  const { profile } = useAdminAuth();
  const canManage = canManageHomeContent(profile?.role);

  useEffect(() => {
    if (profile && !canManage) router.replace("/home/news");
  }, [profile, canManage, router]);

  if (!profile || !canManage) return null;

  return <NewsArticleForm mode="create" backHref="/home/news" onSaved={() => router.push("/home/news")} />;
}
