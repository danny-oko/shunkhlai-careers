/**
 * Two brakes on password guessing, pulling in opposite directions on purpose.
 *
 * A single counter cannot do this job. Key it on the address and an attacker
 * who can pick their address has no limit at all; key it on the email and
 * anyone who knows an admin's address can lock that admin out by failing five
 * times on their behalf. The first is unlimited guessing, the second is a
 * denial of service, and a scheme that only has one counter is choosing which
 * of the two to have.
 *
 * So:
 *
 * - **Per address — a hard refusal.** Ten failures in the window and that
 *   address is refused outright, correct password included. This is only
 *   armed when the address is trustworthy (see `clientIp` in the login
 *   action): a spoofable address must never be able to refuse anybody.
 * - **Per email — a delay, never a refusal.** After three failures the answer
 *   is slowed down, doubling to a two-second cap. Guessing drops from ~50
 *   tries a second to under one, and a correct password is *always* still
 *   accepted, so no third party can shut a real admin out of their own
 *   account by failing on their behalf.
 *
 * **In-process, on purpose.** Both counters live in a `Map` in this Node
 * process: they are lost on a restart and are not shared between instances,
 * so they are brakes and not guarantees. That is the right size for this
 * deployment — one `next start` on the customer's own network — and if the
 * app is ever run as more than one process this is the file that moves to the
 * database or to Redis; nothing else about the sign-in path would change.
 *
 * The clock is a parameter throughout, so the tests move time instead of
 * waiting.
 */

/** How far back failures are counted, for both brakes. */
export const WINDOW_MS = 15 * 60 * 1000;

/** Failures from one address before it is refused outright. */
export const MAX_IP_FAILURES = 10;

/** Failures against one email before the answers start being slowed down. */
export const EMAIL_FREE_ATTEMPTS = 3;

/** The first delay, which then doubles per failure. */
export const THROTTLE_STEP_MS = 250;

/** The ceiling on that delay. Long enough to matter, short enough to answer. */
export const MAX_THROTTLE_MS = 2000;

/**
 * A ceiling on each map, so a flood of invented addresses cannot grow them
 * without bound. Entries expire on their own; this only matters under attack,
 * and dropping the least recently used is the harmless failure — it forgives
 * some failures rather than refusing anyone wrongly.
 */
const MAX_KEYS = 10_000;

type Attempts = { count: number; firstAt: number; lastAt: number };

const byAddress = new Map<string, Attempts>();
const byEmail = new Map<string, Attempts>();

function prune(map: Map<string, Attempts>, now: number): void {
  for (const [key, entry] of map) {
    if (now - entry.firstAt >= WINDOW_MS) map.delete(key);
  }
  if (map.size <= MAX_KEYS) return;
  const oldest = [...map.entries()]
    .sort((a, b) => a[1].lastAt - b[1].lastAt)
    .slice(0, map.size - MAX_KEYS);
  for (const [key] of oldest) map.delete(key);
}

/** Failures for this key inside the window; lapsed entries are dropped. */
function countIn(map: Map<string, Attempts>, key: string, now: number): number {
  const entry = map.get(key);
  if (!entry) return 0;
  if (now - entry.firstAt >= WINDOW_MS) {
    map.delete(key);
    return 0;
  }
  return entry.count;
}

function record(map: Map<string, Attempts>, key: string, now: number): number {
  const entry = map.get(key);
  // The window runs from the first failure, not the last, so failing slowly
  // does not buy a fresh allowance every time.
  if (!entry || now - entry.firstAt >= WINDOW_MS) {
    map.set(key, { count: 1, firstAt: now, lastAt: now });
    prune(map, now);
    return 1;
  }
  entry.count += 1;
  entry.lastAt = now;
  return entry.count;
}

/** Lowercased and trimmed, so case and spacing cannot buy extra attempts. */
export function emailKey(email: string): string {
  return email.trim().toLowerCase();
}

/* --- per address: a hard refusal ---------------------------------------- */

export function isAddressLockedOut(ip: string, now: number = Date.now()): boolean {
  return countIn(byAddress, ip, now) >= MAX_IP_FAILURES;
}

export function recordAddressFailure(ip: string, now: number = Date.now()): number {
  return record(byAddress, ip, now);
}

export function clearAddressFailures(ip: string): void {
  byAddress.delete(ip);
}

/* --- per email: a delay --------------------------------------------------*/

/**
 * How long this email's next answer should be held back. Zero for the first
 * few failures, then doubling to the cap.
 *
 * Never a refusal, and that is the point: whatever this returns, the password
 * is still checked and a correct one still signs in.
 */
export function throttleDelayMs(email: string, now: number = Date.now()): number {
  const failures = countIn(byEmail, emailKey(email), now);
  if (failures <= EMAIL_FREE_ATTEMPTS) return 0;
  const steps = failures - EMAIL_FREE_ATTEMPTS - 1;
  return Math.min(MAX_THROTTLE_MS, THROTTLE_STEP_MS * 2 ** steps);
}

export function recordEmailFailure(email: string, now: number = Date.now()): number {
  return record(byEmail, emailKey(email), now);
}

export function emailFailureCount(email: string, now: number = Date.now()): number {
  return countIn(byEmail, emailKey(email), now);
}

export function clearEmailFailures(email: string): void {
  byEmail.delete(emailKey(email));
}

/** Test-only: empties both counters between cases. */
export function resetRateLimit(): void {
  byAddress.clear();
  byEmail.clear();
}

/** The real delay. Injectable at the call site so tests do not sleep. */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
