import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resto+",
  description: "Socle de l’application Resto+ pour les restaurants en RDC.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr-CD" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
