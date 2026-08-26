import type { ReactNode } from "react";
import { color, font } from "@biawin/ui";

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: ReactNode;
}

/** Shared label + control + validation-error slot, used by every field in every Home resource form. */
export function FormField({ label, required, error, hint, children }: FormFieldProps) {
  return (
    <label className="biawin-form-field">
      <span className="biawin-form-field-label">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="biawin-form-field-hint">{hint}</span>}
      {error && (
        <span role="alert" className="biawin-form-field-error">
          {error}
        </span>
      )}

      <style>{`
        .biawin-form-field{display:flex;flex-direction:column;gap:6px;font-family:${font.family};font-size:13px;font-weight:700;color:${color.ink}}
        .biawin-form-field-hint{font-size:11px;font-weight:400;color:${color.muted}}
        .biawin-form-field-error{font-size:11px;font-weight:700;color:#c0392b}
      `}</style>
    </label>
  );
}
