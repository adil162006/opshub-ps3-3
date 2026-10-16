// Simulated HS256 JWT (client-only prototype). Server build would use jsonwebtoken.
const SECRET = 'opshub-dev-secret';
const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/=+$/, '');
const dec = (s) => JSON.parse(decodeURIComponent(escape(atob(s))));
function sig(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export function signJwt(payload, ttl = 8 * 3600) {
  const iat = Math.floor(Date.now() / 1000);
  const h = enc({ alg: 'HS256', typ: 'JWT' }); const p = enc({ ...payload, iat, exp: iat + ttl });
  return `${h}.${p}.${sig(h + '.' + p + SECRET)}`;
}
export function verifyJwt(t) {
  try {
    const [h, p, s] = t.split('.');
    if (sig(h + '.' + p + SECRET) !== s) return null;
    const pl = dec(p);
    return pl.exp * 1000 > Date.now() ? pl : null;
  } catch { return null; }
}
export const decodeJwt = (t) => { try { return dec(t.split('.')[1]); } catch { return null; } };
