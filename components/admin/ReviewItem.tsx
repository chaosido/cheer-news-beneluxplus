"use client";

/**
 * A single review-queue card: a public submission OR a pending scraped event.
 * Renders the payload as readable key/value rows and exposes Approve / Reject
 * buttons that delegate to the parent's `onAction` (which calls the API).
 */
import * as React from "react";
import { Check, Loader2, X } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SUBMISSION_KIND_LABEL } from "@/lib/submitSchema";
import { EVENT_TYPE_LABEL } from "@/lib/eventColors";
import type { EventClient, SubmissionClient } from "@/lib/types";

type Props =
  | {
      kind: "submission";
      submission: SubmissionClient;
      onAction: (action: "approve" | "reject") => Promise<boolean>;
    }
  | {
      kind: "event";
      event: EventClient;
      onAction: (action: "approve" | "reject") => Promise<boolean>;
    };

/** Render a payload object as label/value rows, skipping empty values. */
function PayloadRows({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(
    ([, val]) => val !== null && val !== undefined && val !== "",
  );
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--muted)]">(geen velden)</p>;
  }
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {entries.map(([key, val]) => (
        <React.Fragment key={key}>
          <dt className="font-medium text-[var(--muted)]">{key}</dt>
          <dd className="break-words text-[var(--ink)]">{String(val)}</dd>
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

export function ReviewItem(props: Props) {
  const [busy, setBusy] = React.useState<null | "approve" | "reject">(null);
  const [failed, setFailed] = React.useState(false);

  async function run(action: "approve" | "reject") {
    setBusy(action);
    setFailed(false);
    const ok = await props.onAction(action);
    if (!ok) {
      setFailed(true);
      setBusy(null);
    }
    // On success the parent unmounts this item, so no state reset needed.
  }

  const title =
    props.kind === "submission"
      ? SUBMISSION_KIND_LABEL[props.submission.kind]
      : props.event.title;

  const meta =
    props.kind === "submission"
      ? `Inzending · ${formatWhen(props.submission.createdAt)}`
      : `Gescraped evenement · ${EVENT_TYPE_LABEL[props.event.type]} · ${formatWhen(
          props.event.startsAt,
        )}`;

  return (
    <li>
      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-semibold">
                  {title}
                </h3>
                <Badge>
                  {props.kind === "submission" ? "Inzending" : "Event"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{meta}</p>
            </div>
          </div>

          {props.kind === "submission" ? (
            <PayloadRows payload={props.submission.payload} />
          ) : (
            <PayloadRows
              payload={{
                titel: props.event.title,
                type: EVENT_TYPE_LABEL[props.event.type],
                start: formatWhen(props.event.startsAt),
                locatie: props.event.locationText,
                url: props.event.url,
                omschrijving: props.event.description,
                confidence: props.event.confidence,
              }}
            />
          )}

          {failed && (
            <p className="text-xs text-[var(--accent)]">
              Actie mislukt. Probeer het opnieuw.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => void run("approve")}
              disabled={busy !== null}
            >
              {busy === "approve" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Check className="size-4" aria-hidden />
              )}
              Goedkeuren
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void run("reject")}
              disabled={busy !== null}
            >
              {busy === "reject" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <X className="size-4" aria-hidden />
              )}
              Afwijzen
            </Button>
          </div>
        </CardBody>
      </Card>
    </li>
  );
}
