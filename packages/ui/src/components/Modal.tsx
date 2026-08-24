import type { HTMLAttributes, ReactNode } from "react";
import { breakpoint, color, radius, shadow } from "../tokens";

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Responsive dialog (prototype's `.auth-modal` / `.advisor-detail-modal`):
 * a full-width bottom sheet on phones, a centered dialog from
 * `breakpoint.sm` up (tablet/desktop). One component — the layout switch is
 * pure CSS (a media query in the scoped `<style>` below), not a JS
 * viewport check, so there's no hydration-mismatch flash and no
 * resize-driven re-render.
 *
 * Both layouts cap their own height and scroll their own body
 * (`.biawin-modal-body`) rather than the page — this is what keeps the
 * dialog reachable when the on-screen keyboard shrinks the visual
 * viewport, instead of content getting pushed off-screen.
 */
export function Modal({ open, onClose, children, style, ...props }: ModalProps) {
  if (!open) return null;
  return (
    <div role="presentation" onClick={onClose} className="biawin-modal-overlay">
      <div
        {...props}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        className="biawin-modal-panel"
        style={{ background: color.white, boxShadow: shadow.md, ...style }}
      >
        <span aria-hidden="true" className="biawin-modal-grabber" />
        <div className="biawin-modal-body">{children}</div>
      </div>

      <style>{`
        @keyframes biawinModalOverlayIn{from{opacity:0}to{opacity:1}}
        @keyframes biawinModalSheetIn{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes biawinModalDialogIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}

        .biawin-modal-overlay{
          position:fixed;inset:0;z-index:300;
          background:rgba(14,47,77,.45);
          display:flex;align-items:flex-end;justify-content:center;
          animation:biawinModalOverlayIn .18s ease-out;
        }
        .biawin-modal-panel{
          width:100%;
          max-height:88dvh;
          border-radius:${radius.xl}px ${radius.xl}px 0 0;
          padding:10px 20px calc(20px + env(safe-area-inset-bottom, 0px));
          display:flex;
          flex-direction:column;
          overflow:hidden;
          animation:biawinModalSheetIn .22s cubic-bezier(.22,.8,.36,1);
        }
        .biawin-modal-grabber{
          width:40px;height:4px;border-radius:999px;background:${color.line};
          margin:0 auto 14px;flex:0 0 auto;
        }
        .biawin-modal-body{
          overflow-y:auto;
          -webkit-overflow-scrolling:touch;
        }
        @media (min-width:${breakpoint.sm + 1}px){
          .biawin-modal-overlay{align-items:center;padding:20px;}
          .biawin-modal-panel{
            width:min(100%, 420px);
            max-height:85dvh;
            border-radius:${radius.xl}px;
            padding:24px;
            animation:biawinModalDialogIn .18s ease-out;
          }
          .biawin-modal-grabber{display:none;}
        }
        @media (prefers-reduced-motion:reduce){
          .biawin-modal-overlay,.biawin-modal-panel{animation:none;}
        }
      `}</style>
    </div>
  );
}
