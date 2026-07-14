import type { Env } from './env.js';

// 6 chars of a curated base62 (no 0/O/1/l/I) = ~56 billion ids; collisions are effectively
// impossible for this app's volume, but we still retry on the rare hit. The short code IS the
// primary key — KV stores work this way.
const ID_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ID_LENGTH = 6;
const MAX_COLLISION_RETRIES = 4;
const MAX_GARDEN_BYTES = 16 * 1024; // real gardens are ~2KB; reject anything that would blow the budget
const ID_RE = /^[A-Za-z0-9]{4,12}$/;

// KV layout:
//   g:<id>              -> full garden JSON (immutable; may carry ownerId once claimed/created signed-in)
//   sent:<userId>:<id>  -> GardenSummary   (the user's outbox; listable by prefix)
//   recv:<userId>:<id>  -> GardenSummary   (gardens a signed-in user opened; receivedAt set)
// Prefix-keyed indexes avoid read-modify-write races on a single list blob.
//
// Deliberately no expirationTtl: a garden is a keepsake, so a shared link must keep working
// indefinitely. Auto-expiry would break links already sent, and KV's free tier (1 GB) holds
// far more gardens than this ever needs. Users prune their own lists via removeFromAccount.

/** Thin per-garden card data for /mine, so listing never reads every full garden. */
export interface GardenSummary {
  id: string;
  from: string;
  to: string;
  occasion?: string;
  createdAt: string;
  unlockAt?: string;
  swatches: string[];
  /** Set only on received items. */
  receivedAt?: string;
}

function generateId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = '';
  for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[bytes[i]! % ID_ALPHABET.length];
  return id;
}

/** Cheap structural check: shaped like a garden, and not absurdly large. */
export function looksLikeGarden(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const g = value as Record<string, unknown>;
  // The design path produces 3–5 flowers and both renderers (GardenScene, the share image) are
  // laid out for that; cap the write at 5 so a crafted payload can't store a garden that overlaps.
  return Array.isArray(g.flowers) && g.flowers.length > 0 && g.flowers.length <= 5;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function summarize(id: string, garden: Record<string, unknown>): GardenSummary {
  const flowers = Array.isArray(garden.flowers) ? garden.flowers : [];
  const swatches: string[] = [];
  for (const f of flowers.slice(0, 5)) {
    const pc = (f as Record<string, unknown> | null)?.petalColors;
    const first = Array.isArray(pc) ? pc[0] : undefined;
    if (typeof first === 'string') swatches.push(first);
  }
  const summary: GardenSummary = {
    id,
    from: str(garden.from),
    to: str(garden.to),
    createdAt: str(garden.createdAt) || new Date().toISOString(),
    swatches,
  };
  if (typeof garden.occasion === 'string') summary.occasion = garden.occasion;
  if (typeof garden.unlockAt === 'string') summary.unlockAt = garden.unlockAt;
  return summary;
}

export type CreateResult = { ok: true; id: string } | { ok: false; status: 400 | 413 | 500; message: string };

/** Create a garden. When `ownerId` is set (a signed-in creator), stamp it and index it as Sent. */
export async function createGarden(env: Env, garden: unknown, ownerId?: string): Promise<CreateResult> {
  if (!looksLikeGarden(garden)) return { ok: false, status: 400, message: 'Body does not look like a garden.' };
  // Shallow-copy so we never mutate the caller's object when stamping ownerId.
  const obj = { ...(garden as Record<string, unknown>) };
  if (ownerId) obj.ownerId = ownerId;
  const serialized = JSON.stringify(obj);
  if (serialized.length > MAX_GARDEN_BYTES) {
    return { ok: false, status: 413, message: `Garden exceeds ${MAX_GARDEN_BYTES} bytes.` };
  }
  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const id = generateId();
    if ((await env.GARDENS.get(`g:${id}`)) === null) {
      await env.GARDENS.put(`g:${id}`, serialized);
      if (ownerId) await env.GARDENS.put(`sent:${ownerId}:${id}`, JSON.stringify(summarize(id, obj)));
      return { ok: true, id };
    }
  }
  return { ok: false, status: 500, message: 'Could not generate a unique id. Try again.' };
}

/** Read a garden by short id, or null if the id is malformed or unknown. */
export async function readGarden(env: Env, id: string): Promise<unknown | null> {
  if (!ID_RE.test(id)) return null;
  const raw = await env.GARDENS.get(`g:${id}`);
  return raw === null ? null : (JSON.parse(raw) as unknown);
}

/**
 * Record that a signed-in user opened someone else's garden (adds it to their Received list).
 * Returns whether it was actually saved — false for your own gardens or an unknown id — so the
 * UI can show a "saved to your gardens" confirmation only when something really happened.
 */
export async function recordReceived(env: Env, userId: string, id: string): Promise<boolean> {
  if (!ID_RE.test(id)) return false;
  const raw = await env.GARDENS.get(`g:${id}`);
  if (raw === null) return false;
  const garden = JSON.parse(raw) as Record<string, unknown>;
  if (garden.ownerId === userId) return false; // your own garden isn't "received"
  await env.GARDENS.put(
    `recv:${userId}:${id}`,
    JSON.stringify({ ...summarize(id, garden), receivedAt: new Date().toISOString() }),
  );
  return true;
}

/**
 * Remove a garden from a user's Sent + Received lists. The garden itself (`g:<id>`) is kept, so
 * any link already shared still opens — this only detaches it from this account's lists.
 */
export async function removeFromAccount(env: Env, userId: string, id: string): Promise<void> {
  if (!ID_RE.test(id)) return;
  await Promise.all([
    env.GARDENS.delete(`sent:${userId}:${id}`),
    env.GARDENS.delete(`recv:${userId}:${id}`),
  ]);
}

async function listByPrefix(env: Env, prefix: string): Promise<GardenSummary[]> {
  const listed = await env.GARDENS.list({ prefix });
  const values = await Promise.all(listed.keys.map((k) => env.GARDENS.get(k.name)));
  const out = values.filter((v): v is string => v !== null).map((v) => JSON.parse(v) as GardenSummary);
  // Newest first, by receivedAt (received) or createdAt (sent).
  out.sort((a, b) => (b.receivedAt ?? b.createdAt).localeCompare(a.receivedAt ?? a.createdAt));
  return out;
}

/** The signed-in user's gardens: ones they grew (Sent) and ones they opened (Received). */
export async function listMine(env: Env, userId: string): Promise<{ sent: GardenSummary[]; received: GardenSummary[] }> {
  const [sent, received] = await Promise.all([
    listByPrefix(env, `sent:${userId}:`),
    listByPrefix(env, `recv:${userId}:`),
  ]);
  return { sent, received };
}

/** Adopt anonymous on-device gardens into an account (first-login claim). Only unowned ones. */
export async function claimGardens(env: Env, userId: string, ids: string[]): Promise<number> {
  let claimed = 0;
  for (const id of ids.slice(0, 100)) {
    if (!ID_RE.test(id)) continue;
    const raw = await env.GARDENS.get(`g:${id}`);
    if (raw === null) continue;
    const garden = JSON.parse(raw) as Record<string, unknown>;
    if (garden.ownerId) continue; // already owned by someone
    garden.ownerId = userId;
    await env.GARDENS.put(`g:${id}`, JSON.stringify(garden));
    await env.GARDENS.put(`sent:${userId}:${id}`, JSON.stringify(summarize(id, garden)));
    claimed++;
  }
  return claimed;
}
