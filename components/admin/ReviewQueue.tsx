"use client";

/**
 * Triage board (Client Component).
 *
 * Loads pending submissions + pending events via /api/admin/review (GET) using
 * the signed-in user's Firebase ID token, and lays them out across THREE
 * columns by triage decision: Onbeslist (undecided) · Akkoord (agreed) · Oneens
 * (disagreed). Clicking a card's decision button only MOVES the card between
 * columns and persists the choice (POST action:"decide") — nothing is applied
 * or removed here. Each card also has a free-text note saved on blur.
 *
 * The maintainer triages everything, then the agreed/disagreed decisions + notes
 * are applied in a batch separately (read with `npm run submissions`). A 401
 * means the email isn't allowlisted → "Geen toegang".
 */
import * as React from "react";
import type { User } from "firebase/auth";
import { Inbox, Loader2, RefreshCw, Check, X, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import type {
  EventClient,
  SubmissionClient,
  ReviewDecision,
} from "@/lib/types";
import { ReviewItem } from "@/components/admin/ReviewItem";

type Decision = ReviewDecision | null;

interface Card {
  key: string;
  kind: "submission" | "event";
  id: string;
  submission?: SubmissionClient;
  event?: EventClient;
  decision: Decision;
  note: string;
}

interface ReviewQueueProps {
  user: User;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "forbidden" }
  | { phase: "error"; message: string }
  | { phase: "ready"; cards: Card[] };

export function ReviewQueue({ user }: ReviewQueueProps) {
  const { t } = useI18n();
  const [state, setState] = React.useState<LoadState>({ phase: "loading" });

  const columns: {
    key: Decision;
    label: string;
    icon: React.ReactNode;
    ring: string;
    chip: string;
  }[] = [
    {
      key: null,
      label: t.admin.columnUndecided,
      icon: <CircleDashed className="size-4" aria-hidden />,
      ring: "border-[var(--border)]",
      chip: "bg-[var(--surface-2)] text-[var(--muted)]",
    },
    {
      key: "agreed",
      label: t.admin.columnAgreed,
      icon: <Check className="size-4" aria-hidden />,
      ring: "border-emerald-500/40",
      chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    },
    {
      key: "disagreed",
      label: t.admin.columnDisagreed,
      icon: <X className="size-4" aria-hidden />,
      ring: "border-[var(--accent)]/40",
      chip: "bg-[var(--accent-soft)] text-[var(--accent)]",
    },
  ];

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
          message: data.error ?? t.admin.loadError,
        });
        return;
      }
      const cards: Card[] = [
        ...(data.submissions ?? []).map((s) => ({
          key: `sub:${s.id}`,
          kind: "submission" as const,
          id: s.id,
          submission: s,
          decision: (s.reviewDecision ?? null) as Decision,
          note: s.reviewNote ?? "",
        })),
        ...(data.events ?? []).map((e) => ({
          key: `evt:${e.id}`,
          kind: "event" as const,
          id: e.id,
          event: e,
          decision: (e.reviewDecision ?? null) as Decision,
          note: e.reviewNote ?? "",
        })),
      ];
      setState({ phase: "ready", cards });
    } catch {
      setState({ phase: "error", message: t.admin.networkError });
    }
  }, [user, t.admin.loadError, t.admin.networkError]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const refresh = React.useCallback(() => {
    setState({ phase: "loading" });
    void load();
  }, [load]);

  /** Persist a card's decision + note. Returns true on success. */
  const save = React.useCallback(
    async (card: Card, decision: Decision, note: string): Promise<boolean> => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/review", {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            kind: card.kind,
            id: card.id,
            action: "decide",
            decision: decision ?? "undecided",
            note,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
        return res.ok && Boolean(data.ok);
      } catch {
        return false;
      }
    },
    [user],
  );

  /** Update one card in place (optimistic). */
  function patchCard(key: string, next: { decision?: Decision; note?: string }) {
    setState((prev) => {
      if (prev.phase !== "ready") return prev;
      const cards = prev.cards.map((c) =>
        c.key === key
          ? {
              ...c,
              decision:
                next.decision !== undefined ? next.decision : c.decision,
              note: next.note !== undefined ? next.note : c.note,
            }
          : c,
      );
      return { ...prev, cards };
    });
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
          {t.admin.forbiddenTitle}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {t.admin.forbiddenBody}
        </p>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        <p className="text-sm text-[var(--muted)]">{state.message}</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={refresh}>
          <RefreshCw className="size-4" aria-hidden /> {t.admin.retry}
        </Button>
      </div>
    );
  }

  const { cards } = state;
  const decided = cards.filter((c) => c.decision !== null).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <span className="tabular-nums">
          {t.admin.counts(cards.length, decided)}
        </span>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={refresh}>
          <RefreshCw className="size-4" aria-hidden /> {t.admin.refresh}
        </Button>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)] py-16 text-center">
          <Inbox className="size-8 text-[var(--muted)]" aria-hidden />
          <p className="text-sm text-[var(--muted)]">
            {t.admin.nothingToReview}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {columns.map((col) => {
            const colCards = cards.filter((c) => c.decision === col.key);
            return (
              <section
                key={String(col.key)}
                className={cn(
                  "flex min-w-0 flex-col gap-3 rounded-[var(--radius)] border bg-[var(--surface-2)]/40 p-3",
                  col.ring,
                )}
              >
                <header className="flex items-center gap-2 px-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                      col.chip,
                    )}
                  >
                    {col.icon}
                    {col.label}
                  </span>
                  <span className="text-xs tabular-nums text-[var(--muted)]">
                    {colCards.length}
                  </span>
                </header>
                {/* Each column scrolls on its own so long cards never blow up
                    the page height. */}
                <ul className="flex max-h-[calc(100vh-14rem)] min-w-0 flex-col gap-3 overflow-y-auto pr-1">
                  {colCards.map((card) => (
                    <ReviewItem
                      key={card.key}
                      kind={card.kind}
                      submission={card.submission}
                      event={card.event}
                      decision={card.decision}
                      note={card.note}
                      onDecide={(decision) => {
                        patchCard(card.key, { decision });
                        void save(card, decision, card.note);
                      }}
                      onNoteChange={(note) => patchCard(card.key, { note })}
                      onNoteSave={(note) => save(card, card.decision, note)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
