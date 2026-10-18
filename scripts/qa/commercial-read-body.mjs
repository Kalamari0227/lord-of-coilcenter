export async function readCommercialJson(request, limit = 20_000_000) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > limit) throw new RangeError('QA observation exceeds the request limit');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
