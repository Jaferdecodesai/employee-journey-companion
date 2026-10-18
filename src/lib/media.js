// Byte-range support for the demo video (Safari/iOS and seeking need 206 responses).
export async function mediaResponse(request, res, wrap = (r) => r) {
  const range = request.headers.get("Range");
  const base = { "Accept-Ranges": "bytes", "Content-Type": res.headers.get("Content-Type") || "video/mp4", "Cache-Control": "public, max-age=3600" };
  if (!range) return wrap(new Response(res.body, { status: 200, headers: { ...base, ...(res.headers.get("Content-Length") ? { "Content-Length": res.headers.get("Content-Length") } : {}) } }));
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start, end;
  if (m && (m[1] || m[2])) {
    if (m[1] === "") { start = Math.max(0, size - Number(m[2])); end = size - 1; }
    else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  }
  if (start === undefined || start > end || start >= size) {
    return wrap(new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${size}` } }));
  }
  return wrap(new Response(buf.slice(start, end + 1), { status: 206, headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) } }));
}
