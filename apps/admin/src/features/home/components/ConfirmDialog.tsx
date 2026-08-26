"use client";

import { Button, Modal, color, font } from "@biawin/ui";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  errorMessage?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared destructive-action confirmation — shows what's being removed, disables both actions while the request is in flight, and surfaces a backend failure inline instead of just closing silently. */
export function ConfirmDialog({ open, title, description, confirmLabel, busy, errorMessage, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel}>
      <div style={{ fontFamily: font.family }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: color.deep }}>{title}</h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: color.muted, lineHeight: 1.8 }}>{description}</p>
        {errorMessage && (
          <p role="alert" style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 700, color: "#c0392b" }}>
            {errorMessage}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
            انصراف
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy} style={{ background: "#c0392b" }}>
            {busy ? "در حال حذف…" : (confirmLabel ?? "حذف")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
