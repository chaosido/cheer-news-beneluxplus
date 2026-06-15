"use client";

/**
 * A single triage card: a public submission OR a pending scraped event.
 * Renders the payload as readable key/value rows, a free-text note (saved on
 * blur), and three decision buttons — Onbeslist / Akkoord / Oneens — that move
 * the card between the board's columns. Choosing a decision does NOT apply or
 * remove anything; it just records intent for the later batch step.
 */
import * as React from "react";
import { Check, X, CircleDashed } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { SUBMISSION_KIND_LABEL } from "@/lib/submitSchema";
import { EVENT_TYPE_LABEL } from "@/lib/eventColors";
import type {
  EventClient,
  SubmissionClient,
  ReviewDecision,
} from "@/lib/types";

type Decision = ReviewDecision | null;

interface Props {
  kind: "submission" | "event";
  submission?: SubmissionClient;
  event?: EventClient;
  decision: Decision;
  note: string;
  onDecide: (decision: Decision) => void;
  onNoteChange: (note: string) => void;
  /** Persist the note; resolves true on success. Called on blur (autosave). */
  onNoteSave: (note: string) => Promise<boolean>;
}

type NoteStatus = "idle" | "dirty" | "saving" | "saved" | "error";

/** Render a payload object as label/value rows, skipping empty values. */
function PayloadRows({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(
    ([, val]) => val !== null && val !== undefined && val !== "",
  );
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--muted)]">(geen velden)</p>;
  }
  return (
    <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {entries.map(([key, val]) => (
        <React.Fragment key={key}>
          <dt className="font-medium text-[var(--muted)]">{key}</dt>
          <dd className="min-w-0 text-[var(--ink)] [overflow-wrap:anywhere]">
            {String(val)}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

const DECISIONS: {
  key: Decision;
  label: string;
  icon: React.ReactNode;
  active: string;
}[] = [
  {
    key: null,
    label: "Onbeslist",
    icon: <CircleDashed className="size-3.5" aria-hidden />,
    active: "bg-[var(--surface-2)] text-[var(--ink)] border-[var(--border)]",
  },
  {
    key: "agreed",
    label: "Akkoord",
    icon: <Check className="size-3.5" aria-hidden />,
    active: "bg-emerald-500 text-white border-transparent",
  },
  {
    key: "disagreed",
    label: "Oneens",
    icon: <X className="size-3.5" aria-hidden />,
    active: "bg-[var(--accent)] text-[var(--accent-fg)] border-transparent",
  },
];

export function ReviewItem(props: Props) {
  const { kind, submission, event, decision, note } = props;
  const [noteStatus, setNoteStatus] = React.useState<NoteStatus>("idle");
  const [expanded, setExpanded] = React.useState(false);

  async function saveNote(value: string) {
    setNoteStatus("saving");
    const ok = await props.onNoteSave(value);
    setNoteStatus(ok ? "saved" : "error");
  }

  const title =
    kind === "submission" && submission
      ? SUBMISSION_KIND_LABEL[submission.kind]
      : (event?.title ?? "Event");

  const meta =
    kind === "submission" && submission
      ? `Inzending · ${formatWhen(submission.createdAt)}`
      : event
        ? `Gescraped · ${EVENT_TYPE_LABEL[event.type]} · ${formatWhen(event.startsAt)}`
        : "";

  const payload: Record<string, unknown> =
    kind === "submission" && submission
      ? submission.payload
      : event
        ? {
            titel: event.title,
            type: EVENT_TYPE_LABEL[event.type],
            start: formatWhen(event.startsAt),
            locatie: event.locationText,
            url: event.url,
            omschrijving: event.description,
          }
        : {};
  // Long research notes/blurbs would make a card tower over the column; collapse
  // by default and let the maintainer expand the few that need a closer read.
  const isLong = Object.values(payload).some(
    (v) => v != null && String(v).length > 180,
  );

  return (
    <li>
      <Card>
        <CardBody className="flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-semibold">{title}</h3>
              <Badge>{kind === "submission" ? "Inzending" : "Event"}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{meta}</p>
          </div>

          <div
            className={cn(
              "relative",
              isLong && !expanded && "max-h-28 overflow-hidden",
            )}
          >
            <PayloadRows payload={payload} />
            {isLong && !expanded && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--surface)] to-transparent" />
            )}
          </div>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              className="self-start text-xs font-medium text-[var(--accent)] hover:underline"
            >
              {expanded ? "Toon minder" : "Toon meer"}
            </button>
          )}

          {/* Note — autosaves on blur; status shown below so it's clear. */}
          <div className="flex flex-col gap-1">
            <textarea
              value={note}
              onChange={(e) => {
                props.onNoteChange(e.target.value);
                setNoteStatus("dirty");
              }}
              onBlur={(e) => void saveNote(e.target.value)}
              placeholder="Notitie (optioneel)…"
              rows={2}
              className="w-full resize-y rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
            <span className="h-3.5 text-[0.7rem] leading-none text-[var(--muted)]">
              {noteStatus === "dirty" && "Niet opgeslagen — klik buiten het veld"}
              {noteStatus === "saving" && "Opslaan…"}
              {noteStatus === "saved" && "Opgeslagen ✓"}
              {noteStatus === "error" && (
                <span className="text-[var(--accent)]">Opslaan mislukt</span>
              )}
            </span>
          </div>

          {/* Decision buttons */}
          <div className="flex flex-wrap gap-1.5">
            {DECISIONS.map((d) => {
              const isActive = decision === d.key;
              return (
                <button
                  key={String(d.key)}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => props.onDecide(d.key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? d.active
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
                  )}
                >
                  {d.icon}
                  {d.label}
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </li>
  );
}
