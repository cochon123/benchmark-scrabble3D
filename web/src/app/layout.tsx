import type { Metadata } from "next";

import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrabble 3D — Unaided Model Benchmark",
  description: "A fixed-dataset benchmark for exact-optimal Scrabble move generation in three dimensions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
        <footer className="site-footer">
          <div>
            <span>Scrabble 3D benchmark</span>
            <span>15 × 15 × 15 lattice · fixed dataset · one unaided move</span>
          </div>
          <a href="/protocol">Methodology</a>
        </footer>
      </body>
    </html>
  );
}
