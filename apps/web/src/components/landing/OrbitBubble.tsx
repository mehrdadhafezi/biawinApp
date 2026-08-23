import type { OrbitItem } from "./orbitItems";
import { ORBIT_FLOAT_DURATION_SECONDS } from "./orbitItems";

interface OrbitBubbleProps {
  item: OrbitItem;
}

/**
 * One floating category bubble on the Orbit Landing. Decorative — the
 * category label is not currently clickable in the prototype (all 13
 * bubbles have `aria-hidden="true"` there), so this mirrors that: it's a
 * visual element, not an interactive one.
 */
export function OrbitBubble({ item }: OrbitBubbleProps) {
  const durationSeconds = ORBIT_FLOAT_DURATION_SECONDS[item.variant];

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: `${item.leftPercent}%`,
        top: `${item.topPercent}%`,
        width: "19.4%",
        aspectRatio: "1",
        transform: "translate(-50%, -50%)",
        zIndex: 4,
        pointerEvents: "none",
      }}
      data-orbit-bubble-size
    >
      <div
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          willChange: "transform",
          animationName: `biawinOrbitFloat${item.variant.toUpperCase()}`,
          animationDuration: `${durationSeconds}s`,
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
          animationDelay: `${item.delaySeconds}s`,
        }}
        className="biawin-orbit-bubble-float"
      >
        {item.imageSrc ? (
          <img
            src={item.imageSrc}
            alt={item.label}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "50%",
              clipPath: "circle(47.2% at 50% 50%)",
              filter: "drop-shadow(0 8px 13px rgba(45,112,183,0.10))",
              userSelect: "none",
            }}
          />
        ) : (
          // Temporary placeholder — no real category art exists yet (the
          // prototype itself ships these bubbles with an empty src). Swap
          // `imageSrc` in orbitItems.ts once real assets are available;
          // this placeholder occupies the exact same box so layout never
          // has to change.
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(145deg, #eaf5ff, #d4e8fa)",
              border: "1px solid rgba(8,121,220,0.18)",
              boxShadow: "0 8px 13px rgba(45,112,183,0.10)",
              color: "#0a63b8",
              fontWeight: 800,
              fontSize: "clamp(11px, 3vw, 16px)",
            }}
          >
            {item.label.charAt(0)}
          </div>
        )}
      </div>
    </div>
  );
}
