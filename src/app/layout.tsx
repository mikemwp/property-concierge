import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
