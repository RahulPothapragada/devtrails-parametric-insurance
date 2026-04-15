/**
 * Centralized API configuration.
 *
 * In development  → defaults to http://127.0.0.1:8000/api
 * In production   → reads VITE_API_URL from Render/Vercel env vars
 */
export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000/api';
