"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { color, font } from "@biawin/ui";

export interface AdminNavItem {
  id: string;
  title: string;
  href: string;
}

/**
 * Foundation-only nav list — just the one real route this stage ships
 * (`/dashboard`). Deliberately does NOT list placeholder entries for
 * Content/Media/etc.: those features don't exist yet and haven't had their
 * own IA decided, so a disabled stub here would be inventing navigation
 * structure ahead of the features it points at, not laying foundation for
 * them. Add real entries here as each feature stage actually ships one.
 */
const NAV_ITEMS: AdminNavItem[] = [{ id: "dashboard", title: "داشبورد", href: "/dashboard" }];

/**
 * Desktop-first admin chrome — deliberately its own layout, not a reuse of
 * `apps/web`'s mobile-capped `AppShell`/`BottomNavigation`
 * (docs/admin-architecture-decision-record.md §1/§6: Admin gets its own
 * layout components; only design *tokens* — color/font — are shared).
 */
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="ناوبری پنل مدیریت" className="biawin-admin-sidebar">
      <Link href="/dashboard" className="biawin-admin-sidebar-brand">
        <span aria-hidden="true" className="biawin-admin-sidebar-brand-mark" />
        <span className="biawin-admin-sidebar-brand-text">
          <strong>بیاوین</strong>
          <small>پنل مدیریت</small>
        </span>
      </Link>

      <ul className="biawin-admin-sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`biawin-admin-sidebar-link${active ? " biawin-admin-sidebar-link--active" : ""}`}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>

      <style>{`
        .biawin-admin-sidebar{
          width:240px;flex:0 0 240px;min-height:100dvh;
          background:${color.white};border-inline-end:1px solid ${color.line};
          display:flex;flex-direction:column;gap:8px;padding:18px 14px;
          font-family:${font.family};
        }
        .biawin-admin-sidebar-brand{display:flex;align-items:center;gap:10px;text-decoration:none;padding:0 6px 18px;border-bottom:1px solid ${color.line};margin-bottom:8px}
        .biawin-admin-sidebar-brand-mark{width:34px;height:34px;border-radius:11px;flex:0 0 auto;background:linear-gradient(145deg, ${color.primary}, ${color.deep})}
        .biawin-admin-sidebar-brand-text{display:flex;flex-direction:column;line-height:1.3}
        .biawin-admin-sidebar-brand-text strong{font-size:15px;font-weight:800;color:${color.deep}}
        .biawin-admin-sidebar-brand-text small{font-size:10px;color:${color.muted}}
        .biawin-admin-sidebar-nav{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
        .biawin-admin-sidebar-link{
          display:block;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:700;
          color:${color.ink};text-decoration:none;transition:background .15s ease,color .15s ease;
        }
        .biawin-admin-sidebar-link:hover{background:${color.ice}}
        .biawin-admin-sidebar-link--active{background:${color.ice};color:${color.primary}}
      `}</style>
    </nav>
  );
}
