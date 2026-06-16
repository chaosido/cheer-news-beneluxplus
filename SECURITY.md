# Security

This document explains, in plain language, how Cheer News BeneluxPlus is kept
safe and what to watch out for when changing it. It is written for maintainers
who are **not** web-security specialists.

## Reporting a vulnerability

Email **wonnink.jesse@gmail.com** (also listed in
[`/.well-known/security.txt`](public/.well-known/security.txt)). Please give us a
chance to fix an issue before disclosing it publicly.

---

## The security layers, and why each exists

Think of these as a stack of independent fences. An attacker has to clear all of
them, and most attacks fail at the first.

### 1. The database is closed to the public

`firestore.rules` denies **all** direct client reads and writes
(`allow read, write: if false`). The website never talks to the database from the
browser. Instead:

- **Reads** happen on the server (Server Components / API routes) using the
  Firebase Admin SDK, which runs with trusted credentials and bypasses the rules.
- **Writes** happen only through validated API routes.

*Why it matters:* even if someone steals the public Firebase config (which is
meant to be public — see "Secrets" below), they still cannot read or change a
single record. There is no public data surface to attack.

### 2. Submissions are gated, validated, and reviewed

The public submission form (`/submit` → `app/api/submit/route.ts`) requires, in
order:

1. **Google sign-in with a verified email** — an accountability gate; anonymous
   spam is impossible.
2. A **honeypot** field that bots fill in and humans never see.
3. **Cloudflare Turnstile** (when configured) — a privacy-friendly CAPTCHA.
4. **Schema validation** with Zod (`lib/submitSchema.ts`) — every field has a
   type, a length cap, and (for URLs) an `http(s)`-only check.
5. A **rate limit** (see below).

Nothing a stranger submits is ever published automatically. A maintainer reviews
it in `/admin` first. Approvals and rejections are recorded in an `auditLog`
collection (who did what, when).

### 3. Rate limiting (known limitation — read this)

The submit endpoint limits each signed-in user to **5 submissions per 60
seconds**. **This limiter lives in server memory.** Two consequences:

- It **resets when the server restarts / cold-starts** (App Hosting scales to
  zero).
- It is **per-instance**: with `maxInstances: 2`, a determined user could get up
  to ~10/min by hitting both instances.

*This is an accepted trade-off* for a low-traffic, login-gated niche site — the
Google-login requirement is the real anti-abuse control. **Revisit it (move to a
shared store like Firestore or Memorystore) if** the site grows, `maxInstances`
rises, or you see coordinated abuse from many accounts.

### 4. URLs can never carry an attack

User-supplied URLs (club websites, social links, event links) are checked twice:

- **At write time** by Zod (`http(s)` only).
- **At render time** by `safeUrl()` (`lib/safeUrl.ts`), which re-rejects anything
  that isn't `http(s)` or a same-origin path.

*Why it matters:* this blocks `javascript:` / `data:` URLs that would otherwise
run code when clicked (a classic XSS vector), and stops the server being tricked
into fetching internal addresses (SSRF).

### 5. The image optimizer is not an open proxy

`next.config.ts` restricts `images.remotePatterns` to our own storage hosts. We
deliberately do **not** use a `"**"` host wildcard — that would let anyone point
`/_next/image` at any address on the internet (bandwidth abuse / SSRF). External
club logos are rendered with `unoptimized` so they display without widening this
surface.

### 6. HTTP security headers + Content-Security-Policy

`proxy.ts` (Next 16's middleware) sets, on every response:

- **`Content-Security-Policy`** — an allowlist of where scripts, styles, images,
  and connections may come from. This is the main defense against cross-site
  scripting. It is generated per request with a fresh **nonce** and is gated by
  the `CSP_MODE` env var (`off` | `report-only` | `enforce`) so it can be flipped
  or disabled via config without a code change.
- **`Strict-Transport-Security`** — forces HTTPS.
- **`X-Frame-Options: DENY`** + CSP `frame-ancestors 'none'` — blocks
  clickjacking (your site being embedded in a hostile iframe).
- **`X-Content-Type-Options: nosniff`**, **`Referrer-Policy`**,
  **`Permissions-Policy`** — assorted hardening.

---

## Tripwires — things that will silently break the site, do NOT do them

- **Never set `Cross-Origin-Opener-Policy: same-origin`.** Login uses
  `signInWithPopup` (`app/admin/page.tsx`, `components/submit/SubmitForm.tsx`),
  which needs `window.opener`. A `same-origin` COOP severs it and **breaks Google
  login** with no obvious error. If you must set COOP, use
  `same-origin-allow-popups`.
- **Never make the database client-readable** to "make a page faster." Keep all
  reads on the server.
- **Never add a `NEXT_PUBLIC_` prefix to a secret.** That prefix bakes the value
  into the public browser bundle. `NEXT_PUBLIC_` is for values that are *already*
  public (the Firebase web config, the Turnstile site key).
- **Don't switch the CSP to a strict nonce-only `style-src`.** The map (Leaflet)
  and home page use inline styles; `style-src 'self' 'unsafe-inline'` is
  required. Removing `'unsafe-inline'` breaks the map.

---

## Secrets — how they are wired

- **Local development:** secrets live in `.env.local`, which is **gitignored**
  (`.gitignore`) and never committed. A safe template is in `.env.example`.
- **Production (App Hosting):** server-only secrets (e.g. `IP_HASH_SALT`) come
  from **Google Secret Manager**, referenced by name in `apphosting.yaml`. The
  compute service account reads the database via Application Default Credentials
  — there is **no key file in production**.
- **`gitleaks`** runs in CI on every push/PR as a backstop: if a secret is ever
  committed by accident, the build fails.

### If a secret leaks (rotation procedure)

1. **Rotate it at the source** (regenerate the API key / regenerate the salt /
   change the password).
2. Update the value in Secret Manager (`firebase apphosting:secrets:set <name>`)
   and in your local `.env.local`.
3. Redeploy.
4. If it was committed to git, rotating is mandatory — purging git history is
   *not* enough, because clones and forks keep the old value.

> Note: the Firebase **web API key** (`NEXT_PUBLIC_FIREBASE_API_KEY`) is *not* a
> secret — it identifies the project to Google and is meant to be public. Access
> is controlled by Firestore rules + Auth, not by hiding this key.

---

## Properties worth knowing (so a future change doesn't regress them)

- **No CSRF surface.** The API routes authenticate with an
  `Authorization: Bearer <Firebase ID token>` header, not a cookie. Browsers do
  not attach custom headers to cross-site requests automatically, so these routes
  are inherently CSRF-resistant. **If you ever add a session cookie, you must add
  CSRF protection** — the current safety comes from *not* using cookies.
- **No open-redirect surface.** There is no user-controlled server redirect /
  `Location` header. External links use `target="_blank" rel="noopener
  noreferrer"` and go through `safeUrl()`.
- **`ipHash` is best-effort, not forensic.** The submit endpoint stores a salted
  hash of the client IP derived from the `x-forwarded-for` header. On App Hosting
  that header's left-most entry is client-controlled and **spoofable**, so treat
  `ipHash` as a weak correlation hint only — never as proof of identity. The real
  abuse key is the authenticated user ID.
