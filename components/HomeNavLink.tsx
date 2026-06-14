"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Window event the home view listens for to reset the map to the full-country
 * overview and clear any active selection/focus. Shared with `HomeView`.
 */
export const RESET_HOME_EVENT = "cheer:reset-home";

/**
 * The "Kaart & agenda" header link. Behaves like a normal link, except: when the
 * user is ALREADY on "/", clicking it doesn't re-navigate (which would be a
 * no-op the router ignores) but instead dispatches `RESET_HOME_EVENT`, which the
 * mounted `HomeView` catches to reset the map to "Heel Nederland" and clear the
 * current selection/province focus. Off "/", it just navigates home (the map
 * mounts fresh at the NL view anyway).
 */
export function HomeNavLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (pathname === "/") {
          e.preventDefault();
          window.dispatchEvent(new Event(RESET_HOME_EVENT));
        }
      }}
    >
      {label}
    </Link>
  );
}
