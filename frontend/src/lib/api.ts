/**
 * Centralized API configuration.
 *
 * In development  → defaults to http://127.0.0.1:8000/api
 * In production   → reads VITE_API_URL from Vercel env vars
 *
 * Set VITE_API_URL in Vercel dashboard → Settings → Environment Variables
 */
export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000/api';
