import { OrbitStage } from "./OrbitStage";

interface OrbitLandingProps {
  onLoginClick: () => void;
}

/**
 * The v16_clean "orbit" Landing — a full-viewport animated hero (concentric
 * rings, 13 floating category bubbles, slogan, central combined
 * brand/login button) that replaces the old 4-panel Landing entirely.
 *
 * Geometry/animation values below are ported directly from the prototype's
 * final resolved CSS cascade (biawin_single_file_app_requested_edits_v16_clean.html,
 * <style id="biawin-orbit-layout-safety-css"> + <style id="biawin-orbit-motion-bubbles-css">
 * + <style id="biawin-requested-edits-v16"> — these are the last, most
 * specific `!important` overrides in the file, so they are the ones that
 * actually render, not any of the ~90 earlier historical patch blocks).
 * These values are Landing-specific geometry, not general design tokens —
 * intentionally kept local to this component rather than added to
 * packages/ui/src/tokens.ts.
 */
export function OrbitLanding({ onLoginClick }: OrbitLandingProps) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "radial-gradient(circle at 50% 49%, #fff 0%, #fbfdff 52%, #f5f8fc 100%)",
      }}
    >
      <OrbitStage onCenterClick={onLoginClick} />

      {/* Scoped to Landing only — keyframes, pseudo-elements, and the two
          breakpoints the prototype defines (≤430px bubble/CTA sizing,
          ≤620px slogan sizing), plus prefers-reduced-motion. */}
      <style>{`
        @keyframes biawinOrbitFloatA{0%,100%{transform:translate3d(0,0,0) scale(1)}25%{transform:translate3d(3px,-5px,0) scale(1.012)}55%{transform:translate3d(-4px,1px,0) scale(.994)}78%{transform:translate3d(2px,4px,0) scale(1.006)}}
        @keyframes biawinOrbitFloatB{0%,100%{transform:translate3d(0,0,0) scale(1)}28%{transform:translate3d(-4px,-3px,0) scale(1.008)}52%{transform:translate3d(3px,4px,0) scale(.996)}80%{transform:translate3d(5px,-1px,0) scale(1.01)}}
        @keyframes biawinOrbitFloatC{0%,100%{transform:translate3d(0,0,0) scale(1)}22%{transform:translate3d(2px,5px,0) scale(.995)}48%{transform:translate3d(5px,-3px,0) scale(1.012)}74%{transform:translate3d(-4px,-2px,0) scale(1.002)}}
        @keyframes biawinOrbitFloatD{0%,100%{transform:translate3d(0,0,0) scale(1)}30%{transform:translate3d(-3px,4px,0) scale(1.01)}58%{transform:translate3d(4px,2px,0) scale(.997)}82%{transform:translate3d(-1px,-5px,0) scale(1.006)}}
        @keyframes biawinOrbitCenterHalo{0%,100%{transform:scale(.985);opacity:.55}50%{transform:scale(1.035);opacity:1}}

        .biawin-orbit-center::before{content:"";position:absolute;inset:7%;border-radius:50%;border:1px solid rgba(255,255,255,.50);box-shadow:inset 0 0 14px rgba(255,255,255,.18);}
        .biawin-orbit-center::after{content:"";position:absolute;inset:-8%;border-radius:50%;border:1px solid rgba(77,151,255,.22);animation:biawinOrbitCenterHalo 3.7s ease-in-out infinite;}
        .biawin-orbit-center:focus-visible{outline:3px solid #ffffff;outline-offset:4px;box-shadow:0 0 0 3px #0879dc,0 0 0 10px rgba(93,174,255,.10),0 0 0 22px rgba(102,176,255,.055),0 12px 36px rgba(0,83,212,.22),inset 0 2px 14px rgba(255,255,255,.38);}

        @media (max-width:430px){
          [data-orbit-bubble-size]{width:20.4%!important;}
          .biawin-orbit-center{width:32.5%!important;}
        }
        @media (max-width:620px){
          .biawin-orbit-slogan{top:4.2%!important;width:90%!important;font-size:13px!important;}
        }
        @media (prefers-reduced-motion:reduce){
          .biawin-orbit-bubble-float,.biawin-orbit-center::after{animation:none!important;}
        }
      `}</style>
    </div>
  );
}
