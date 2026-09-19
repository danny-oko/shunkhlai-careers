/**
 * AES-256-GCM helpers for the secrets stored in `applicant_link`
 * (regno, phone-as-password, ERP tokens).
 *
 * Key comes from `APP_ENCRYPTION_KEY` — a base64-encoded 32-byte key. Generate
 * one with:  `openssl rand -base64 32`
 *
 * Format of an encrypted value: base64(iv[12] || ciphertext || tag), single
 * string, so it drops straight into a text column.
 */
const ALGO = "AES-GCM";

let cachedKey: CryptoKey | null = null;

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const b64 = process.env.APP_ENCRYPTION_KEY;
  if (!b64) throw new Error("APP_ENCRYPTION_KEY is not set");
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  if (raw.length !== 32) {
    throw new Error("APP_ENCRYPTION_KEY must decode to 32 bytes (base64 of `openssl rand -base64 32`)");
  }
  cachedKey = await crypto.subtle.importKey("raw", raw, ALGO, false, [
    "encrypt",
    "decrypt",
  ]);
  return cachedKey;
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: ALGO, iv }, key, data));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return btoa(String.fromCharCode(...packed));
}

export async function decryptSecret(packedB64: string): Promise<string> {
  const key = await getKey();
  const packed = Uint8Array.from(atob(packedB64), (c) => c.charCodeAt(0));
  const iv = packed.slice(0, 12);
  const ct = packed.slice(12);
  const pt = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ct);
  return new TextDecoder().decode(pt);
}
