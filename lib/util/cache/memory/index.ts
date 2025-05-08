let memCache: Record<string, any> | undefined;

export function init(): void {
  memCache = {};
}

export function reset(): void {
  memCache = undefined;
}

export function get<T = any>(key: string): T {
  return memCache?.[key];
}

export function set(key: string, value: unknown): void {
  if (memCache) {
    memCache[key] = value;
  }
}

export function cleanDatasourceKeys(): void {
  if (memCache) {
    for (const key of Object.keys(memCache)) {
      if (
        key.startsWith('datasource-mem:pkg-fetch:') ||
        key.startsWith('datasource-mem:releases:')
      ) {
        delete memCache[key];
      }
    }
  }
}
