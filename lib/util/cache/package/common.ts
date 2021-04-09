export interface PackageCache {
  get<T = any>(namespace: string, key: string): Promise<T>;

  set<T = any>(
    namespace: string,
    key: string,
    value: T,
    ttlMinutes?: number
  ): Promise<void>;
}
