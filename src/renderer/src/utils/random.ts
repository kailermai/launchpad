/** Cryptographically random index in [0, n) — no bias, no "it always picks the same one". */
export function randomIndex(n: number): number {
  if (n <= 0) return 0
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] % n
}
