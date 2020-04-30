let repoCache: Record<string, unknown> = {};

export function clearRepoCache(): void {
  repoCache = {};
}

export function getRepoCached<T = unknown>(key: string): T {
  return repoCache[key];
}

export function setRepoCached(key: string, value: unknown): void {
  repoCache[key] = value;
}
