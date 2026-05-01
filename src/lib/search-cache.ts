import { SearchResult } from "./types";

export type CachedPageStatus = "ok" | "timeout" | "forbidden";

export interface CachedPageEntry {
  expiresAt: number;
  status: CachedPageStatus;
  data: SearchResult[];
  pageCount?: number;
}

const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;
const SEARCH_CACHE: Map<string, CachedPageEntry> = new Map();

function makeSearchCacheKey(
  sourceKey: string,
  query: string,
  page: number
): string {
  return `${sourceKey}::${query.trim()}::${page}`;
}

export function getCachedSearchPage(
  sourceKey: string,
  query: string,
  page: number
): CachedPageEntry | null {
  const key = makeSearchCacheKey(sourceKey, query, page);
  const entry = SEARCH_CACHE.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    SEARCH_CACHE.delete(key);
    return null;
  }

  return entry;
}

export function setCachedSearchPage(
  sourceKey: string,
  query: string,
  page: number,
  status: CachedPageStatus,
  data: SearchResult[],
  pageCount?: number
): void {
  const now = Date.now();
  const key = makeSearchCacheKey(sourceKey, query, page);

  if (SEARCH_CACHE.size > MAX_CACHE_SIZE) {
    const entries = Array.from(SEARCH_CACHE.entries());
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = SEARCH_CACHE.size - MAX_CACHE_SIZE;
    for (let i = 0; i < toRemove; i++) {
      SEARCH_CACHE.delete(entries[i][0]);
    }
  }

  SEARCH_CACHE.set(key, {
    expiresAt: now + SEARCH_CACHE_TTL_MS,
    status,
    data,
    pageCount,
  });
}

export function clearSearchCache(): void {
  SEARCH_CACHE.clear();
}
