/**
 * Admin review queue (Client page).
 *
 * Firebase Auth (Google sign-in) gates access. After sign-in we take the user's
 * ID token and call /api/admin/review with `Authorization: Bearer <token>`;
 * the server re-verifies the token AND checks the email allowlist, so the
 * client gate is convenience only — the server is the real boundary. A
 * non-allowlisted Google account signs in fine but the API returns 401, which
 * the queue renders as "Geen toegang".
 */
"use client";

import * as React from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { LogOut, Loader2 } from "lucide-react";
import { clientAuth } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { ReviewQueue } from "@/components/admin/ReviewQueue";

export default function AdminPage() {
  const [user, setUser] = React.useState<User | null>(null);
  const [authReady, setAuthReady] = React.useState(false);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(clientAuth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  if (!authReady) {
    return (
      <main className="mx-auto flex max-w-md items-center justify-center px-4 py-24">
        <Loader2
          className="size-6 animate-spin text-[var(--muted)]"
          aria-hidden
        />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-sm px-4 py-16">
        <SignIn />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Review queue
          </h1>
          <p className="text-sm text-[var(--muted)]">{user.email}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => signOut(clientAuth)}
        >
          <LogOut className="size-4" aria-hidden /> Uitloggen
        </Button>
      </div>
      <ReviewQueue user={user} />
    </main>
  );
}

function SignIn() {
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function handleGoogle() {
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(clientAuth, new GoogleAuthProvider());
    } catch (err) {
      console.error("[admin] Google sign-in failed:", err);
      setError("Inloggen met Google is mislukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Beheer
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Log in met Google om inzendingen te beoordelen.
        </p>
      </div>
      {error && (
        <p className="rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <Button size="lg" onClick={handleGoogle} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Inloggen met Google
      </Button>
    </div>
  );
}
