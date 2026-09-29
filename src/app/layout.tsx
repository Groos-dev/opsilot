import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Opsilot",
  description: "Opsilot — 不仅仅只是结算 / More than settlement",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
