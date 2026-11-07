import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// designPRD 2.1: polished sans for controls/body, elegant serif for headings.
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: { default: "Clearance", template: "%s | Clearance" },
  description: "Nothing goes live without clearance. Brand-aware pre-publication review and approval.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-dvh antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
