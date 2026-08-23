import { LandingCenterCTA } from "./LandingCenterCTA";
import { OrbitBubble } from "./OrbitBubble";
import { ORBIT_NODES, ORBIT_RINGS, useOrbitItems } from "./orbitItems";
import { OrbitRing } from "./OrbitRing";

interface OrbitStageProps {
  onCenterClick: () => void;
}

/**
 * The full orbit visual: concentric rings, small marker nodes, 13 floating
 * category bubbles, the slogan, and the central CTA — all positioned
 * relative to this single stage container (mirrors the prototype's
 * `.biawin-orbit-motion-stage`, the shared positioning context for
 * everything inside it).
 */
export function OrbitStage({ onCenterClick }: OrbitStageProps) {
  const orbitItems = useOrbitItems();

  return (
    <div
      aria-label="خدمات و محصولات بیاوین"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "118%",
          aspectRatio: "1",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle, rgba(55,143,255,0.07) 0%, rgba(55,143,255,0.02) 43%, rgba(255,255,255,0) 70%)",
          filter: "blur(1px)",
        }}
      />

      {ORBIT_RINGS.map((ring, index) => (
        <OrbitRing key={index} widthPercent={ring.widthPercent} borderAlpha={ring.borderAlpha} />
      ))}

      {ORBIT_NODES.map((node, index) => (
        <span
          key={index}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: `${node.leftPercent}%`,
            top: `${node.topPercent}%`,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#0879ef",
            border: "1px solid rgba(255,255,255,0.9)",
            boxShadow: "0 0 0 2px rgba(20,117,236,0.08), 0 3px 8px rgba(0,91,214,0.28)",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      ))}

      {orbitItems.map((item) => (
        <OrbitBubble key={item.id} item={item} />
      ))}

      <div
        className="biawin-orbit-slogan"
        style={{
          position: "absolute",
          top: "5.2%",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          width: "min(88%, 560px)",
          textAlign: "center",
          color: "#0b4f91",
          fontSize: "clamp(14px, 3.8vw, 22px)",
          fontWeight: 900,
          lineHeight: 1.75,
          letterSpacing: "-0.25px",
          pointerEvents: "none",
          textShadow: "0 2px 14px rgba(255,255,255,0.95)",
        }}
      >
        بیاوین؛ هوشمندی در انتخاب، انعطاف در پرداخت
      </div>

      <LandingCenterCTA onClick={onCenterClick} />
    </div>
  );
}
