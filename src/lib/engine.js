// Deterministic core: journey stage, scope/safety classification, cited retrieval, request drafts,
// friction detection, escalation summaries, aggregate stall view. Pure functions, no I/O.
import { JOURNEY_MAPS, OWNERS, PERSONAS, REQUEST_TYPES } from "./data.js";
import { POLICIES, getSection } from "./policies.js";
import { normalize, tokens } from "./text.js";

const DAY = 86400000;
export const toDate = (s) => new Date(s + "T00:00:00Z");
export const iso = (d) => d.toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((toDate(b) - toDate(a)) / DAY);
export const addDays = (s, n) => iso(new Date(toDate(s).getTime() + n * DAY));

export const getPersona = (id) => PERSONAS.find((p) => p.id === id) || null;
export const ownerOf = (id) => OWNERS[id] || OWNERS["OWN-HRS"];

// ---------- 1. Journey stage ----------
export function journeyStatus(persona, today, state = {}) {
  const map = JOURNEY_MAPS[persona.journey];
  const day = daysBetween(persona.startDate, today) + 1;
  const done = Object.fromEntries(persona.events.map((e) => [e.step, e.date]));
  const applicable = map.steps.filter((s) => (!s.requiresVisa || persona.needsVisa) && (!s.locationMoveOnly || persona.locationMove));
  const applicableIds = new Set(applicable.map((s) => s.id));
  const steps = applicable
    .map((s) => {
      const target = addDays(persona.startDate, s.targetDay - 1);
      const completed = done[s.id] || null;
      let status, daysOver = 0;
      if (completed) status = "done";
      else if (s.dependsOn && applicableIds.has(s.dependsOn) && !done[s.dependsOn] && today > target) { status = "blocked"; daysOver = daysBetween(target, today); }
      else if (today > target) { status = "overdue"; daysOver = daysBetween(target, today); }
      else if (daysBetween(today, target) <= 2) status = "due";
      else status = "upcoming";
      const ownerApproved = (state.escalations || []).some((e) => e.status === "approved" && e.stepIds?.includes(s.id));
      return { id: s.id, name: s.name, owner: s.owner, ownerName: ownerOf(s.owner).name, target, completed, status, daysOver, policy: s.policy, requestType: s.requestType || null, dependsOn: applicableIds.has(s.dependsOn) ? s.dependsOn : null, ownerPrioritised: ownerApproved };
    })
    .sort((a, b) => a.target.localeCompare(b.target));
  const next = steps.find((s) => s.status !== "done") || null;
  const doneCount = steps.filter((s) => s.status === "done").length;
  return { journey: map.id, journeyName: map.name, day, steps, next, progress: { done: doneCount, total: steps.length } };
}

// ---------- 2. Scope and safety classification (runs BEFORE any AI call) ----------
const nz = (arr) => arr.map((p) => new RegExp(normalize(p), "i"));
const INJECTION = nz([
  "ignore (all |any |the |your )?(previous |prior |above |earlier )?(instructions|rules|prompts?)",
  "disregard (your|the|all) (rules|instructions|policies)",
  "system prompt", "you are now", "developer mode", "jailbreak", "pretend (you are|to be)",
  "act as (an? )?(admin|administrator|hr|manager|system|root)", "reveal (your|the) (prompt|instructions|rules|system)",
  "</?script", "override (the )?(policy|policies|rules|guardrails)", "begin system", "\\[system\\]",
  "تجاهل (كل |جميع )?(التعليمات|القواعد)", "انس التعليمات",
]);
const OUT_OF_SCOPE = nz([
  "performance (review|rating|score|appraisal|evaluation|improvement|management|decision)", "appraisal",
  "rate (my|the|her|his|their) (colleague|employee|report|team|staff)", "(kpi|bonus) (score|decision|rating)",
  "promot(e|ion) (decision|him|her|them)", "underperform", "\\bpip\\b",
  "disciplin", "misconduct", "(written |final )?warning letter", "written warning",
  "fire (him|her|them|someone|an employee|my|a colleague)", "dismiss(al|ed)? (him|her|them|an employee|a colleague|my|someone)",
  "terminat(e|ion) (him|her|them|an employee|a colleague|my|someone|of)", "sack (him|her|them|someone)",
  "(disciplinary|misconduct) investigation", "investigat(e|ion) (into|of|against) (my |a |an |the )?(colleague|employee|manager|staff|report)",
  "(monitor|track|spy on|surveil|watch) (my |the |an? )?(team|employees?|staff|colleagues?|reports?|joiners?)",
  "who complained", "which employees? (are|is) (unhappy|stuck|struggling|complaining)", "sentiment of (my|the|an?)", "pulse (of|for) (my|the) team",
  "تقييم (ال)?اداء", "(ال)?اداء (ال)?وظيفي", "تاديب", "انذار", "انهاء (ال)?خدم", "فصل (ال)?موظف", "مراقب(ه|ة) (ال)?(موظف|فريق)",
]);
const OTHER_PERSON = nz(["(my |a |another |someone else'?s? )colleague'?s? (visa|data|salary|status|pulse|request|feedback)", "someone else'?s (visa|data|salary|status|pulse|request|feedback)", "بيانات (موظف|زميل)"]);

