"use client";

import { color, font } from "@biawin/ui";
import { AdminLoginForm } from "../../components/auth/AdminLoginForm";
import { AdminRouteGuard } from "../../components/shell/AdminRouteGuard";

export default function AdminLoginPage() {
  return (
    <AdminRouteGuard mode="require-guest" redirectTo="/dashboard">
      <main className="biawin-admin-login-page">
        <div className="biawin-admin-login-card">
          <div className="biawin-admin-login-brand">
            <span aria-hidden="true" className="biawin-admin-login-brand-mark" />
            <div>
              <strong>بیاوین</strong>
              <small>پنل مدیریت</small>
            </div>
          </div>

          <AdminLoginForm />
        </div>

        <style>{`
          .biawin-admin-login-page{
            min-height:100dvh;display:flex;align-items:center;justify-content:center;
            padding:24px;font-family:${font.family};background:${color.ice};
          }
          .biawin-admin-login-card{
            width:100%;max-width:380px;background:${color.white};border:1px solid ${color.line};
            border-radius:20px;padding:32px 28px;box-shadow:0 18px 50px rgba(4,79,152,.13);
          }
          .biawin-admin-login-brand{display:flex;align-items:center;gap:12px;margin-bottom:26px}
          .biawin-admin-login-brand-mark{width:40px;height:40px;border-radius:14px;flex:0 0 auto;background:linear-gradient(145deg, ${color.primary}, ${color.deep})}
          .biawin-admin-login-brand strong{display:block;font-size:17px;font-weight:800;color:${color.deep}}
          .biawin-admin-login-brand small{display:block;font-size:11px;color:${color.muted};margin-top:2px}
        `}</style>
      </main>
    </AdminRouteGuard>
  );
}
