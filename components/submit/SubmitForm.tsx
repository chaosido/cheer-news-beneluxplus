"use client";

/**
 * Public submission form (Client Component).
 *
 * - Requires Google sign-in (any account): submitting is gated for
 *   accountability / anti-spam. When signed out we show a sign-in button; when
 *   signed in we show the form plus the user's email and a sign-out link, and
 *   send the Firebase ID token as `Authorization: Bearer <token>`.
 * - Kind picker (event / gym / club / correction) toggles the field set.
 * - Hidden honeypot input (`website_url2`) — bots fill it; humans never see it.
 * - Turnstile widget rendered ONLY when a site key is provided; it's now
 *   redundant with the login gate but left in place. The server skips it when a
 *   valid login is present.
 * - Submits JSON to /api/submit and surfaces success + per-field/global errors.
 *
 * Validation contract is shared with the server via lib/submitSchema.ts.
 */
import * as React from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { CheckCircle2, Loader2, LogIn, Send } from "lucide-react";
import { clientAuth } from "@/lib/firebase";
import { Button } from "@/components/ui/Button";
import { SUBMISSION_KIND_LABEL, eventPayloadSchema, submissionInputSchema } from "@/lib/submitSchema";
import { EVENT_TYPE_LABEL } from "@/lib/eventColors";
import type { SubmissionKind } from "@/lib/types";
import { TextField, TextAreaField, SelectField } from "@/components/submit/Field";

/**
 * The schema's *input* (pre-transform) shape — what `submissionInputSchema`
 * accepts before parsing. Typing `buildPayload` against this (rather than the
 * post-transform `SubmissionInput`) lets the flat string bag flow through
 * without casts while still catching drift if the schema's fields change.
 */
type SubmissionInputShape = Parameters<typeof submissionInputSchema.parse>[0];

const KINDS: SubmissionKind[] = ["event", "gym", "club", "correction"];

const KIND_HELP: Record<SubmissionKind, string> = {
  event: "Een wedstrijd, clinic, tryout, showcase of andere eenmalige activiteit.",
  gym: "Een terugkerend open-gym moment bij een club.",
  club: "Een club, studententeam, schoolteam of selectieteam dat nog niet op de kaart staat.",
  correction: "Klopt er iets niet of ontbreekt er iets? Beschrijf het hieronder.",
};

const EVENT_TYPE_OPTIONS = [
  "competition",
  "open_gym",
  "clinic",
  "tryout",
  "showcase",
  "training",
  "other",
].map((v) => ({ value: v, label: EVENT_TYPE_LABEL[v as keyof typeof EVENT_TYPE_LABEL] }));

type FieldErrors = Record<string, string[] | undefined>;

interface SubmitFormProps {
  turnstileSiteKey: string | null;
}

