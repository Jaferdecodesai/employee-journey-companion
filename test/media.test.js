import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaResponse as mr } from "../src/lib/media.js";
const mediaResponse = (q, a) => mr(q, a, (r) => { r.headers.set("Content-Security-Policy", "default-src 'self'"); return r; });
const asset = () => new Response(new Uint8Array(Array.from({ length: 100 }, (_, i) => i)), { headers: { "Content-Type": "video/mp4", "Content-Length": "100" } });
const req = (range) => new Request("https://x/demo.mp4", range ? { headers: { Range: range } } : {});
test("no Range: 200 with Accept-Ranges and security headers", async () => {
  const r = await mediaResponse(req(), asset());
  assert.equal(r.status, 200); assert.equal(r.headers.get("Accept-Ranges"), "bytes"); assert.ok(r.headers.get("Content-Security-Policy"));
});
test("bytes=10-19: 206 with exact slice", async () => {
  const r = await mediaResponse(req("bytes=10-19"), asset());
  assert.equal(r.status, 206); assert.equal(r.headers.get("Content-Range"), "bytes 10-19/100");
  assert.deepEqual([...new Uint8Array(await r.arrayBuffer())], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
});
test("open-ended and suffix ranges", async () => {
  assert.equal((await mediaResponse(req("bytes=90-"), asset())).headers.get("Content-Range"), "bytes 90-99/100");
  assert.equal((await mediaResponse(req("bytes=-5"), asset())).headers.get("Content-Range"), "bytes 95-99/100");
});
test("unsatisfiable range: 416", async () => {
  assert.equal((await mediaResponse(req("bytes=200-300"), asset())).status, 416);
  assert.equal((await mediaResponse(req("items=1-2"), asset())).status, 416);
});