export function classify(text, selfId) {
  const q = normalize(text);
  if (INJECTION.some((r) => r.test(q))) return { kind: "injection" };
  if (OUT_OF_SCOPE.some((r) => r.test(q))) return { kind: "out_of_scope" };
  if (OTHER_PERSON.some((r) => r.test(q))) return { kind: "other_person" };
  const ids = q.match(/\be-\d{4}\b/g) || [];
  if (ids.some((x) => x.toUpperCase() !== selfId)) return { kind: "other_person" };
  const ownerFirst = new Set(Object.values(OWNERS).map((o) => normalize(o.name.split(" ")[0])));
  for (const p of PERSONAS) {
    if (p.id === selfId) continue;
    const parts = normalize(p.name).split(" ");
    const keys = [normalize(p.name), ...parts.slice(1).filter((x) => x.length >= 4), parts[0].length >= 4 && !ownerFirst.has(parts[0]) ? parts[0] : null].filter(Boolean);
    if (keys.some((k) => new RegExp(`(^|[^\\p{L}])${k}([^\\p{L}]|$)`, "u").test(q))) return { kind: "other_person" };
  }
  return { kind: "ok" };
}

// ---------- 3. Retrieval over the policy library ----------
const INDEX = [];
for (const p of POLICIES) for (const s of p.sections) {
  const toks = new Set(tokens(`${p.title.en} ${p.title.ar} ${s.en} ${s.ar} ${s.kw.join(" ")}`));
  INDEX.push({ cite: `${p.id} §${s.n}`, policy: p, section: s, toks, kw: s.kw.map(normalize) });
}
const DF = new Map();
for (const d of INDEX) for (const t of d.toks) DF.set(t, (DF.get(t) || 0) + 1);
const idf = (t) => Math.log(1 + (INDEX.length - (DF.get(t) || 0) + 0.5) / ((DF.get(t) || 0) + 0.5));
export const ANSWER_THRESHOLD = 3.0;
export const COVERAGE_THRESHOLD = 0.5;
export const STRONG_SCORE = 6;
const STALL_WORDS = nz(["stuck", "stalled", "delay", "late", "overdue", "waiting", "no one", "nobody", "still (not|no|haven)", "not (yet )?(issued|received|arrived|approved)", "hasn'?t", "متاخر", "تاخر", "تاخير", "عالق", "انتظار", "لم (يصل|يتم|تصل)"]);

