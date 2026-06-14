"use client";

/**
 * Public submission form (Client Component) — OPEN FORMAT.
 *
 * There is intentionally one real input: a big free-text box. The kind picker
 * (event / open gym / club / correction / feedback) is only a soft tag to help
 * triage the review queue; it changes the placeholder/help text but never the
 * field set. Everything a tipster knows goes in the message; a maintainer (with
 * Claude Code) turns it into structured data before anything is published. See
 * lib/submitSchema.ts for the rationale.
 *
 * - Requires Google sign-in (any account) for accountability / anti-spam. When
 *   signed out we show a sign-in button; when signed in we show the form plus
 *   the user's email and a sign-out link, and send the Firebase ID token as
 *   `Authorization: Bearer <token>`.
 * - Hidden honeypot input (`website_url2`) — bots fill it; humans never see it.
 * - Turnstile widget rendered ONLY when a site key is provided; it's redundant
 *   with the login gate but left in place. The server skips it when a valid
 *   login is present.
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
import {
  SUBMISSION_KINDS,
  SUBMISSION_KIND_LABEL,
  type SubmissionInput,
} from "@/lib/submitSchema";
import type { SubmissionKind } from "@/lib/types";
import { TextField, TextAreaField } from "@/components/submit/Field";

/** Soft, per-kind copy. Guides what to write WITHOUT constraining the form. */
const KIND_HELP: Record<SubmissionKind, string> = {
  event: "Een wedstrijd, clinic, tryout, showcase of andere activiteit.",
  gym: "Een terugkerend open-gym moment bij een club.",
  club: "Een club, studententeam, schoolteam of selectieteam dat nog niet op de kaart staat.",
  correction: "Er klopt iets niet of er ontbreekt iets.",
  feedback: "Een idee, opmerking of probleem met de site zelf.",
};

const KIND_PLACEHOLDER: Record<SubmissionKind, string> = {
  event:
    "bv. Open NK Cheerleading op 31 mei 2026 in Sporthallen Zuid Amsterdam, georganiseerd door … — link of tickets erbij als je die hebt.",
  gym: "bv. Cheer Amsterdam heeft elke woensdag 19:00–21:00 open gym in sporthal …",
  club: "bv. Naam, plaats, en een website of Instagram. Alles wat je weet helpt.",
  correction:
    "bv. Het adres van club X klopt niet, of team Y traint niet meer op dinsdag.",
  feedback: "Vertel ons wat beter kan, of wat je opviel op de site.",
};

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
  const [message, setMessage] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");
  const [honeypot, setHoneypot] = React.useState("");
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success">("idle");

  function err(name: string): string | undefined {
    return fieldErrors[name]?.[0];
  }

  function changeKind(next: SubmissionKind) {
    setKind(next);
    setFieldErrors({});
    setGlobalError(null);
  }

  function resetForm() {
    setMessage("");
    setUrl("");
    setContactEmail("");
    setHoneypot("");
    setTurnstileToken(null);
    setFieldErrors({});
    setGlobalError(null);
    setStatus("idle");
  }

  function buildPayload(): SubmissionInput {
    return {
      kind,
      message,
      url: url || undefined,
      contactEmail: contactEmail || undefined,
    };
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
          Zodra een redacteur je inzending heeft bekeken, verschijnt die op de
          site.
        </p>
        <Button variant="secondary" className="mt-5" onClick={resetForm}>
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

      {/* Kind picker — a soft tag for triage, not a different field set. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-[var(--ink)]">
          Waar gaat het over?
        </legend>
        <div className="flex flex-wrap gap-2">
          {SUBMISSION_KINDS.map((k) => {
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

      {/* The one real field: open free text. */}
      <TextAreaField
        label="Wat wil je ons laten weten?"
        name="message"
        value={message}
        onChange={setMessage}
        required
        error={err("message")}
        rows={8}
        placeholder={KIND_PLACEHOLDER[kind]}
      />

      <TextField
        label="Link (optioneel)"
        name="url"
        type="url"
        value={url}
        onChange={setUrl}
        error={err("url")}
        placeholder="https://…"
        hint="Een website, Instagram of pagina die helpt."
      />

      <TextField
        label="Je e-mailadres (optioneel)"
        name="contactEmail"
        type="email"
        value={contactEmail}
        onChange={setContactEmail}
        error={err("contactEmail")}
        hint="Alleen als we een vraag over je inzending hebben."
      />

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
          We bekijken elke inzending vóór publicatie.
        </p>
      </div>
    </form>
  );
}
