/**
 * Zod schema for public submissions (shared server + client).
 *
 * DELIBERATELY OPEN FORMAT. Earlier this file had one tightly-constrained
 * schema per `SubmissionKind` (title/date/time/location/...). That was dropped:
 * the people filling this in are tipsters, not data-entry clerks, and every
 * item is reviewed by hand and turned into structured data with the help of
 * Claude Code before anything is published. So the form only needs to capture
 * intent, not a typed record.
 *
 * The contract is therefore:
 *   - `kind`     — a soft category, only used to triage the review queue.
 *   - `message`  — one free-text field; the whole point of the submission.
 *   - `url`      — optional supporting link.
 *   - `contactEmail` — optional, only so we can ask follow-up questions.
 *
 * The server (`/api/submit`) validates the parsed body against
 * `submissionInputSchema`; the client form imports the same schema / types so
 * the contract can't drift.
 *
 * Kept dependency-light: only `zod` (v4). No imports from server-only modules
 * so this is safe to import from a Client Component.
 */
import { z } from "zod";
import type { SubmissionKind } from "@/lib/types";

/** Optional URL: accepts empty string (→ undefined) or a valid http(s) URL. */
const optionalUrl = z
  .string()
  .trim()
  .max(500, "URL is te lang")
  .url("Voer een geldige URL in (incl. https://)")
  .optional()
  .or(z.literal(""))
  .transform((v) => v || undefined);

/** Contact email is optional but validated when present. */
const contactEmail = z
  .string()
  .trim()
  .email("Voer een geldig e-mailadres in")
  .optional()
  .or(z.literal(""))
  .transform((v) => v || undefined);

/** The submission kinds, mirrored from `SubmissionKind` for the UI. */
export const SUBMISSION_KINDS = [
  "event",
  "gym",
  "club",
  "correction",
  "feedback",
] as const;

/**
 * The single open-format submission schema.
 *
 * `message` is the only required field. Everything a tipster knows goes in
 * there as free text; the review step (human + Claude Code) extracts the
 * structured event/gym/club from it.
 */
export const submissionInputSchema = z.object({
  kind: z.enum(SUBMISSION_KINDS),
  message: z
    .string()
    .trim()
    .min(5, "Vertel ons iets meer (minstens 5 tekens)")
    .max(8000, "Dat is wel heel lang — kort het iets in"),
  url: optionalUrl,
  contactEmail,
});

export type SubmissionInput = z.infer<typeof submissionInputSchema>;

// Compile-time guard: the schema's `kind` values must equal `SubmissionKind`.
type _AssertKinds = SubmissionInput["kind"] extends SubmissionKind
  ? SubmissionKind extends SubmissionInput["kind"]
    ? true
    : never
  : never;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _assertKinds: _AssertKinds = true;

/** Dutch labels per kind for the form picker + review queue. */
export const SUBMISSION_KIND_LABEL: Record<SubmissionKind, string> = {
  event: "Evenement",
  gym: "Open gym",
  club: "Club",
  correction: "Correctie",
  feedback: "Feedback",
};
