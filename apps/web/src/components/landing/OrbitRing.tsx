interface OrbitRingProps {
  widthPercent: number;
  borderAlpha: number;
}

/** One concentric decorative ring behind the orbit bubbles. Purely visual. */
export function OrbitRing({ widthPercent, borderAlpha }: OrbitRingProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${widthPercent}%`,
        aspectRatio: "1",
        borderRadius: "50%",
        transform: "translate(-50%, -50%)",
        border: `1px solid rgba(47,126,255,${borderAlpha})`,
        boxShadow: "0 0 18px rgba(54,137,255,0.025) inset",
        pointerEvents: "none",
      }}
    />
  );
}
