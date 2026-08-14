"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/", "Benchmark"],
  ["/dataset", "Dataset"],
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Scrabble 3D benchmark home">
          <span className="brand-cube" aria-hidden="true" />
          <span className="brand-copy">
            <b>Scrabble 3D</b>
            <small>Unaided model benchmark</small>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          {links.map(([href, label]) => {
            const active = href === "/" ? pathname === "/" || pathname.startsWith("/runs") : pathname.startsWith(href);
            return <Link href={href} key={href} className={active ? "active" : ""}>{label}</Link>;
          })}
        </nav>
      </div>
    </header>
  );
}
