/**
 * Maintainer notification email (SERVER ONLY).
 *
 * Sends ONE daily digest of new submissions to every address in ADMIN_EMAILS
 * via Gmail SMTP — not one email per submission. The digest is assembled and
 * triggered by scripts/notify-digest.ts (run on an evening cron); this module
 * only knows how to render + send it.
 *
 * Configured through env:
 *   - GMAIL_USER           — the Gmail address to send from / authenticate as
 *   - GMAIL_APP_PASSWORD   — a Gmail app password (requires 2FA on the account)
 *
 * Contract: if Gmail env or ADMIN_EMAILS is missing, `sendSubmissionDigest`
 * returns `false` (sent nothing) instead of throwing, so an un-configured
 * environment is a no-op. It never throws. The boolean return tells the caller
 * whether the mail actually went out, so it only marks rows "notified" on a
 * real send (a transient failure is retried in the next day's digest).
 */
import "server-only";
import nodemailer from "nodemailer";
import { adminEmails } from "@/lib/auth";
import { SUBMISSION_KIND_LABEL } from "@/lib/submitSchema";
import type { SubmissionKind } from "@/lib/types";

export interface DigestSubmission {
  id: string;
  kind: SubmissionKind;
  payload: Record<string, unknown>;
  submittedByEmail: string | null;
  /** ISO timestamp, or null if unavailable. */
  createdAt: string | null;
}

/**
 * Public site base URL, so the digest can link to a clickable review queue
 * instead of a bare "/admin" path. Overridable via env; defaults to the same
 * canonical URL the app uses for metadata (app/layout.tsx).
 */
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://overview.cheersport.nl"
).replace(/\/$/, "");
const ADMIN_URL = `${SITE_URL}/admin`;

/** Lazily build the transport; null when env is incomplete. */
function buildTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

/**
 * Collapse CR/LF and other control characters in a submitted value into single
 * spaces. Keeps one "key: value" pair on one line so a payload can't inject
 * extra lines / fake fields into the maintainer's notification (the plaintext
 * branch interpolates these raw; the HTML branch escapes them separately).
 */
function oneLine(s: string): string {
  return s.replace(/[\u0000-\u001F\u007F]+/g, " ").trim();
}

/** Render a payload's non-empty fields as "key: value" lines. */
function payloadLines(payload: Record<string, unknown>): string[] {
  return Object.entries(payload)
    .filter(
      ([, val]) =>
        val !== undefined && val !== null && String(val).trim() !== "",
    )
    .map(([key, val]) => `${oneLine(key)}: ${oneLine(String(val))}`);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatWhen(iso: string | null): string {
  if (!iso) return "onbekend";
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Amsterdam",
    });
  } catch {
    return iso;
  }
}

/**
 * Email the maintainers a single digest of the given submissions.
 *
 * Returns `true` only if a mail was actually dispatched. Returns `false`
 * (without throwing) when there is nothing to send, the Gmail env is unset,
 * there are no recipients, or sending failed.
 */
export async function sendSubmissionDigest(
  submissions: DigestSubmission[],
): Promise<boolean> {
  if (submissions.length === 0) return false;

  const transport = buildTransport();
  if (!transport) {
    console.warn(
      "[mailer] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping submission digest.",
    );
    return false;
  }

  const recipients = adminEmails();
  if (recipients.length === 0) {
    console.warn("[mailer] ADMIN_EMAILS is empty — no one to notify.");
    return false;
  }

  const n = submissions.length;
  const subject = `${n} nieuwe inzending${n === 1 ? "" : "en"} · Cheer News`;

  // --- plain text ---
  const textBlocks = submissions.map((s, i) => {
    const kindLabel = SUBMISSION_KIND_LABEL[s.kind] ?? s.kind;
    const lines = payloadLines(s.payload);
    return [
      `${i + 1}. [${kindLabel}] — ${formatWhen(s.createdAt)}`,
      `   Ingezonden door: ${s.submittedByEmail ?? "onbekend"}`,
      ...(lines.length ? lines.map((l) => `   ${l}`) : ["   (geen velden)"]),
    ].join("\n");
  });
  const text = [
    `${n} nieuwe inzending${n === 1 ? "" : "en"} op Cheer News wacht${
      n === 1 ? "" : "en"
    } op review.`,
    ``,
    ...textBlocks,
    ``,
    `Bekijk + verwerk in de review queue: ${ADMIN_URL}`,
    `Of lees ze met Claude Code: npm run submissions`,
  ].join("\n\n");

  // --- html ---
  const htmlBlocks = submissions.map((s, i) => {
    const kindLabel = SUBMISSION_KIND_LABEL[s.kind] ?? s.kind;
    const lines = payloadLines(s.payload);
    return [
      `<li style="margin-bottom:1rem">`,
      `<strong>${i + 1}. ${escapeHtml(kindLabel)}</strong> `,
      `<span style="color:#666">— ${escapeHtml(formatWhen(s.createdAt))}, door ${escapeHtml(
        s.submittedByEmail ?? "onbekend",
      )}</span>`,
      lines.length
        ? `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : `<p>(geen velden)</p>`,
      `</li>`,
    ].join("");
  });
  const html = [
    `<p>${n} nieuwe inzending${n === 1 ? "" : "en"} op Cheer News wacht${
      n === 1 ? "" : "en"
    } op review.</p>`,
    `<ol>${htmlBlocks.join("")}</ol>`,
    `<p>Bekijk + verwerk in de review queue: <a href="${ADMIN_URL}">${escapeHtml(
      ADMIN_URL,
    )}</a><br/>`,
    `Of lees ze met Claude Code: <code>npm run submissions</code></p>`,
  ].join("\n");

  try {
    await transport.sendMail({
      from: process.env.GMAIL_USER,
      to: recipients.join(", "),
      subject,
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("[mailer] failed to send submission digest:", err);
    return false;
  }
}
