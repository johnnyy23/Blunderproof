import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blounderproof",
  description: "Cheap, practical opening training that actually sticks."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
