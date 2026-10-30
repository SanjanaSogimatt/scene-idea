import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Outfit Search",
  description: "Describe the moment, get the outfit.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