export function SubmitForm({ turnstileSiteKey }: SubmitFormProps) {
  const [user, setUser] = React.useState<User | null>(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [signInBusy, setSignInBusy] = React.useState(false);
  const [signInError, setSignInError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(clientAuth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  async function handleSignIn() {
    setSignInBusy(true);
    setSignInError(null);
    try {
      await signInWithPopup(clientAuth, new GoogleAuthProvider());
    } catch (err) {
      console.error("[submit] Google sign-in failed:", err);
      setSignInError("Inloggen met Google is mislukt. Probeer het opnieuw.");
    } finally {
      setSignInBusy(false);
    }
  }

  const [kind, setKind] = React.useState<SubmissionKind>("event");
  // Single flat field bag keyed by field name; per-kind subset is read on submit.
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = React.useState("");
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success">("idle");

  function set(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }
  function v(name: string): string {
    return values[name] ?? "";
  }
  function err(name: string): string | undefined {
    return fieldErrors[name]?.[0];
  }

  function changeKind(next: SubmissionKind) {
    setKind(next);
    setFieldErrors({});
    setGlobalError(null);
  }

  /**
   * Build the typed payload for the selected kind from the flat bag.
   *
   * Typed against the schema's *input* (pre-transform) shape so plain strings
   * from the flat bag are accepted without casts; the server re-validates with
   * `submissionInputSchema` and applies the transforms. The only field needing
   * narrowing is the event `type` enum: we coerce the raw string through the
   * schema (`.catch` defaults invalid input to "competition") so tsc keeps the
   * field in sync with `EventType` and no `as unknown` cast is needed.
   */
  function buildPayload(): SubmissionInputShape {
    switch (kind) {
      case "event":
        return {
          kind,
          title: v("title"),
          type: eventPayloadSchema.shape.type.catch("competition").parse(v("type")),
          date: v("date"),
          time: v("time"),
          location: v("location"),
          clubName: v("clubName"),
          url: v("url"),
          description: v("description"),
          contactEmail: v("contactEmail"),
        };
      case "gym":
        return {
          kind,
          clubName: v("clubName"),
          schedule: v("schedule"),
          location: v("location"),
          city: v("city"),
          url: v("url"),
          notes: v("notes"),
          contactEmail: v("contactEmail"),
        };
      case "club":
        return {
          kind,
          name: v("name"),
          city: v("city"),
          website: v("website"),
          instagram: v("instagram"),
          facebook: v("facebook"),
          tiktok: v("tiktok"),
          blurb: v("blurb"),
          contactEmail: v("contactEmail"),
        };
      case "correction":
        return {
          kind,
          description: v("description"),
          url: v("url"),
        };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setFieldErrors({});
    setGlobalError(null);

    try {
      if (!user) {
        setStatus("idle");
        setGlobalError("Log in met Google om iets te melden of aan te vullen.");
        return;
      }
      const idToken = await user.getIdToken();
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          payload: buildPayload(),
          website_url2: honeypot,
          turnstileToken: turnstileToken ?? undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        fieldErrors?: FieldErrors;
      };

      if (res.ok && data.ok) {
        setStatus("success");
        return;
      }

      setStatus("idle");
      if (data.fieldErrors) setFieldErrors(data.fieldErrors);
      setGlobalError(data.error ?? "Er ging iets mis. Probeer het opnieuw.");
    } catch {
      setStatus("idle");
      setGlobalError("Kon de inzending niet versturen. Controleer je verbinding.");
    }
  }

  if (!authReady) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-[var(--muted)]" aria-hidden />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-sm text-[var(--muted)]">
          Om spam tegen te gaan vragen we je om in te loggen voordat je iets
          inzendt. Je gegevens worden alleen gebruikt om je inzending te
          verifiëren.
        </p>
        {signInError && (
          <p className="rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--ink)]">
            {signInError}
          </p>
        )}
        <Button size="lg" onClick={handleSignIn} disabled={signInBusy}>
          {signInBusy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <LogIn className="size-4" aria-hidden />
          )}
          Inloggen met Google om iets te melden of aan te vullen
        </Button>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--secondary-soft)] p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-[var(--secondary)]" aria-hidden />
        <h2 className="mt-3 font-display text-xl font-semibold">
          Bedankt! We bekijken je inzending.
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Zodra een redacteur je inzending heeft goedgekeurd, verschijnt die op de
          site.
        </p>
        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => {
            setValues({});
            setHoneypot("");
            setTurnstileToken(null);
            setStatus("idle");
          }}
        >
          Nog iets inzenden
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* Signed-in banner */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
        <span>
          Ingelogd als <span className="font-medium text-[var(--ink)]">{user.email}</span>
        </span>
        <button
          type="button"
          onClick={() => signOut(clientAuth)}
          className="ml-auto underline underline-offset-2 hover:text-[var(--ink)]"
        >
          Uitloggen
        </button>
      </div>

      {/* Kind picker */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-[var(--ink)]">
          Wat wil je inzenden?
        </legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const active = kind === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={active}
                onClick={() => changeKind(k)}
                className={
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors " +
                  (active
                    ? "border-transparent bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]")
                }
              >
                {SUBMISSION_KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)]">{KIND_HELP[kind]}</p>
      </fieldset>

      {/* Per-kind fields */}
      {kind === "event" && (
        <>
          <TextField label="Titel" name="title" value={v("title")} onChange={(x) => set("title", x)} required error={err("title")} placeholder="bv. Open NK Cheerleading 2026" />
          <SelectField label="Type" name="type" value={v("type") || "competition"} onChange={(x) => set("type", x)} options={EVENT_TYPE_OPTIONS} error={err("type")} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Datum" name="date" type="date" value={v("date")} onChange={(x) => set("date", x)} required error={err("date")} />
            <TextField label="Tijd" name="time" type="time" value={v("time")} onChange={(x) => set("time", x)} error={err("time")} hint="Optioneel" />
          </div>
          <TextField label="Locatie" name="location" value={v("location")} onChange={(x) => set("location", x)} error={err("location")} placeholder="Sporthal, plaats" />
          <TextField label="Organiserende club" name="clubName" value={v("clubName")} onChange={(x) => set("clubName", x)} error={err("clubName")} />
          <TextField label="Link" name="url" type="url" value={v("url")} onChange={(x) => set("url", x)} error={err("url")} placeholder="https://..." hint="Naar de aankondiging of tickets" />
          <TextAreaField label="Omschrijving" name="description" value={v("description")} onChange={(x) => set("description", x)} error={err("description")} />
        </>
      )}

      {kind === "gym" && (
        <>
          <TextField label="Naam van de club" name="clubName" value={v("clubName")} onChange={(x) => set("clubName", x)} required error={err("clubName")} />
          <TextField label="Dag en tijd" name="schedule" value={v("schedule")} onChange={(x) => set("schedule", x)} required error={err("schedule")} placeholder="bv. elke woensdag 19:00–21:00" />
          <TextField label="Locatie" name="location" value={v("location")} onChange={(x) => set("location", x)} error={err("location")} />
          <TextField label="Plaats" name="city" value={v("city")} onChange={(x) => set("city", x)} error={err("city")} />
          <TextField label="Link" name="url" type="url" value={v("url")} onChange={(x) => set("url", x)} error={err("url")} placeholder="https://..." />
          <TextAreaField label="Toelichting" name="notes" value={v("notes")} onChange={(x) => set("notes", x)} error={err("notes")} />
        </>
      )}

      {kind === "club" && (
        <>
          <TextField label="Naam" name="name" value={v("name")} onChange={(x) => set("name", x)} required error={err("name")} />
          <TextField label="Plaats" name="city" value={v("city")} onChange={(x) => set("city", x)} required error={err("city")} />
          <TextField label="Website" name="website" type="url" value={v("website")} onChange={(x) => set("website", x)} error={err("website")} placeholder="https://..." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Instagram" name="instagram" type="url" value={v("instagram")} onChange={(x) => set("instagram", x)} error={err("instagram")} placeholder="https://instagram.com/..." />
            <TextField label="Facebook" name="facebook" type="url" value={v("facebook")} onChange={(x) => set("facebook", x)} error={err("facebook")} placeholder="https://facebook.com/..." />
          </div>
          <TextField label="TikTok" name="tiktok" type="url" value={v("tiktok")} onChange={(x) => set("tiktok", x)} error={err("tiktok")} placeholder="https://tiktok.com/@..." />
          <TextAreaField label="Korte omschrijving" name="blurb" value={v("blurb")} onChange={(x) => set("blurb", x)} error={err("blurb")} />
        </>
      )}

      {kind === "correction" && (
        <>
          <TextAreaField label="Wat klopt er niet of ontbreekt er?" name="description" value={v("description")} onChange={(x) => set("description", x)} required error={err("description")} rows={5} />
          <TextField label="Link naar de pagina/club/het item (optioneel)" name="url" type="url" value={v("url")} onChange={(x) => set("url", x)} error={err("url")} placeholder="https://..." />
        </>
      )}

      {/* Optional contact e-mail (all kinds) */}
      <TextField label="Je e-mailadres" name="contactEmail" type="email" value={v("contactEmail")} onChange={(x) => set("contactEmail", x)} error={err("contactEmail")} hint="Optioneel — alleen voor vragen over je inzending" />

      {/* Honeypot: visually hidden, off-screen, not focusable, not announced. */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website_url2">Laat dit veld leeg</label>
        <input
          id="website_url2"
          name="website_url2"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {/* Turnstile — only when configured. */}
      {turnstileSiteKey && (
        <div>
          <Turnstile
            siteKey={turnstileSiteKey}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
            options={{ theme: "light" }}
          />
        </div>
      )}

      {globalError && (
        <p className="rounded-[var(--radius)] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--ink)]">
          {globalError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={status === "submitting"}>
          {status === "submitting" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden /> Versturen…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden /> Inzenden
            </>
          )}
        </Button>
        <p className="text-xs text-[var(--muted)]">
          We controleren elke inzending vóór publicatie.
        </p>
      </div>
    </form>
  );
}
