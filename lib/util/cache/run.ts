let repoCache: Record<string, any> = {};

export function clear(): void {
  repoCache = {};
}

export function get<T = any>(key: string): T {
  return repoCache[key];
}

export function set(key: string, value: any): void {
  repoCache[key] = value;
}
