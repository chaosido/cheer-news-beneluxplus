"use client";

import { usePathname } from "next/navigation";

/**
 * Hides the footer on "/" — the front page is a full-viewport map/agenda split
 * (panels sized to exactly fill the space under the header), and a footer below
 * it would make the page one footer taller than the screen, i.e. scroll.
 * All other routes keep the footer.
 */
export function ConditionalFooter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <>{children}</>;
}
