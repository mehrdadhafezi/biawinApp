"use client";

import { useRouter } from "next/navigation";
import { color, font } from "@biawin/ui";
import { useAdminAuth } from "../../lib/auth/admin-auth-context";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "مدیر ارشد",
  CONTENT_EDITOR: "ویرایشگر محتوا",
  SUPPORT_VIEWER: "پشتیبانی (فقط مشاهده)",
};

/** Foundation-level header: who's signed in, their role, and logout — no page-specific content yet. */
export function AdminHeader() {
  const router = useRouter();
  const { profile, logout } = useAdminAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <header className="biawin-admin-header">
      <div />
      {profile && (
        <div className="biawin-admin-header-profile">
          <span className="biawin-admin-header-role">{ROLE_LABEL[profile.role] ?? profile.role}</span>
          <span className="biawin-admin-header-name">
            <strong>{profile.fullName}</strong>
            <small>{profile.email}</small>
          </span>
          <button type="button" onClick={handleLogout} className="biawin-admin-header-logout">
            خروج
          </button>
        </div>
      )}

      <style>{`
        .biawin-admin-header{
          height:64px;flex:0 0 64px;display:flex;align-items:center;justify-content:space-between;
          padding:0 22px;background:${color.white};border-bottom:1px solid ${color.line};
          font-family:${font.family};
        }
        .biawin-admin-header-profile{display:flex;align-items:center;gap:12px}
        .biawin-admin-header-role{
          font-size:10px;font-weight:800;color:${color.primary};background:${color.ice};
          padding:5px 10px;border-radius:999px;white-space:nowrap;
        }
        .biawin-admin-header-name{display:flex;flex-direction:column;line-height:1.3;text-align:right}
        .biawin-admin-header-name strong{font-size:13px;font-weight:700;color:${color.ink}}
        .biawin-admin-header-name small{font-size:11px;color:${color.muted}}
        .biawin-admin-header-logout{
          border:1px solid ${color.line};background:${color.white};color:${color.ink};
          border-radius:10px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;
        }
        .biawin-admin-header-logout:hover{background:${color.ice}}
      `}</style>
    </header>
  );
}