export function retrieve(query, k = 3) {
  const qn = normalize(query);
  const qt = [...new Set(tokens(query))];
  const scored = INDEX.map((d) => {
    let score = 0, matched = 0;
    for (const t of qt) {
      if (d.toks.has(t)) { score += idf(t); matched++; }
      else if (t.length >= 5 && [...d.toks].some((x) => x.length >= 5 && (x.startsWith(t) || t.startsWith(x)))) { score += idf(t) * 0.6; matched++; }
    }
    for (const kw of d.kw) if (kw.length >= 4 && qn.includes(kw)) score += kw.includes(" ") ? 2.5 : 1.2;
    return { cite: d.cite, policyId: d.policy.id, title: d.policy.title, section: d.section, owner: d.policy.owner, score: Math.round(score * 100) / 100, coverage: qt.length ? Math.round((matched / qt.length) * 100) / 100 : 0 };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export function detectRequestType(query) {
  const qn = normalize(query);
  let best = null, bestLen = 0;
  for (const rt of Object.values(REQUEST_TYPES)) for (const kw of rt.keywords) {
    const k = normalize(kw);
    if (qn.includes(k) && k.length > bestLen) { best = rt.id; bestLen = k.length; }
  }
  return best;
}

// Deterministic, extractive answer (also the visible fallback when Workers AI is unavailable).
export function answerFromPolicies(hits, lang) {
  const picked = [hits[0]];
  if (hits[1] && hits[1].score >= hits[0].score * 0.8 && hits[1].cite !== hits[0].cite) picked.push(hits[1]);
  const text = picked.map((h) => `${lang === "ar" ? h.section.ar : h.section.en} [${h.cite}]`).join(" ");
  return { text, citations: picked.map((h) => h.cite) };
}

const arDays = (n) => (n >= 3 && n <= 10 ? `${n} أيام` : `${n} يومًا`);
export function contextLine(persona, status, reqType, lang) {
  if (!reqType) return null;
  const step = status.steps.find((s) => s.requestType === reqType && s.status !== "done") ||
    (reqType === "VISA_SUPPORT" ? status.steps.find((s) => s.id.startsWith("ONB-") && s.owner === "OWN-VISA" && s.status !== "done") : null) ||
    (reqType === "RELOCATION" ? status.steps.find((s) => s.owner === "OWN-MOB" && s.status !== "done") : null);
  if (!step) return null;
  const name = step.name[lang] || step.name.en;
  if (lang === "ar") {
    if (step.status === "overdue" || step.status === "blocked") return `خطوة «${name}» كان موعدها ${step.target} ومتأخرة ${arDays(step.daysOver)}. المسؤول: ${step.ownerName}.`;
    return `خطوة «${name}» موعدها ${step.target}. المسؤول: ${step.ownerName}.`;
  }
  if (step.status === "overdue" || step.status === "blocked") return `Your step "${name}" was due on ${step.target} and is ${step.daysOver} day${step.daysOver === 1 ? "" : "s"} overdue. Owner: ${step.ownerName}.`;
  return `Your step "${name}" is due on ${step.target}. Owner: ${step.ownerName}.`;
}

export const REFUSALS = {
  injection: {
    en: "I can only answer from the published policies, and I can't change how I work or reveal my instructions. Ask me about your journey, a policy, or a request.",
    ar: "أستطيع الإجابة من السياسات المنشورة فقط، ولا يمكنني تغيير طريقة عملي أو كشف تعليماتي. اسألني عن رحلتك أو سياسة أو طلب.",
  },
  out_of_scope: {
    en: "I can't help with performance, disciplinary or monitoring matters, and nothing you share with me is used for them [POL-PRV-001 §2]. If you'd like a confidential conversation, I can hand this to Sara Al Ameri (HR Business Partner).",
    ar: "لا يمكنني المساعدة في مسائل الأداء أو التأديب أو المراقبة، ولا يُستخدم أي شيء تشاركه معي لهذه الأغراض [POL-PRV-001 §2]. إن أردت محادثة سرية يمكنني تحويلك إلى سارة العامري (شريكة أعمال الموارد البشرية).",
  },
  other_person: {
    en: "I can only show your own information. Other people's journeys, requests and feedback are private to them.",
    ar: "أستطيع عرض معلوماتك أنت فقط. رحلات الآخرين وطلباتهم وآراؤهم خاصة بهم.",
  },
  unsure: {
    en: "I'm not sure. I couldn't find this in the policies I can see, so I won't guess. I can pass your question to {owner} ({role}).",
    ar: "لست متأكدًا. لم أجد هذا في السياسات المتاحة لي، لذلك لن أخمّن. يمكنني تحويل سؤالك إلى {owner} ({role}).",
  },
};

// Full deterministic pipeline for a question. AI (if available) may only rephrase the SAME cited sections.
export function planAnswer(persona, question, lang, today, state = {}) {
  const cls = classify(question, persona.id);
  const status = journeyStatus(persona, today, state);
  if (cls.kind !== "ok") {
    const handoff = cls.kind === "out_of_scope" ? { owner: "OWN-HRBP", ownerName: ownerOf("OWN-HRBP").name } : null;
    return { mode: "refused", kind: cls.kind, text: REFUSALS[cls.kind][lang], citations: cls.kind === "out_of_scope" ? ["POL-PRV-001 §2"] : [], handoff, useAI: false };
  }
  const reqType = detectRequestType(question);
  const hits = retrieve(question);
  const ctx = contextLine(persona, status, reqType, lang);
  const stallTalk = STALL_WORDS.some((r) => r.test(normalize(question)));
  const fr = detectFriction(persona, today, state);
  const suggestion = reqType || (stallTalk && fr.level !== "low") ? { requestType: reqType, escalate: stallTalk && fr.recommendEscalation, friction: fr.level } : null;
  if (!hits.length || hits[0].score < ANSWER_THRESHOLD || (hits[0].coverage < COVERAGE_THRESHOLD && hits[0].score < STRONG_SCORE)) {
    const ownerId = reqType ? REQUEST_TYPES[reqType].owner : "OWN-HRS";
    const o = ownerOf(ownerId);
    return { mode: "unsure", kind: "unsure", text: REFUSALS.unsure[lang].replace("{owner}", o.name).replace("{role}", o.role[lang]), citations: [], context: ctx, handoff: { owner: ownerId, ownerName: o.name }, suggestion, hits, useAI: false };
  }
  const det = answerFromPolicies(hits, lang);
  return { mode: "answer", kind: "answer", text: det.text, citations: det.citations, context: ctx, suggestion, hits, useAI: true };
}

// ---------- 4. Routine request drafts (pre-filled handoffs) ----------
export function buildRequestDraft(persona, type, today, state = {}, lang = "en") {
  const rt = REQUEST_TYPES[type];
  if (!rt) return null;
  const status = journeyStatus(persona, today, state);
  const step = status.steps.find((s) => s.requestType === type && s.status !== "done") ||
    status.steps.find((s) => s.owner === rt.owner && s.status !== "done") || null;
  const existing = [...persona.requests, ...(state.requests || [])].find((r) => r.type === type && r.status !== "closed");
  const o = ownerOf(rt.owner);
  return {
    type, typeName: rt.name, queue: rt.queue, owner: rt.owner, ownerName: o.name, ownerRole: o.role, policy: rt.policy, slaDays: rt.slaDays,
    fields: {
      employeeId: persona.id, name: persona.name, role: persona.role, team: persona.team, location: persona.location, manager: persona.manager,
      journey: `${JOURNEY_MAPS[persona.journey].name.en}, day ${status.day}`,
      relatedStep: step ? `${step.id} ${step.name.en} (target ${step.target}${step.daysOver ? `, ${step.daysOver} days overdue` : ""})` : "none",
      existingRequest: existing ? `${existing.id} opened ${existing.opened}, status ${existing.status}` : "none",
    },
    simulated: true,
  };
}

// ---------- 5. Friction detection ----------
const rank = { low: 0, medium: 1, high: 2 };
export function detectFriction(persona, today, state = {}) {
  const status = journeyStatus(persona, today, state);
  const signals = [];
  for (const s of status.steps) {
    if (s.status === "overdue") signals.push({ kind: "step_overdue", stepId: s.id, step: s.name, owner: s.owner, ownerName: s.ownerName, daysOver: s.daysOver, severity: s.daysOver >= 5 ? "high" : "medium", source: "journey_events" });
    if (s.status === "blocked") signals.push({ kind: "step_blocked", stepId: s.id, step: s.name, owner: s.owner, ownerName: s.ownerName, daysOver: s.daysOver, dependsOn: s.dependsOn, severity: "high", source: "journey_events" });
  }
  for (const r of [...persona.requests, ...(state.requests || [])]) {
    if (r.status === "closed") continue;
    const rt = REQUEST_TYPES[r.type];
    const open = daysBetween(r.opened, today);
    if (open > rt.slaDays) signals.push({ kind: "request_delayed", requestId: r.id, requestType: r.type, typeName: rt.name, owner: rt.owner, ownerName: ownerOf(rt.owner).name, daysOpen: open, slaDays: rt.slaDays, severity: open >= rt.slaDays * 3 ? "high" : "medium", source: "service_requests" });
  }
  let pulseUsed = false;
  if (state.consent?.pulse) {
    const pulses = [...(state.pulseHistoryDeleted ? [] : persona.pulse), ...(state.pulse || [])].sort((a, b) => a.date.localeCompare(b.date));
    const last = pulses[pulses.length - 1];
    if (last && last.score <= 2) { signals.push({ kind: "pulse_low", score: last.score, date: last.date, comment: last.comment || "", severity: "medium", source: "pulse_feedback (opt-in)" }); pulseUsed = true; }
  }
  let level = signals.reduce((m, s) => (rank[s.severity] > rank[m] ? s.severity : m), "low");
  if (pulseUsed && level === "medium" && signals.length > 1) level = "high";
  const ops = signals.filter((s) => s.owner).sort((a, b) => rank[b.severity] - rank[a.severity] || (b.daysOver || b.daysOpen || 0) - (a.daysOver || a.daysOpen || 0));
  const primaryOwner = ops[0]?.owner || "OWN-HRBP";
  return { level, signals, primaryOwner, primaryOwnerName: ownerOf(primaryOwner).name, recommendEscalation: level === "high", pulseUsed, consentPulse: !!state.consent?.pulse };
}

// ---------- 6. Escalation summary ----------
export function buildEscalation(persona, today, state = {}, { sharePulse = false, note = "" } = {}) {
  const fr = detectFriction(persona, today, state);
  const status = journeyStatus(persona, today, state);
  const signals = fr.signals.filter((s) => s.kind !== "pulse_low" || sharePulse);
  const o = ownerOf(fr.primaryOwner);
  const lines = signals.map((s) => {
    if (s.kind === "step_overdue") return `${s.step.en} (${s.stepId}) is ${s.daysOver} days past target.`;
    if (s.kind === "step_blocked") return `${s.step.en} (${s.stepId}) is blocked waiting on ${s.dependsOn}, ${s.daysOver} days past target.`;
    if (s.kind === "request_delayed") return `Request ${s.requestId} (${s.typeName.en}) open ${s.daysOpen} days vs ${s.slaDays}-day target.`;
    if (s.kind === "pulse_low") return `Employee chose to share pulse feedback: ${s.score}/5${s.comment ? ` "${s.comment}"` : ""}.`;
    return "";
  });
  const summary = `${persona.name} (${persona.id}), ${persona.role}, ${JOURNEY_MAPS[persona.journey].name.en} day ${status.day}. ` + lines.join(" ") +
    (note ? ` Employee note: "${note}"` : "") + ` Requested: confirm what is outstanding and give the employee a date for the next update.`;
  const policies = [...new Set(signals.map((s) => status.steps.find((x) => x.id === s.stepId)?.policy || (s.requestType && REQUEST_TYPES[s.requestType].policy)).filter(Boolean))];
  return {
    ownerId: o.id, ownerName: o.name, ownerRole: o.role, cc: fr.level === "high" && o.id !== "OWN-HRBP" ? ["OWN-HRBP"] : [],
    level: fr.level, signals, summary, policies, stepIds: signals.map((s) => s.stepId).filter(Boolean), requestIds: signals.map((s) => s.requestId).filter(Boolean),
    sharePulse: !!sharePulse && fr.consentPulse,
  };
}

// ---------- 7. Aggregate stall view (no individuals) ----------
export const MIN_GROUP = 5;
function prng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function generatePopulation(today, n = 200, seed = 20261018) {
  const r = prng(seed);
  const pop = [];
  for (let i = 0; i < n; i++) {
    const journey = r() < 0.6 ? "onboarding" : "mobility";
    const start = addDays(today, -Math.floor(r() * 45));
    const needsVisa = journey === "onboarding" && r() < 0.55;
    const locationMove = journey === "mobility" && r() < 0.35;
    const p = { id: `S-${2000 + i}`, journey, startDate: start, needsVisa, locationMove, events: [], requests: [], pulse: [] };
    const map = JOURNEY_MAPS[journey];
    const appl = map.steps.filter((s) => !((s.requiresVisa && !needsVisa) || (s.locationMoveOnly && !locationMove)));
    const applIds = new Set(appl.map((s) => s.id));
    for (const s of appl) {
      const slow = s.owner === "OWN-VISA" ? 0.35 : s.owner === "OWN-MOB" ? 0.4 : s.owner === "OWN-IT" ? 0.25 : 0.1;
      const delay = r() < slow ? 2 + Math.floor(r() * 12) : Math.floor(r() * 2);
      const when = addDays(start, s.targetDay - 1 + delay);
      if (when <= today && (!s.dependsOn || !applIds.has(s.dependsOn) || p.events.some((e) => e.step === s.dependsOn))) p.events.push({ step: s.id, date: when });
    }
    pop.push(p);
  }
  return pop;
}
export function stallView(today, population = generatePopulation(today)) {
  const rows = [];
  for (const map of Object.values(JOURNEY_MAPS)) for (const step of map.steps) {
    let stalled = 0, eligible = 0, delays = [];
    for (const p of population) {
      if (p.journey !== map.id) continue;
      if ((step.requiresVisa && !p.needsVisa) || (step.locationMoveOnly && !p.locationMove)) continue;
      const target = addDays(p.startDate, step.targetDay - 1);
      if (target > today) continue;
      eligible++;
      const ev = p.events.find((e) => e.step === step.id);
      if (!ev) stalled++; else delays.push(Math.max(0, daysBetween(target, ev.date)));
    }
    delays.sort((a, b) => a - b);
    const median = delays.length ? delays[Math.floor(delays.length / 2)] : null;
    rows.push({ journey: map.id, stepId: step.id, step: step.name, owner: step.owner, ownerName: ownerOf(step.owner).name, eligible, stalled: stalled < MIN_GROUP ? null : stalled, suppressed: stalled > 0 && stalled < MIN_GROUP, stalledRate: stalled < MIN_GROUP || !eligible ? null : Math.round((stalled / eligible) * 100), medianDelayDays: delays.length >= MIN_GROUP ? median : null });
  }
  return { population: population.length, minGroup: MIN_GROUP, rows };
}
export { getSection };
