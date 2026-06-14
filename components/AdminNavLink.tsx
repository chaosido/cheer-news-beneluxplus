"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { clientAuth } from "@/lib/firebase";

/**
 * Renders an "Admin" nav link ONLY when the signed-in Google account is an
 * allowlisted admin. The allowlist itself is NEVER shipped to the client —
 * we ask the server (which holds ADMIN_EMAILS) by calling the admin endpoint
 * with the user's Firebase ID token; a non-401 response means the server
 * confirmed admin access. The /admin page + API still enforce the allowlist
 * server-side; this just hides the link from everyone else.
 */
export function AdminNavLink() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(clientAuth, async (u) => {
      if (!u) {
        if (!cancelled) setIsAdmin(false);
        return;
      }
      try {
        const token = await u.getIdToken();
        const res = await fetch("/api/admin/review?list=pending", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setIsAdmin(res.ok);
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  if (!isAdmin) return null;
  return (
    <Link
      href="/admin"
      className="rounded-full px-3 py-1.5 font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
    >
      Admin
    </Link>
  );
}
