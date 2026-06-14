"use client";

/**
 * Loads pending submissions + pending events via /api/admin/review (GET) using
 * the signed-in user's Firebase ID token, and renders them with approve/reject
 * actions. A 401 here means the email isn't allowlisted → "Geen toegang".
 */
import * as React from "react";
import type { User } from "firebase/auth";
import { Inbox, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { EventClient, SubmissionClient } from "@/lib/types";
import { ReviewItem } from "@/components/admin/ReviewItem";

interface ReviewQueueProps {
  user: User;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "forbidden" }
  | { phase: "error"; message: string }
  | { phase: "ready"; submissions: SubmissionClient[]; events: EventClient[] };

export function ReviewQueue({ user }: ReviewQueueProps) {
  const [state, setState] = React.useState<LoadState>({ phase: "loading" });

  const load = React.useCallback(async () => {
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/review?list=pending", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.status === 401) {
        setState({ phase: "forbidden" });
        return;
      }
      const data = (await res.json()) as {
        ok?: boolean;
        submissions?: SubmissionClient[];
        events?: EventClient[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setState({
          phase: "error",
          message: data.error ?? "Kon items niet laden.",
        });
        return;
      }
      setState({
        phase: "ready",
        submissions: data.submissions ?? [],
        events: data.events ?? [],
      });
    } catch {
      setState({ phase: "error", message: "Netwerkfout. Probeer opnieuw." });
    }
  }, [user]);

  React.useEffect(() => {
    // `load` only calls setState after an `await`, so this does not cause a
    // synchronous cascading render; the rule can't see across the callback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /** Manual refresh: show the loading state, then reload. */
  const refresh = React.useCallback(() => {
    setState({ phase: "loading" });
    void load();
  }, [load]);

  /** Optimistically remove an item once its action succeeds. */
  function removeItem(kind: "submission" | "event", id: string) {
    setState((prev) => {
      if (prev.phase !== "ready") return prev;
      return kind === "submission"
        ? { ...prev, submissions: prev.submissions.filter((s) => s.id !== id) }
        : { ...prev, events: prev.events.filter((e) => e.id !== id) };
    });
  }

  async function act(
    kind: "submission" | "event",
    id: string,
    action: "approve" | "reject",
  ): Promise<boolean> {
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/review", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ kind, id, action }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && data.ok) {
        removeItem(kind, id);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  if (state.phase === "loading") {
    return (
      <div className="flex justify-center py-16">
        <Loader2
          className="size-6 animate-spin text-[var(--muted)]"
          aria-hidden
        />
      </div>
    );
  }

  if (state.phase === "forbidden") {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="font-display text-lg font-semibold">
          Geen toegang met dit account
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Dit Google-account is geen beheerder. Log uit en probeer een ander
          account.
        </p>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm text-[var(--muted)]">{state.message}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={refresh}
        >
          <RefreshCw className="size-4" aria-hidden /> Opnieuw proberen
        </Button>
      </div>
    );
  }

  const total = state.submissions.length + state.events.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <span className="tabular-nums">{total} in de wachtrij</span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={refresh}>
          <RefreshCw className="size-4" aria-hidden /> Vernieuwen
        </Button>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] py-16 text-center">
          <Inbox className="size-8 text-[var(--muted)]" aria-hidden />
          <p className="text-sm text-[var(--muted)]">Niets te beoordelen. </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {state.submissions.map((s) => (
            <ReviewItem
              key={`sub:${s.id}`}
              kind="submission"
              submission={s}
              onAction={(action) => act("submission", s.id, action)}
            />
          ))}
          {state.events.map((e) => (
            <ReviewItem
              key={`evt:${e.id}`}
              kind="event"
              event={e}
              onAction={(action) => act("event", e.id, action)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
