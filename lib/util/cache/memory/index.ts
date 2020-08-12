let memCache: Record<string, any>[] | undefined;

export enum MemCacheBucket {
  default = 0,
  datasource,
}

export function init(): void {
  const bucketsCount = Object.keys(MemCacheBucket).length;
  memCache = new Array(bucketsCount);
  for (let i = 0; i < bucketsCount; i += 1) {
    memCache[i] = {};
  }
}

export function reset(bucket: MemCacheBucket = null): void {
  if (bucket === null) {
    memCache = undefined;
  } else if (memCache) {
    memCache[bucket] = {};
  }
}

export function get<T = any>(
  key: string,
  bucket: MemCacheBucket = MemCacheBucket.default
): T {
  return memCache?.[bucket]?.[key];
}

export function set(
  key: string,
  value: any,
  bucket: MemCacheBucket = MemCacheBucket.default
): void {
  if (memCache?.[bucket]) {
    memCache[bucket][key] = value;
  }
}
