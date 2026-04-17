/**
 * Centralized API configuration.
 *
 * In development  → defaults to http://127.0.0.1:8000/api
 * In production   → reads VITE_API_URL from Render/Vercel env vars
 */
export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000/api';

// Root URL (no /api prefix) for health checks
export const SERVER_ROOT = API_BASE.replace(/\/api$/, '');

/**
 * Ping the server until it responds. Used after Render cold starts.
 * Resolves true when healthy, false after maxWaitMs.
 */
export async function waitForServer(
  maxWaitMs = 60_000,
  onProgress?: (elapsed: number) => void,
): Promise<boolean> {
  const start = Date.now();
  const interval = 2000;
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${SERVER_ROOT}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return true;
    } catch { /* still starting */ }
    await new Promise(r => setTimeout(r, interval));
    onProgress?.(Date.now() - start);
  }
  return false;
}
