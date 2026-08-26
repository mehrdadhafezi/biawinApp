"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, color, font } from "@biawin/ui";
import { ApiError } from "../../../lib/api-client";
import { homeHeroApi } from "../api/home-hero-api";
import { homeServiceBannerApi } from "../api/home-service-banner-api";
import { homeServiceMosaicApi } from "../api/home-service-mosaic-api";
import { homeNewsApi } from "../api/home-news-api";

interface ResourceSummary {
  label: string;
  href: string;
  total: number;
  active: number;
  inactive: number;
}

const RESOURCE_META = [
  { key: "hero", label: "کارت‌های ابتدایی", href: "/home/hero-cards" },
  { key: "banners", label: "بنرهای خدمات", href: "/home/service-banners" },
  { key: "mosaic", label: "موزاییک خدمات", href: "/home/service-mosaic" },
  { key: "news", label: "اخبار", href: "/home/news" },
] as const;

/**
 * Navigation + content-management awareness only — no charts, no
 * trends, no business analytics (explicitly out of scope, Stage 5.20 §2).
 * Counts are derived from each resource's own admin list response
 * (`total` from the API, `active`/`inactive` counted from the fetched
 * page — capped at the shared 100-row page limit, which comfortably
 * covers this content's real volume; a resource that ever exceeds that
 * would show a truncation note rather than a silently wrong count).
 */
export function HomeOverview() {
  const [summaries, setSummaries] = useState<ResourceSummary[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [hero, banners, mosaic, news] = await Promise.all([
          homeHeroApi.list(),
          homeServiceBannerApi.list(),
          homeServiceMosaicApi.list(),
          homeNewsApi.list(),
        ]);
        if (cancelled) return;

        const lists = [hero, banners, mosaic, news];
        setSummaries(
          RESOURCE_META.map((meta, index) => {
            const result = lists[index];
            const active = result.items.filter((item) => (item as { active: boolean }).active).length;
            return { label: meta.label, href: meta.href, total: result.total, active, inactive: result.items.length - active };
          }),
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof ApiError ? error.message : "دریافت اطلاعات نمای کلی با خطا مواجه شد.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ fontFamily: font.family }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: color.deep }}>مدیریت خانه</h1>
      <p style={{ marginTop: 8, marginBottom: 24, fontSize: 13, color: color.muted }}>
        نمای کلی محتوای صفحه خانه اپلیکیشن مشتری — چیدمان صفحه ثابت است، این بخش فقط محتوا را مدیریت می‌کند.
      </p>

      {errorMessage && (
        <p role="alert" style={{ fontSize: 12, fontWeight: 700, color: "#c0392b", marginBottom: 16 }}>
          {errorMessage}
        </p>
      )}

      {summaries === null && !errorMessage ? (
        <p style={{ fontSize: 13, color: color.muted }}>در حال بارگذاری…</p>
      ) : (
        <div className="biawin-home-overview-grid">
          {summaries?.map((summary) => (
            <Link key={summary.href} href={summary.href} className="biawin-home-overview-link">
              <Card>
                <strong className="biawin-home-overview-title">{summary.label}</strong>
                <div className="biawin-home-overview-stats">
                  <span>
                    <b>{summary.total}</b> کل
                  </span>
                  <span className="biawin-home-overview-active">
                    <b>{summary.active}</b> فعال
                  </span>
                  <span className="biawin-home-overview-inactive">
                    <b>{summary.inactive}</b> غیرفعال
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .biawin-home-overview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
        .biawin-home-overview-link{text-decoration:none;display:block}
        .biawin-home-overview-title{display:block;font-size:15px;font-weight:800;color:${color.deep};margin-bottom:12px}
        .biawin-home-overview-stats{display:flex;gap:14px;font-size:12px;color:${color.muted};flex-wrap:wrap}
        .biawin-home-overview-stats b{color:${color.ink};font-size:15px;display:block}
        .biawin-home-overview-active b{color:#1f9d55}
        .biawin-home-overview-inactive b{color:${color.muted}}
      `}</style>
    </div>
  );
}
