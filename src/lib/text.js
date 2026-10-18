// Text normalisation and tokenisation for English + Arabic retrieval.
const AR_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
export function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .replace(AR_DIACRITICS, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
const STOP = new Set(("a an the is are am be been do does did i me my mine you your it its to of for in on at and or with about " +
  "this that there what where why which who how need want can could when will would should get got have has had any some please hi hello tell " +
  "في من على هل ما متى كيف ان الي الى عن لي انا هذا هذه ماذا او و يا اين لماذا اريد احتاج").split(" ").map(normalize));
export function stem(t) {
  if (/^[\u0600-\u06FF]+$/.test(t)) {
    if (t.length > 4 && t.startsWith("ال")) t = t.slice(2);
    if (t.length > 4 && (t.startsWith("وال") || t.startsWith("بال"))) t = t.slice(3);
    return t;
  }
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 4 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}
export function tokens(s) {
  return normalize(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t && t.length > 1 && !STOP.has(t))
    .map(stem);
}
export function clean(s, max) {
  // strip control characters, collapse whitespace, cap length
  return String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
