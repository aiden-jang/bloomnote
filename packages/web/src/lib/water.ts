/*
 * Watering a garden: the recipient's one-tap answer.
 *
 * The count is anonymous and lives on its own route because the garden itself is immutable and
 * cached for a year (see the API's water handlers). Whether *you* already watered is kept on this
 * device only — there is no identity to hang it on, and asking someone to sign in before they can
 * say "this was nice" would cost more than the gesture is worth.
 */

const KEY = 'bloomnote.watered.v1';
/** Plenty for one person's gardens, and small enough that the key can never grow unbounded. */
const REMEMBER_LIMIT = 200;

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    // Private mode, disabled storage, or junk in the key. Forgetting is harmless: the button comes
    // back and the server still counts.
    return [];
  }
}

export function hasWatered(id: string): boolean {
  return read().includes(id);
}

export function rememberWatered(id: string): void {
  try {
    const ids = read().filter(x => x !== id);
    ids.push(id);
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-REMEMBER_LIMIT)));
  } catch {
    // no-op
  }
}

/** How many times this garden has been watered. 0 on any failure — never blocks the view. */
export async function fetchWaters(id: string): Promise<number> {
  try {
    const r = await fetch(`/api/garden/${id}/water`);
    if (!r.ok) return 0;
    const n = ((await r.json()) as { waters?: unknown }).waters;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Water it. Resolves to the new count, or null if the write failed. */
export async function sendWater(id: string): Promise<number | null> {
  try {
    const r = await fetch(`/api/garden/${id}/water`, { method: 'POST' });
    if (!r.ok) return null;
    const n = ((await r.json()) as { waters?: unknown }).waters;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** "watered once" / "watered twice" / "watered 5 times" — the count as a sentence. */
export function watersLabel(n: number): string {
  if (n <= 0) return '';
  if (n === 1) return 'watered once';
  if (n === 2) return 'watered twice';
  return `watered ${n} times`;
}
