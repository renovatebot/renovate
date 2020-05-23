let repoCache: Record<string, any>;

export function init(): void {
  repoCache = {};
}

export function get<T = any>(key: string): T {
  return repoCache ? repoCache[key] : undefined;
}

export function set(key: string, value: any): void {
  if (repoCache) {
    repoCache[key] = value;
  }
}
