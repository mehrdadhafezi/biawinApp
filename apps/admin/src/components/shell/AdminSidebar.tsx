"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { color, font } from "@biawin/ui";

export interface AdminNavItem {
  id: string;
  title: string;
  href: string;
  children?: AdminNavItem[];
}

/**
 * Only routes that actually exist. `/home` (Stage 5.20) manages the Stage
 * 5.19 Home CMS resources — its 4 children are real pages, not
 * placeholders. `/media` (Stage 5.18) stays a flat item; Home is the
 * first nav entry with a nested group, so `NAV_ITEMS` now supports
 * `children` generically rather than hardcoding a Home-only shape.
 */
const NAV_ITEMS: AdminNavItem[] = [
  { id: "dashboard", title: "داشبورد", href: "/dashboard" },
  {
    id: "home",
    title: "خانه",
    href: "/home",
    children: [
      { id: "home-hero-cards", title: "کارت‌های ابتدایی", href: "/home/hero-cards" },
      { id: "home-service-banners", title: "بنرهای خدمات", href: "/home/service-banners" },
      { id: "home-service-mosaic", title: "موزاییک خدمات", href: "/home/service-mosaic" },
      { id: "home-news", title: "اخبار", href: "/home/news" },
    ],
  },
  { id: "media", title: "کتابخانه رسانه", href: "/media" },
];

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
          // A parent with children (e.g. "خانه") is only "active" on its own
          // overview page — a child route being active is shown on the
          // child link itself, not duplicated onto the parent.
          const active = item.children ? pathname === item.href : pathname?.startsWith(item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`biawin-admin-sidebar-link${active ? " biawin-admin-sidebar-link--active" : ""}`}
              >
                {item.title}
              </Link>
              {item.children && (
                <ul className="biawin-admin-sidebar-subnav">
                  {item.children.map((child) => {
                    const childActive = pathname?.startsWith(child.href);
                    return (
                      <li key={child.id}>
                        <Link
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          className={`biawin-admin-sidebar-sublink${childActive ? " biawin-admin-sidebar-sublink--active" : ""}`}
                        >
                          {child.title}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
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
        .biawin-admin-sidebar-subnav{list-style:none;margin:2px 0 4px;padding-inline-end:14px;display:flex;flex-direction:column;gap:2px}
        .biawin-admin-sidebar-sublink{
          display:block;padding:8px 12px;border-radius:9px;font-size:12px;font-weight:600;
          color:${color.muted};text-decoration:none;transition:background .15s ease,color .15s ease;
        }
        .biawin-admin-sidebar-sublink:hover{background:${color.ice};color:${color.ink}}
        .biawin-admin-sidebar-sublink--active{background:${color.ice};color:${color.primary};font-weight:800}
      `}</style>
    </nav>
  );
}
