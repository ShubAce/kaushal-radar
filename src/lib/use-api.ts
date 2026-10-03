"use client";

import { useEffect, useState } from "react";

const cache = new Map<string, unknown>();

/**
 * Fetch JSON from this app's own API. While a new request is in flight the
 * previous result stays on screen (`loading` is true), so charts never flash
 * empty between filter changes.
 */
export function useApi<T>(url: string | null): { data: T | undefined; loading: boolean; error: string | undefined } {
  // the last response that arrived, and the request it answered
  const [got, setGot] = useState<{ url: string; data?: T; error?: string } | null>(null);

  useEffect(() => {
    if (!url || cache.has(url)) return;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body?.error?.message ?? `Request failed (${r.status})`);
        return body as T;
      })
      .then((data) => {
        cache.set(url, data);
        setGot({ url, data });
      })
      .catch((e: Error) => {
        if (!ctrl.signal.aborted) setGot((prev) => ({ url, data: prev?.data, error: e.message }));
      });
    return () => ctrl.abort();
  }, [url]);

  const cached = url ? (cache.get(url) as T | undefined) : undefined;
  const settled = cached !== undefined || got?.url === url;
  return { data: cached ?? got?.data, loading: !!url && !settled, error: got?.url === url ? got.error : undefined };
}
