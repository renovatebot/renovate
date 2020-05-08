let repoCache: Record<string, any> = {};

export function clearRepoCache(): void {
  repoCache = {};
}

export function getRepoCached<T = any>(key: string): T {
  return repoCache[key];
}

export function setRepoCached(key: string, value: any): void {
  repoCache[key] = value;
}
