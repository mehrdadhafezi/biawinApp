"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { Button, color, font } from "@biawin/ui";

export interface HomeFormShellProps {
  title: string;
  backHref: string;
  onSubmit: (event: FormEvent) => void;
  submitting: boolean;
  errorMessage: string | null;
  /** `SUPPORT_VIEWER` reaching an edit URL directly — fields render disabled, no submit control. Backend still enforces this independently. */
  readOnly?: boolean;
  submitLabel?: string;
  children: ReactNode;
}

/** Shared surrounding chrome (title/back, error banner, submit+cancel with disabled-while-submitting) for every Home resource's create/edit form. */
export function HomeFormShell({ title, backHref, onSubmit, submitting, errorMessage, readOnly, submitLabel, children }: HomeFormShellProps) {
  return (
    <div style={{ fontFamily: font.family, maxWidth: 640 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: color.deep }}>{title}</h1>

      {readOnly && (
        <p className="biawin-home-form-readonly-note">
          دسترسی شما فقط مشاهده است — امکان ویرایش یا ذخیره وجود ندارد.
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="biawin-home-form">
        <fieldset disabled={submitting || readOnly} className="biawin-home-form-fieldset">
          {children}
        </fieldset>

        {errorMessage && (
          <p role="alert" className="biawin-home-form-error">
            {errorMessage}
          </p>
        )}

        <div className="biawin-home-form-actions">
          <Link href={backHref}>
            <Button type="button" variant="secondary">
              انصراف
            </Button>
          </Link>
          {!readOnly && (
            <Button type="submit" disabled={submitting}>
              {submitting ? "در حال ذخیره…" : (submitLabel ?? "ذخیره")}
            </Button>
          )}
        </div>
      </form>

      <style>{`
        .biawin-home-form-readonly-note{font-size:12px;font-weight:700;color:${color.muted};background:${color.ice};border-radius:10px;padding:10px 14px;margin:14px 0 0}
        .biawin-home-form{display:flex;flex-direction:column;gap:18px;margin-top:20px}
        .biawin-home-form-fieldset{border:none;padding:0;margin:0;display:flex;flex-direction:column;gap:18px}
        .biawin-home-form-fieldset:disabled{opacity:.7}
        .biawin-home-form-error{margin:0;font-size:12px;font-weight:700;color:#c0392b}
        .biawin-home-form-actions{display:flex;gap:10px;justify-content:flex-end}
      `}</style>
    </div>
  );
}
