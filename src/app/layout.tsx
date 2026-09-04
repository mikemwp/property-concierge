import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Property Concierge",
  description: "UK property purchase orchestration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
