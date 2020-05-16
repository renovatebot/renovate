import * as runCache from '../run';

function getGlobalKey(namespace: string, key: string): string {
  return `global%%${namespace}%%${key}`;
}

export function get<T = any>(namespace: string, key: string): Promise<T> {
  const globalKey = getGlobalKey(namespace, key);
  if (!runCache.get(globalKey)) {
    runCache.set(globalKey, renovateCache.get(namespace, key));
  }
  return runCache.get(globalKey);
}

export function set(
  namespace: string,
  key: string,
  value: any,
  minutes: number
): Promise<void> {
  const globalKey = getGlobalKey(namespace, key);
  runCache.set(globalKey, value);
  return renovateCache.set(namespace, key, value, minutes);
}

export function rmAll(): Promise<void> {
  return renovateCache.rmAll();
}
