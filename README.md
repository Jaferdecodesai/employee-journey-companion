# Employee Journey Companion

Entry prototype for the **Emirates Group × Ignyte "Employee Journey Companion" challenge**, by Jafer Mohammed (AqionLabs, Dubai). An employee-side AI companion for **onboarding** and **internal mobility**, built on Cloudflare Workers and Workers AI.

> **Synthetic data only.** Every person, owner, policy and event in this repository is fictitious. Nothing here is Emirates Group data or Emirates policy, and the prototype is not connected to any live system.

| | Link |
|---|---|
| Live prototype | https://journey-companion.aqionlabs.workers.dev |
| Demo video (2:36, captioned) | https://journey-companion.aqionlabs.workers.dev/demo (MP4: [/demo.mp4](https://journey-companion.aqionlabs.workers.dev/demo.mp4)) |
| Solution note (2 pages, PDF) | https://journey-companion.aqionlabs.workers.dev/solution-note.pdf |

Independent challenge entry; not affiliated with or endorsed by Emirates Group. Nothing in this repository comes from the challenge organiser: all data, policies and people are written for this prototype.

## What it does (judge path)
1. **Pick a synthetic employee.** You see their journey stage, day number, next step, owner and anything overdue.
2. **Ask a policy question.** The answer cites its source (`POL-…-§n`, which opens the section), or the companion **says it is not sure and offers a handoff to a named person**.
3. **Start a routine request** (IT, access, learning, facilities, HR letter, visa, relocation). It comes pre-filled from the journey; you review it, and it is handed to a simulated queue.
4. **Opt in to a pulse check.** This is off by default, and withdrawing consent deletes the responses.
5. **Friction detection** combines overdue or blocked steps, delayed requests and opt-in pulse. Example: *residence visa 8 days late, blocking salary set-up* → **escalation card** to a named owner. The employee previews it and chooses whether to share pulse. The **owner must approve** in the Owner inbox before anything changes.
6. **My data** shows everything held (source records vs companion-created data), and you can delete the companion-created data.
7. **Arabic / English** toggle with full RTL.
8. **Where journeys stall**: an aggregate view only, with groups under 5 suppressed and no names.
9. **Out-of-scope refusals**: performance, disciplinary and monitoring questions, other people's data, and prompt injection are refused *before* any AI call.

**Demo personas.**
| Persona | Situation |
|---|---|
| Aisha Karim | Day 5, laptop not issued |
| Daniel Mwangi | Visa stalled |
| Fatima Al Suwaidi | Role move, on track |
| Arjun Rao | Relocation allowance pending |
| Mei Lin Tan | Day 2, on track |

Fixed demo clock: `DEMO_TODAY=2026-10-18`.

## Architecture
```
Browser (vanilla JS, no build, strict CSP)
   │  same-origin fetch, X-JC header, HttpOnly session cookie
   ▼
Worker  src/index.js ── security headers on every response (assets too: run_worker_first)
   ├─ src/lib/engine.js   deterministic: journey stage, scope/injection classifier, cited retrieval,
   │                      request drafts, friction, escalation summary, aggregate stall view
   ├─ src/lib/ai.js       Workers AI (env.AI): rephrases ONLY the retrieved sections; output
   │                      validated (must cite given sections), else visible deterministic fallback
   ├─ src/lib/store.js    pure state reducer (consent, pulse, handoffs, escalations, chat)
   └─ SessionStore        Durable Object (SQLite) per session; alarm deletes data after 24 h idle
Data: src/lib/data.js (personas, owners, journey maps, request types), src/lib/policies.js (11 policies, 22 sections, EN + AR)
```
Static pages: `/` (the app) and `/demo` (video player). Bindings: `ASSETS`, `AI` (Workers AI), `SESSIONS` (Durable Object), `RATE_LIMITER` (Workers rate limiting), plus vars `AI_MODEL` and `DEMO_TODAY`.

## Setup
Requirements: **Node 22+**, a Cloudflare account (free plan is enough).
```bash
npm install
npx wrangler login            # once
npm run dev                   # http://localhost:8787  (Workers AI runs remotely even in dev)
npm test                      # 60 unit + scenario tests (no network)
npm run e2e -- http://localhost:8787               # 39 API checks
npm run screens -- http://localhost:8787 ../screenshots/local   # Playwright + axe QA (needs Chrome at /usr/bin/google-chrome or CHROME=...)
npm run deploy                # wrangler deploy → https://journey-companion.<subdomain>.workers.dev
```
**Binary assets not in this repository.** The live site also serves `public/solution-note.pdf` and `public/demo.mp4` (links above). They are left out of the repo to keep it text-only; the app runs without them (only `/solution-note.pdf`, `/demo.mp4` and the `/demo` player depend on them). To serve them from your own deployment, drop the files into `public/` before `npm run deploy`. `/demo.mp4` supports HTTP byte ranges (206) for seeking and Safari.

**Without a Cloudflare login** the AI binding is unavailable. The app still works: every answer then comes from the deterministic path and is labelled "AI unavailable · deterministic fallback".

## Swapping in the organiser's data pack
Replace the exports in `src/lib/data.js` and `src/lib/policies.js` with a loader for `employees.csv`, `journey_events.csv`, `service_requests.csv`, `pulse_feedback.csv`, `policies/` and `journey_maps.md`. The engine only depends on the shapes documented at the top of those files. *(Not built yet: the pack is only available after joining.)*

## Security controls (implemented and tested)
| Control | Detail |
|---|---|
| CSP | `default-src 'self'`, with no inline script or style; `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'` |
| Other headers | HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy no-referrer, a restrictive Permissions-Policy, COOP, CORP |
| Session | Random UUID cookie, `HttpOnly; Secure; SameSite=Strict`, 24 h; no accounts, no PII beyond synthetic data |
| CSRF | POST requires `X-JC: 1` plus JSON content-type; a cross-origin `Origin` is rejected (403) |
| Input validation | 4 KB body cap (413), persona allow-list, text ≤500, pulse score 1–5, comment ≤280, control characters stripped |
| Rendering | Client renders with `textContent` only |
| Rate limits | Workers rate-limit binding (60/min per session) plus a Durable Object limiter (40 asks per 5 min per session) |
| AI boundary | Classifier runs before the model; user text is fenced as data; the model sees only selected policy text; output must cite only the sections it was given, and step/request IDs must survive in summaries |
| Secrets | None in client or repo; Workers AI is a binding |

## Known limits
- **Owner inbox is a demo role switch.** A pilot needs owner SSO and per-owner access control.
- **Calendar days, not working days.** SLAs count calendar days, and there is no public-holiday calendar.
- **Simulated downstream workflows.** Requests are recorded, not sent to IT/HR systems.
- **Small synthetic policy set.** The policy texts are short and synthetic; Arabic text is a summary and needs native review.
- **Retrieval is lexical** (BM25-style with Arabic normalisation). Paraphrases far from the policy wording fall to "not sure" by design.

## Licence
No licence file is included, so default copyright applies (all rights reserved by the author). Please ask before reusing the code.
