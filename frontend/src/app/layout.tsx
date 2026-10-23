import type { Metadata } from "next";
import { Outfit } from "next/font/google";

import { themeBootScript } from "@/components/ThemeToggle";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PrepFella",
  description: "AI mock interviews that adapt to your role, your resume and every answer you give.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by themeBootScript before paint, so the server markup differs on purpose.
    <html lang="en" className={`${outfit.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
