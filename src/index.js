// Journey Companion: Cloudflare Worker (API + static assets) with a per-session Durable Object.
import { DurableObject } from "cloudflare:workers";
import { DEMO_TODAY_DEFAULT, OWNERS, PERSONAS, REQUEST_TYPES, JOURNEY_MAPS } from "./lib/data.js";
import { POLICIES } from "./lib/policies.js";
import { buildEscalation, buildRequestDraft, detectFriction, getPersona, getSection, journeyStatus, planAnswer, stallView } from "./lib/engine.js";
import { aiAnswer, aiSummary, DEFAULT_MODEL } from "./lib/ai.js";
import { emptyState, personaState, reduce, validPersona } from "./lib/store.js";
import { clean } from "./lib/text.js";
import { mediaResponse } from "./lib/media.js";

const SESSION_TTL_MS = 24 * 3600 * 1000; // companion data auto-deletes after 24h of inactivity

export class SessionStore extends DurableObject {
  async run(op, args, today) {
    const s = (await this.ctx.storage.get("s")) || emptyState();
    const { state, result } = reduce(s, op, args, today);
    if (op !== "get") await this.ctx.storage.put("s", state);
    await this.ctx.storage.setAlarm(Date.now() + SESSION_TTL_MS);
    return result;
  }
  async alarm() { await this.ctx.storage.deleteAll(); }
}

export const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};
function withHeaders(res, extra = {}) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SECURITY_HEADERS, ...extra })) r.headers.set(k, v);
  return r;
}
const json = (data, status = 200, extra = {}) => withHeaders(new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }), extra);
const err = (code, status = 400) => json({ error: code }, status);

const SID_RE = /^[0-9a-f-]{36}$/;
function getSid(request) {
  const m = /(?:^|;\s*)jc_sid=([^;]+)/.exec(request.headers.get("Cookie") || "");
  return m && SID_RE.test(m[1]) ? m[1] : null;
}
async function readJson(request) {
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > 4096) throw new Error("too_large");
  const text = await request.text();
  if (text.length > 4096) throw new Error("too_large");
  const v = JSON.parse(text || "{}");
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("bad_json");
  return v;
}
const lang = (x) => (x === "ar" ? "ar" : "en");

function personaView(p, ps, today) {
  const status = journeyStatus(p, today, ps);
  const friction = detectFriction(p, today, ps);
  const reqs = [...p.requests.map((r) => ({ ...r, source: "service_requests (synthetic system record)" })), ...ps.requests.map((r) => ({ ...r, source: "companion handoff (simulated workflow)" }))];
  return { persona: publicPersona(p), status, friction, requests: reqs, consent: ps.consent, escalations: ps.escalations, pulseCount: (ps.consent.pulse && !ps.pulseHistoryDeleted ? p.pulse.length : 0) + ps.pulse.length };
}
const publicPersona = (p) => ({ id: p.id, name: p.name, journey: p.journey, journeyName: JOURNEY_MAPS[p.journey].name, startDate: p.startDate, role: p.role, team: p.team, location: p.location, manager: p.manager, scenario: p.scenario, needsVisa: p.needsVisa, locationMove: p.locationMove });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      const res = await env.ASSETS.fetch(request);
      if (url.pathname.endsWith(".mp4") && res.status === 200) return mediaResponse(request, res, withHeaders);
      return withHeaders(res, url.pathname === "/" || url.pathname.endsWith(".html") ? { "Cache-Control": "no-cache" } : {});
    }
    try {
      return await handleApi(request, env, url);
    } catch (e) {
      const code = e && /^(too_large|bad_json)$/.test(e.message) ? e.message : "server_error";
      if (code === "server_error") console.error("api error", e && e.stack);
      return err(code, code === "too_large" ? 413 : code === "bad_json" ? 400 : 500);
    }
  },
};

