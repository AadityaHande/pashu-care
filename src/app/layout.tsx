import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "PashuCare | Livestock Health Management",
  description: "A connected livestock health workspace for farm records, veterinary review, animal care and follow-up.",
  applicationName: "PashuCare",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "PashuCare" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" }
};

export const viewport: Viewport = {
  themeColor: "#244D3A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
