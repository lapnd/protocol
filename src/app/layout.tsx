import type { Metadata, Viewport } from "next";
import { THEME_INIT_SCRIPT } from "../kit/theme";
import { SITE } from "../site.config";
import "../kit/styles/kit.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.name, template: `%s · ${SITE.name}` },
  description: SITE.description,
  icons: {
    icon: [
      { url: `${basePath}/favicon.ico`, sizes: "16x16 32x32 48x48" },
      { url: `${basePath}/favicon.svg`, type: "image/svg+xml" },
    ],
    apple: `${basePath}/apple-touch-icon.png`,
  },
  manifest: `${basePath}/site.webmanifest`,
  openGraph: { type: "website", siteName: SITE.name, title: SITE.name, description: SITE.description },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={SITE.locales[0]} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
