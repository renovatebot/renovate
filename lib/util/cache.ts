let repoCache: Record<string, any> = {};

export function clearRepoCache(): void {
  repoCache = {};
}

export function getRepoCached(key: string): any {
  return repoCache[key];
}

export function setRepoCached(key: string, value: any): void {
  repoCache[key] = value;
}
