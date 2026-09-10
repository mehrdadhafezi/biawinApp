"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, color, font } from "@biawin/ui";
import { ApiError } from "../../../lib/api-client";
import { categoriesAdminApi } from "../api/categories-admin-api";
import { servicesAdminApi } from "../api/services-admin-api";
import { cardProductsAdminApi } from "../api/card-products-admin-api";
import { categoryCardsAdminApi } from "../api/category-cards-admin-api";

interface ResourceSummary {
  label: string;
  href: string;
  total: number;
}

/** SERVICES-R5.17 — navigation awareness only, same scope discipline as HomeOverview (no analytics/charts). */
export function CatalogOverview() {
  const [summaries, setSummaries] = useState<ResourceSummary[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [categories, services, cardProducts, categoryCards] = await Promise.all([
          categoriesAdminApi.list(),
          servicesAdminApi.list(),
          cardProductsAdminApi.list(),
          categoryCardsAdminApi.list(),
        ]);
        if (cancelled) return;
        setSummaries([
          { label: "دسته‌بندی‌ها", href: "/catalog/categories", total: categories.total },
          { label: "کارت‌های دسته‌بندی", href: "/catalog/category-cards", total: categoryCards.total },
          { label: "خدمات", href: "/catalog/services", total: services.total },
          { label: "کارت‌های محصول", href: "/catalog/card-products", total: cardProducts.total },
        ]);
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
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: color.deep }}>مدیریت کاتالوگ</h1>
      <p style={{ marginTop: 8, marginBottom: 24, fontSize: 13, color: color.muted }}>
        مدیریت دسته‌بندی‌ها، خدمات و کارت‌های محصول — کاتالوگی که پیش از پیاده‌سازی رابط کاربری خرید مشتری آماده می‌شود.
      </p>

      {errorMessage && (
        <p role="alert" style={{ fontSize: 12, fontWeight: 700, color: "#c0392b", marginBottom: 16 }}>
          {errorMessage}
        </p>
      )}

      {summaries === null && !errorMessage ? (
        <p style={{ fontSize: 13, color: color.muted }}>در حال بارگذاری…</p>
      ) : (
        <div className="biawin-catalog-overview-grid">
          {summaries?.map((summary) => (
            <Link key={summary.href} href={summary.href} className="biawin-catalog-overview-link">
              <Card>
                <strong className="biawin-catalog-overview-title">{summary.label}</strong>
                <span className="biawin-catalog-overview-count">
                  <b>{summary.total}</b> مورد
                </span>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <style>{`
        .biawin-catalog-overview-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
        .biawin-catalog-overview-link{text-decoration:none;display:block}
        .biawin-catalog-overview-title{display:block;font-size:15px;font-weight:800;color:${color.deep};margin-bottom:12px}
        .biawin-catalog-overview-count{font-size:12px;color:${color.muted}}
        .biawin-catalog-overview-count b{color:${color.ink};font-size:20px;display:block}
      `}</style>
    </div>
  );
}
