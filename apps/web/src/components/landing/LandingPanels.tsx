import { color, font, radius } from "@biawin/ui";

const PANELS = [
  { index: "۰۱", accent: "#1269b5", title: "کسب و کار با بیاوین", desc: "رشد فروش، جذب مشتری و ساخت یک ارتباط ماندگار در اکوسیستم بیاوین." },
  { index: "۰۲", accent: "#168cd8", title: "چرا بیاوین", desc: "یک مسیر هوشمند برای اعتبار، خدمات متنوع و خریدهای بزرگ‌تر." },
  { index: "۰۳", accent: "#f28a2d", title: "خاص‌ترین‌های بیاوین", desc: "جوایز، قرعه‌کشی‌ها و پیشنهادهایی که تجربه عضویت را متفاوت می‌کنند." },
  { index: "۰۴", accent: "#075db2", title: "کارت بیاوین", desc: "سطح مناسب عضویت را انتخاب کنید و به اعتبار و مزایای بیشتری برسید." },
];

/** The 4-panel intro grid (prototype's `.landing-grid`) — informational, non-interactive at this stage (story viewer is a later Feature). */
export function LandingPanels() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        width: "100%",
        maxWidth: 420,
      }}
    >
      {PANELS.map((panel) => (
        <div
          key={panel.index}
          style={{
            fontFamily: font.family,
            border: `1px solid ${color.line}`,
            borderRadius: radius.lg,
            padding: 14,
            background: color.white,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minHeight: 130,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800, color: panel.accent }}>{panel.index}</span>
          <strong style={{ fontSize: 13, color: color.deep }}>{panel.title}</strong>
          <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.8, color: color.muted }}>{panel.desc}</p>
        </div>
      ))}
    </div>
  );
}
