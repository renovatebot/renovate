export interface PackageCache {
  get<T = any>(namespace: string, key: string): Promise<T | undefined>;

  set<T = any>(
    namespace: string,
    key: string,
    value: T,
    ttlMinutes?: number,
  ): Promise<void>;

  cleanup?(): Promise<void>;
}

export interface DecoratorCachedRecord {
  value: unknown;
  cachedAt: string;
}
