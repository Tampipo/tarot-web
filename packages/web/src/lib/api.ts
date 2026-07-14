import axios from "axios";

// Empty base in prod → calls hit /api/* which nginx proxies to the API. Cookie
// auth means every request must carry credentials.
const base = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL: base ? base : "/api",
  withCredentials: true,
});

/** Pull a human-ish message out of an axios error for toasts/alerts. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    return data?.message ?? data?.error ?? err.message ?? fallback;
  }
  return fallback;
}
