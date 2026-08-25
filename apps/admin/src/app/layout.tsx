import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import type { ReactNode } from "react";
import { AdminAuthProvider } from "../lib/auth/admin-auth-context";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "پنل مدیریت بیاوین",
  description: "Biawin Admin Portal",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