async function handleApi(request, env, url) {
  const today = /^\d{4}-\d{2}-\d{2}$/.test(env.DEMO_TODAY || "") ? env.DEMO_TODAY : DEMO_TODAY_DEFAULT;
  const method = request.method;
  if (!["GET", "POST"].includes(method)) return err("method_not_allowed", 405);

  // CSRF / origin protection for state changes
  if (method === "POST") {
    const origin = request.headers.get("Origin");
    if (origin && origin !== url.origin) return err("bad_origin", 403);
    if (request.headers.get("X-JC") !== "1") return err("missing_header", 403);
    if (!(request.headers.get("Content-Type") || "").startsWith("application/json")) return err("bad_content_type", 415);
  }

  let sid = getSid(request);
  let setCookie = null;
  if (!sid) { sid = crypto.randomUUID(); setCookie = `jc_sid=${sid}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`; }
  const extra = setCookie ? { "Set-Cookie": setCookie } : {};
  const store = env.SESSIONS.get(env.SESSIONS.idFromName(sid));

  if (method === "POST" && env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: sid });
    if (!success) return err("rate_limited", 429);
  }

  const path = url.pathname;
  if (method === "GET" && path === "/api/health") return json({ ok: true, today, ai: !!env.AI, model: env.AI_MODEL || DEFAULT_MODEL }, 200, extra);
  if (method === "GET" && path === "/api/bootstrap") {
    return json({
      today, aiBound: !!env.AI, model: env.AI_MODEL || DEFAULT_MODEL,
      personas: PERSONAS.map(publicPersona), owners: OWNERS,
      requestTypes: Object.values(REQUEST_TYPES).map(({ keywords, ...r }) => r),
      policies: POLICIES.map((p) => ({ id: p.id, title: p.title, version: p.version, sections: p.sections.map((s) => ({ n: s.n, en: s.en, ar: s.ar })) })),
    }, 200, extra);
  }
  if (method === "GET" && path === "/api/stalls") return json(stallView(today), 200, extra);
  if (method === "GET" && path === "/api/owner/inbox") {
    const st = await store.run("get", {}, today);
    const items = Object.values(st.personas || {}).flatMap((p) => p.escalations).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return json({ items, note: "Demo: in a pilot this inbox sits behind the owner's own sign-in (SSO)." }, 200, extra);
  }
  if (method === "GET" && path.startsWith("/api/policy/")) {
    const s = getSection(decodeURIComponent(path.slice("/api/policy/".length)));
    return s ? json({ cite: s.cite, policyId: s.policy.id, title: s.policy.title, version: s.policy.version, en: s.section.en, ar: s.section.ar }, 200, extra) : err("not_found", 404);
  }

  const params = method === "GET" ? Object.fromEntries(url.searchParams) : await readJson(request);
  if (method === "POST" && path === "/api/owner/decide") {
    if (!/^ES-\d+$/.test(String(params.id || ""))) return err("bad_id");
    if (!["approve", "decline"].includes(params.decision)) return err("bad_decision");
    const r = await store.run("decide", { id: params.id, decision: params.decision, note: params.note }, today);
    return r.error ? err(r.error, 409) : json(r, 200, extra);
  }
  const personaId = String(params.personaId || "");
  if (!validPersona(personaId)) return err("bad_persona");
  const persona = getPersona(personaId);
  const L = lang(params.lang);

  if (method === "GET" && path === "/api/persona") {
    const st = await store.run("get", {}, today);
    return json(personaView(persona, personaState(st, personaId), today), 200, extra);
  }
  if (method === "GET" && path === "/api/mydata") {
    const st = await store.run("get", {}, today);
    const ps = personaState(st, personaId);
    return json({
      heldBySourceSystems: { note: "Synthetic HR system records the companion reads but does not own. Corrections go to HR Services.", profile: publicPersona(persona), journeyEvents: persona.events, serviceRequests: persona.requests, pulseHistory: ps.consent.pulse && !ps.pulseHistoryDeleted ? persona.pulse : [] },
      heldByCompanion: { note: "Created by you in this companion. Auto-deleted after 24 hours of inactivity, or now with Delete.", consent: ps.consent, pulseResponses: ps.pulse, handoffs: ps.requests, escalations: ps.escalations, questions: ps.chat },
      notHeld: ["Performance, disciplinary or promotion data", "Pulse feedback unless you opt in", "Anything visible to your manager"],
    }, 200, extra);
  }

  if (method !== "POST") return err("not_found", 404);

  if (path === "/api/ask") {
    const q = clean(params.text, 500);
    if (q.length < 2) return err("empty_question");
    const rl = await store.run("rate", {}, today);
    if (!rl.ok) return err("rate_limited", 429);
    const st = await store.run("get", {}, today);
    const ps = personaState(st, personaId);
    const plan = planAnswer(persona, q, L, today, ps);
    let engine = "deterministic", aiError = null, text = plan.text, citations = plan.citations;
    if (plan.useAI && params.ai !== false) {
      try {
        const out = await aiAnswer(env, { question: q, lang: L, hits: plan.hits, context: plan.context });
        text = out.text; citations = out.citations; engine = "workers-ai";
      } catch (e) { aiError = e.message; }
    }
    await store.run("chat", { personaId, q, mode: plan.mode, citations }, today);
    const sources = citations.map((c) => getSection(c)).filter(Boolean).map((s) => ({ cite: s.cite, title: s.policy.title, version: s.policy.version }));
    return json({ mode: plan.mode, kind: plan.kind, text, citations, sources, context: plan.context || null, suggestion: plan.suggestion || null, handoff: plan.handoff || null, engine, aiError, model: engine === "workers-ai" ? env.AI_MODEL || DEFAULT_MODEL : null }, 200, extra);
  }
  if (path === "/api/request/draft") {
    if (!REQUEST_TYPES[params.type]) return err("bad_type");
    const st = await store.run("get", {}, today);
    return json(buildRequestDraft(persona, params.type, today, personaState(st, personaId), L), 200, extra);
  }
  if (path === "/api/request/submit") {
    if (!REQUEST_TYPES[params.type]) return err("bad_type");
    const st = await store.run("get", {}, today);
    const draft = buildRequestDraft(persona, params.type, today, personaState(st, personaId), L);
    const rec = await store.run("request", { personaId, type: params.type, note: params.note, fields: draft.fields }, today);
    return json(rec, 200, extra);
  }
  if (path === "/api/consent") {
    if (typeof params.pulse !== "boolean") return err("bad_consent");
    return json(await store.run("consent", { personaId, pulse: params.pulse }, today), 200, extra);
  }
  if (path === "/api/pulse") {
    const score = Number(params.score);
    if (!Number.isInteger(score) || score < 1 || score > 5) return err("bad_score");
    const r = await store.run("pulse", { personaId, score, comment: params.comment }, today);
    return r.error ? err(r.error, 403) : json(r, 200, extra);
  }
  if (path === "/api/escalation/preview" || path === "/api/escalation/send") {
    const st = await store.run("get", {}, today);
    const ps = personaState(st, personaId);
    const sharePulse = params.sharePulse === true;
    const note = clean(params.note, 500);
    const draft = buildEscalation(persona, today, ps, { sharePulse, note });
    let summary = draft.summary, summaryMode = "deterministic";
    if (params.ai !== false) {
      try { summary = await aiSummary(env, { draft, lang: L }); summaryMode = "workers-ai"; } catch { /* visible deterministic fallback */ }
    }
    if (path === "/api/escalation/preview") return json({ ...draft, summary, summaryMode }, 200, extra);
    const rec = await store.run("escalate", { personaId, sharePulse, note, summary, summaryMode }, today);
    return rec.error ? err(rec.error, 409) : json(rec, 200, extra);
  }
  if (path === "/api/mydata/delete") return json(await store.run("delete", { personaId }, today), 200, extra);
  return err("not_found", 404);
}
