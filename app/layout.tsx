import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoteLoop — Study diagnostics for your own notes",
  description: "Check note coverage, test your understanding, and patch only what matters.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
