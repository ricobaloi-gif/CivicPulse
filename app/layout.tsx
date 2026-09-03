import type { Metadata } from "next";
import "./globals.css";

import { AuthProvider } from "@/src/lib/AuthContext";

export const metadata: Metadata = {
  title: "CivicPulse",
  description: "Community issue reporting platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}