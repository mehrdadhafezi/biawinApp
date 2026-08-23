interface LandingCenterCTAProps {
  onClick: () => void;
}

/** The single combined brand + login/signup button at the center of the orbit. */
export function LandingCenterCTA({ onClick }: LandingCenterCTAProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="ورود یا ثبت نام در بیاوین"
      className="biawin-orbit-center"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: "31.5%",
        aspectRatio: "1",
        transform: "translate(-50%, -50%)",
        borderRadius: "50%",
        border: 0,
        padding: 0,
        zIndex: 8,
        cursor: "pointer",
        background:
          "radial-gradient(circle at 43% 34%, #1687ff 0%, #0a6ff2 37%, #064fc9 72%, #043ba8 100%)",
        boxShadow:
          "0 0 0 10px rgba(93,174,255,0.10), 0 0 0 22px rgba(102,176,255,0.055), 0 12px 36px rgba(0,83,212,0.22), inset 0 2px 14px rgba(255,255,255,0.38)",
        color: "#fff",
        fontFamily: "inherit",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <strong
        style={{
          position: "relative",
          zIndex: 2,
          fontSize: "clamp(27px, 8.7vw, 56px)",
          fontWeight: 900,
          letterSpacing: "-1.5px",
          textShadow: "0 4px 9px rgba(0,40,119,0.28)",
        }}
      >
        بیاوین
      </strong>
      <small
        style={{
          position: "relative",
          zIndex: 2,
          color: "#eaf5ff",
          fontSize: "clamp(9px, 2.7vw, 13px)",
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        ورود / ثبت نام
      </small>
    </button>
  );
}
