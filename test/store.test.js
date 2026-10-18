import { test } from "node:test";
import assert from "node:assert/strict";
import { reduce, emptyState, personaState } from "../src/lib/store.js";
const TODAY = "2026-10-18";
const run = (s, op, a) => reduce(s, op, a, TODAY);

test("pulse requires opt-in; withdrawing consent deletes pulse", () => {
  let { state, result } = run(emptyState(), "pulse", { personaId: "E-1077", score: 2, comment: "x" });
  assert.equal(result.error, "consent_required");
  ({ state } = run(state, "consent", { personaId: "E-1077", pulse: true }));
  ({ state, result } = run(state, "pulse", { personaId: "E-1077", score: 2, comment: "visa" }));
  assert.ok(result.ok);
  assert.equal(personaState(state, "E-1077").pulse.length, 1);
  ({ state } = run(state, "consent", { personaId: "E-1077", pulse: false }));
  assert.equal(personaState(state, "E-1077").pulse.length, 0);
  assert.equal(personaState(state, "E-1077").pulseHistoryDeleted, true);
  assert.equal(personaState(state, "E-1077").consent.log.length, 2);
});

test("escalation needs owner approval; only one pending at a time; decisions are final", () => {
  let { state, result: e } = run(emptyState(), "escalate", { personaId: "E-1077", sharePulse: false, note: "Please help" });
  assert.equal(e.status, "awaiting_owner");
  assert.equal(e.ownerName, "Huda Rahman");
  let r = run(state, "escalate", { personaId: "E-1077" }).result;
  assert.equal(r.error, "already_pending");
  ({ state, result: r } = run(state, "decide", { id: e.id, decision: "approve", note: "Chasing GDRFA today" }));
  assert.equal(r.status, "approved");
  assert.equal(run(state, "decide", { id: e.id, decision: "decline" }).result.error, "not_pending");
  assert.equal(run(state, "decide", { id: "ES-1", decision: "approve" }).result.error, "not_found");
});

test("handoff request records the simulated workflow and caps note length", () => {
  const { state, result } = run(emptyState(), "request", { personaId: "E-1042", type: "IT_EQUIPMENT", note: "x".repeat(900), fields: {} });
  assert.match(result.id, /^HO-\d+$/);
  assert.equal(result.note.length, 500);
  assert.equal(result.simulated, true);
  assert.equal(personaState(state, "E-1042").requests.length, 1);
});

test("delete wipes companion data for that persona only", () => {
  let { state } = run(emptyState(), "chat", { personaId: "E-1042", q: "hi", mode: "answer" });
  ({ state } = run(state, "chat", { personaId: "E-0815", q: "hi", mode: "answer" }));
  ({ state } = run(state, "delete", { personaId: "E-1042" }));
  assert.equal(personaState(state, "E-1042").chat.length, 0);
  assert.equal(personaState(state, "E-0815").chat.length, 1);
});

test("fallback rate limiter blocks after 40 asks in 5 minutes", () => {
  let s = emptyState(), ok = true;
  for (let i = 0; i < 41; i++) { const r = reduce(s, "rate", {}, TODAY); s = r.state; ok = r.result.ok; }
  assert.equal(ok, false);
});
