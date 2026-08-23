import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth/auth-context";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "بیاوین",
  description: "باشگاه هوشمند تجربه‌های ارزشمند",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets safe-area-inset-* env() values resolve on iOS (used by the
  // bottom-sheet Auth modal). Deliberately NOT setting maximumScale/
  // userScalable:false — the actual iOS auto-zoom-on-focus bug is fixed at
  // its root cause (every input's font-size is >=16px now), so disabling
  // pinch-zoom outright isn't needed and would be an accessibility regression.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
