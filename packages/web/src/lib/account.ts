// Server-backed account gardens (Sent + Received), read cross-device. Mirrors the API's
// GardenSummary. Anonymous users don't use this — they read the on-device archive (lib/mine.ts).

export interface GardenSummary {
  id: string;
  from: string;
  to: string;
  occasion?: string;
  createdAt: string;
  unlockAt?: string;
  swatches: string[];
  /** Present only on received gardens. */
  receivedAt?: string;
}

export async function fetchMine(): Promise<{ sent: GardenSummary[]; received: GardenSummary[] }> {
  const r = await fetch('/api/mine', { credentials: 'include' });
  if (!r.ok) throw new Error('Could not load your gardens.');
  return (await r.json()) as { sent: GardenSummary[]; received: GardenSummary[] };
}

/** Adopt on-device (anonymous) gardens into the account. Returns how many were claimed. */
export async function claimGardens(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const r = await fetch('/api/mine/claim', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!r.ok) return 0;
  return ((await r.json()) as { claimed: number }).claimed;
}

/**
 * Best-effort: add a garden the signed-in user opened to their Received list. Resolves to whether
 * it was newly saved (false for your own garden), so the view can confirm it discoverably.
 */
export async function recordReceived(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/garden/${id}/receive`, { method: 'POST', credentials: 'include' });
    if (!r.ok) return false;
    return ((await r.json()) as { saved?: boolean }).saved === true;
  } catch {
    return false;
  }
}

/** Remove a garden from the signed-in user's Sent/Received lists (persists across devices). */
export async function removeFromAccount(id: string): Promise<void> {
  await fetch(`/api/garden/${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
}
