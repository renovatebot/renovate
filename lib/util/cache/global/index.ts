import * as runCache from '../run';
import * as fileCache from './file';

function getGlobalKey(namespace: string, key: string): string {
  return `global%%${namespace}%%${key}`;
}

export function get<T = any>(namespace: string, key: string): Promise<T> {
  if (!global.renovateCache) {
    return undefined;
  }
  const globalKey = getGlobalKey(namespace, key);
  if (!runCache.get(globalKey)) {
    runCache.set(globalKey, global.renovateCache.get(namespace, key));
  }
  return runCache.get(globalKey);
}

export function set(
  namespace: string,
  key: string,
  value: any,
  minutes: number
): Promise<void> {
  if (!global.renovateCache) {
    return undefined;
  }
  const globalKey = getGlobalKey(namespace, key);
  runCache.set(globalKey, value);
  return global.renovateCache.set(namespace, key, value, minutes);
}

export function init(cacheDir: string): void {
  return fileCache.init(cacheDir);
}
