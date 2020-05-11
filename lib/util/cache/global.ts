export function get<T = any>(namespace: string, key: string): Promise<T> {
  return renovateCache.get(namespace, key);
}

export function set(
  namespace: string,
  key: string,
  value: any,
  minutes: number
): Promise<void> {
  return renovateCache.set(namespace, key, value, minutes);
}

export function rmAll(): Promise<void> {
  return renovateCache.rmAll();
}
