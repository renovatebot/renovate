import { Mutex, type MutexInterface, withTimeout } from 'async-mutex';

const DEFAULT_NAMESPACE = 'default';
const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;
let mutexes: Record<string, Record<string, Mutex>> = {};

export function initMutexes(): void {
  mutexes = {};
}

export function getMutex(
  key: string,
  namespace: string = DEFAULT_NAMESPACE,
): Mutex {
  mutexes[namespace] ??= {};
  mutexes[namespace][key] ??= new Mutex();
  return mutexes[namespace][key];
}

export function acquireLock(
  key: string,
  namespace: string = DEFAULT_NAMESPACE,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<MutexInterface.Releaser> {
  return withTimeout(getMutex(key, namespace), timeoutMs).acquire();
}
