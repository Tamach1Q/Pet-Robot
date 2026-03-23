import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pet Robot",
  description: "High-level UI for elderly walking support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
