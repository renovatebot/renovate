let repoCache: Record<string, any> | undefined;

export function init(): void {
  repoCache = {};
}

export function reset(): void {
  repoCache = undefined;
}

export function get<T = any>(key: string): T {
  return repoCache?.[key];
}

export function set(key: string, value: unknown): void {
  if (repoCache) {
    repoCache[key] = value;
  }
}
