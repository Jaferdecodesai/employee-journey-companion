// Session state reducer (pure). Runs inside the Durable Object so each mutation is atomic.
import { PERSONAS, REQUEST_TYPES } from "./data.js";
import { buildEscalation, getPersona } from "./engine.js";
import { clean } from "./text.js";

export const emptyPersonaState = () => ({ consent: { pulse: false, log: [] }, pulse: [], pulseHistoryDeleted: false, requests: [], escalations: [], chat: [] });
export const emptyState = () => ({ v: 1, personas: {}, seq: 1000, rate: { start: 0, count: 0 } });
const ps = (state, pid) => (state.personas[pid] ||= emptyPersonaState());
const nowIso = () => new Date().toISOString();

export function reduce(state, op, a, today) {
  state ||= emptyState();
  switch (op) {
    case "get": return { state, result: state };
    case "rate": { // fallback rate limiter: 40 asks per 5 minutes per session
      const t = Date.now();
      if (t - state.rate.start > 300000) state.rate = { start: t, count: 0 };
      state.rate.count++;
      return { state, result: { ok: state.rate.count <= 40 } };
    }
    case "chat": {
      const p = ps(state, a.personaId);
      p.chat.push({ at: nowIso(), q: clean(a.q, 500), mode: a.mode, citations: a.citations || [] });
      p.chat = p.chat.slice(-30);
      return { state, result: true };
    }
    case "consent": {
      const p = ps(state, a.personaId);
      p.consent.pulse = !!a.pulse;
      p.consent.log.push({ at: nowIso(), pulse: !!a.pulse });
      if (!a.pulse) { p.pulse = []; p.pulseHistoryDeleted = true; } // withdrawing consent deletes pulse data
      else p.pulseHistoryDeleted = false;
      return { state, result: p.consent };
    }
    case "pulse": {
      const p = ps(state, a.personaId);
      if (!p.consent.pulse) return { state, result: { error: "consent_required" } };
      p.pulse.push({ date: today, score: a.score, comment: clean(a.comment, 280) });
      return { state, result: { ok: true } };
    }
    case "request": {
      const p = ps(state, a.personaId);
      const rt = REQUEST_TYPES[a.type];
      const id = `HO-${++state.seq}`;
      const rec = { id, type: a.type, opened: today, status: "handed_off", queue: rt.queue, owner: rt.owner, note: clean(a.note, 500), fields: a.fields, createdAt: nowIso(), simulated: true };
      p.requests.push(rec);
      return { state, result: rec };
    }
    case "escalate": {
      const p = ps(state, a.personaId);
      if (p.escalations.some((e) => e.status === "awaiting_owner")) return { state, result: { error: "already_pending" } };
      const persona = getPersona(a.personaId);
      const d = buildEscalation(persona, today, p, { sharePulse: a.sharePulse, note: clean(a.note, 500) });
      const rec = { id: `ES-${++state.seq}`, personaId: a.personaId, ...d, summary: a.summary || d.summary, summaryMode: a.summaryMode || "deterministic", status: "awaiting_owner", createdAt: nowIso(), decidedAt: null, decisionNote: "" };
      p.escalations.push(rec);
      return { state, result: rec };
    }
    case "decide": {
      for (const pid of Object.keys(state.personas)) {
        const e = state.personas[pid].escalations.find((x) => x.id === a.id);
        if (!e) continue;
        if (e.status !== "awaiting_owner") return { state, result: { error: "not_pending" } };
        e.status = a.decision === "approve" ? "approved" : "declined";
        e.decidedAt = nowIso();
        e.decisionNote = clean(a.note, 300);
        return { state, result: e };
      }
      return { state, result: { error: "not_found" } };
    }
    case "delete": {
      delete state.personas[a.personaId];
      state.personas[a.personaId] = { ...emptyPersonaState(), pulseHistoryDeleted: true, consent: { pulse: false, log: [{ at: nowIso(), pulse: false, deletedAll: true }] } };
      return { state, result: { ok: true } };
    }
    default: return { state, result: { error: "bad_op" } };
  }
}
export const personaState = (state, pid) => (state?.personas?.[pid]) || emptyPersonaState();
export const validPersona = (id) => PERSONAS.some((p) => p.id === id);
