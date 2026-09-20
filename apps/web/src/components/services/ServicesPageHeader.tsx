"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@biawin/ui";

export interface ServicesPageHeaderProps {
  /** Centered caption — "کارت‌های {دسته}" on the Category Landing, "جزئیات کارت" on Card Detail. */
  title: string;
  /** What the share action sends along with the page URL. */
  shareTitle: string;
  shareText: string | null;
  /** Where "back" goes when the browser has no history to go back to (a cold/bookmarked URL). */
  fallbackHref: string;
  /** The prototype's two headers differ only in caption weight/opacity: `.service-category-header` (900) vs `.service-detail-header` (800). */
  variant: "category" | "detail";
}

/**
 * The prototype's per-view sticky header — back button, centered caption,
 * share button (`.service-category-header` / `.service-detail-header`) —
 * shared by the Category Landing and Card Detail so both behave and look
 * the same, with real behavior on both controls:
 *
 * - Back: `router.back()` whenever the browser has history (identical to the
 *   native back button, so the Services -> Category -> Card back-stack is
 *   untouched), else `router.replace(fallbackHref)` so a cold/bookmarked
 *   URL never dead-ends or leaves the app.
 * - Share: the Web Share API where available, else copies the page URL —
 *   the same fallback the prototype's share handlers have — with the
 *   prototype's `.detail-toast` (`Toast`) confirming a copy.
 *
 * The caption is a `span`, not a heading: each page's `h1` is its hero title.
 * The bar sticks BELOW the sticky `GlobalHeader` (75px desktop / 63px at
 * <=620px — its padding + tallest control + border, see `GlobalHeader.tsx`),
 * not at `top: 0`, where it would slide underneath it.
 */
export function ServicesPageHeader({ title, shareTitle, shareText, fallbackHref, variant }: ServicesPageHeaderProps) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function showToast(message: string) {
    setToast(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2600);
  }

  function handleBack() {
    if (window.history.length > 1) router.back();
    else router.replace(fallbackHref);
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText ?? shareTitle, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast("پیوند صفحه کپی شد.");
      }
    } catch {
      // A dismissed share sheet rejects — that is the user's choice, not an error.
    }
  }

  return (
    <>
      <style>{`
        .svc-header{position:sticky;top:75px;z-index:45;display:grid;grid-template-columns:44px 1fr 44px;align-items:center;gap:10px;padding:11px 14px;background:rgba(255,255,255,.94);border-bottom:1px solid rgba(8,121,220,.09);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
        .svc-header--detail{background:rgba(255,255,255,.93)}
        .svc-header-title{text-align:center;font-size:15px;font-weight:900;color:#123b5f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .svc-header--detail .svc-header-title{font-weight:800}
        .svc-icon-btn{width:42px;height:42px;border:1px solid #d9eafb;border-radius:15px;background:#f7fbff;color:#0879dc;display:grid;place-items:center;box-shadow:0 8px 20px rgba(8,121,220,.08);padding:0;cursor:pointer}
        .svc-icon-btn svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
        @media(max-width:620px){.svc-header{top:63px}}
      `}</style>
      <header className={`svc-header svc-header--${variant}`}>
        <button type="button" className="svc-icon-btn" aria-label="بازگشت" onClick={handleBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
        <span className="svc-header-title">{title}</span>
        <button type="button" className="svc-icon-btn" aria-label="اشتراک‌گذاری" onClick={() => void handleShare()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
          </svg>
        </button>
      </header>
      {/* Outside the header on purpose: its `backdrop-filter` would become the containing block for this fixed toast. */}
      <Toast message={toast ?? ""} open={toast !== null} />
    </>
  );
}
