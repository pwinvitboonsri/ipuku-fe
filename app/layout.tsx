import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { Providers } from "./providers";
import "./globals.css";

// Fonts are bundled (app/fonts, SIL OFL) instead of fetched from Google at build/dev time:
// no network dependency, works offline in the PWA, and avoids Turbopack's next/font/google
// failing on Google's newer multi-parameter font URLs. Variable weight files cover every weight used.
const dmSans = localFont({
  variable: "--font-dm-sans",
  src: "./fonts/DMSans-wght.woff2",
  weight: "100 1000",
  style: "normal",
  display: "swap",
});

const jetbrains = localFont({
  variable: "--font-jetbrains",
  src: "./fonts/JetBrainsMono-wght.woff2",
  weight: "100 800",
  style: "normal",
  display: "swap",
});

const newsreader = localFont({
  variable: "--font-newsreader",
  src: "./fonts/Newsreader-wght-italic.woff2",
  weight: "200 800",
  style: "italic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ippuku POS",
  description: "Counter POS and back office for Ippuku",
  applicationName: "Ippuku POS",
  appleWebApp: { capable: true, title: "Ippuku", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F5F1E8",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrains.variable} ${newsreader.variable}`}>
      <body className="safe-area h-dvh overflow-hidden">
        <Providers>{children}</Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
