"use client";

import { useState } from "react";
import type { CardProductDto } from "../../lib/services-api";
import { formatCardProductValue } from "./cardProductPresentation";

/**
 * Benefits — the prototype's `.detail-benefits-section` / `.detail-feature`
 * cards, fed by the REAL `CardProduct.benefits` (a plain `string[]`: no
 * per-benefit title/description/icon exists, so each string is the card's
 * single line and the icon tile is the prototype's neutral "✓", never an
 * invented per-benefit glyph). No benefits -> no section (same rule as
 * before this redesign).
 */
export function CardProductBenefits({ cardProduct }: { cardProduct: CardProductDto }) {
  if (cardProduct.benefits.length === 0) return null;

  return (
    <section className="cpd-section">
      <div className="cpd-section-head">
        <div>
          <h2>مزایای این کارت</h2>
          <p>مزایا و شرایطی که فقط برای همین کارت در نظر گرفته شده است.</p>
        </div>
      </div>
      <div className="cpd-features">
        {cardProduct.benefits.map((benefit, i) => (
          <div key={i} className="cpd-feature">
            <i aria-hidden="true">✓</i>
            <div>
              <strong>{benefit}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * GLOBAL, STATIC content — not CardProduct data. These three steps are the
 * prototype's own cardOnly "مراحل خرید این کارت" copy (`openServiceDetail()`
 * → `stepCopy`); the backend has no "process" concept at all, so every card
 * shows the same steps. Kept as one named constant so the distinction stays
 * visible and a future Admin-managed source can replace it in one place.
 *
 * NOTE for review: step 3 describes activation, which the product does not
 * do yet (a purchase currently ends at a pending, ready-for-payment Order —
 * payment/issuance is R5.27). The wording is the approved prototype's,
 * reproduced verbatim on purpose.
 */
export const CARD_PURCHASE_PROCESS: { number: string; title: string; text: string }[] = [
  { number: "۱", title: "بررسی شرایط کارت", text: "سقف، مزایا، مدت بازپرداخت و شرایط همین کارت را بررسی کنید." },
  { number: "۲", title: "ثبت درخواست خرید", text: "دکمه خرید این کارت را بزنید و اطلاعات موردنیاز را تایید کنید." },
  { number: "۳", title: "فعال‌سازی کارت", text: "پس از تایید نهایی، کارت برای استفاده در خدمات مربوطه فعال می‌شود." },
];

export function CardProductProcess() {
  return (
    <section className="cpd-section">
      <div className="cpd-section-head">
        <div>
          <h2>مراحل خرید این کارت</h2>
          <p>از بررسی شرایط تا فعال‌سازی کارت.</p>
        </div>
      </div>
      <div className="cpd-process">
        {CARD_PURCHASE_PROCESS.map((step) => (
          <div key={step.number} className="cpd-step">
            <span className="cpd-step-number">{step.number}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The FAQ is GLOBAL, STATIC content too — the prototype's own cardOnly FAQ
 * copy (`faqCopy`), identical for every card. There is no CardProduct-level
 * FAQ in the backend (`Service` has one, deliberately not shown here), so
 * the section heading is the prototype's generic "سؤالات متداول", not its
 * card-specific "سؤالات این کارت", to avoid claiming per-card content that
 * does not exist. The only card data used is interpolated into the first
 * answer exactly as the prototype does: the real title and real value.
 *
 * Same NOTE as `CARD_PURCHASE_PROCESS`: the second answer mentions tracking
 * activation from the user panel, which is not built yet; prototype wording
 * kept verbatim.
 */
export function cardFaqItems(cardProduct: CardProductDto): { question: string; answer: string }[] {
  const valueClause = cardProduct.valueAmount == null ? "" : `، سقف یا مزیت ${formatCardProductValue(cardProduct)}`;
  return [
    {
      question: "شرایط خرید این کارت چیست؟",
      answer: `شرایط دقیق ${cardProduct.title}${valueClause} و نحوه فعال‌سازی در همین صفحه نمایش داده شده است.`,
    },
    {
      question: "بعد از خرید چه اتفاقی می‌افتد؟",
      answer: "پس از ثبت و تایید درخواست، وضعیت فعال‌سازی کارت از داخل پنل کاربری قابل پیگیری است.",
    },
    {
      question: "آیا می‌توانم نوع کارت را در همین صفحه عوض کنم؟",
      answer: "خیر. این صفحه فقط مربوط به همین کارت است. برای انتخاب کارت دیگری باید به صفحه قبلی برگردید.",
    },
  ];
}

export function CardProductFaq({ cardProduct }: { cardProduct: CardProductDto }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const items = cardFaqItems(cardProduct);

  return (
    <section className="cpd-section">
      <div className="cpd-section-head">
        <div>
          <h2>سؤالات متداول</h2>
          <p>پاسخ چند سؤال رایج پیش از ثبت خرید.</p>
        </div>
      </div>
      <div className="cpd-faq">
        {items.map((item, i) => {
          const open = openIndex === i;
          return (
            <article key={item.question} className={`cpd-faq-item${open ? " open" : ""}`}>
              <button
                type="button"
                className="cpd-faq-question"
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : i)}
              >
                <span>{item.question}</span>
                <span aria-hidden="true">+</span>
              </button>
              <div className="cpd-faq-answer">{item.answer}</div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
