import { Mutex, type MutexInterface, withTimeout } from 'async-mutex';

const DEFAULT_NAMESPACE = 'default';
const mutexes: Record<string, Record<string, MutexInterface>> = {};

export function getMutex(
  key: string,
  namespace: string = DEFAULT_NAMESPACE,
): MutexInterface {
  mutexes[namespace] ??= {};
  // create a new mutex if it doesn't exist with a timeout of 2 minutes
  mutexes[namespace][key] ??= withTimeout(new Mutex(), 1000 * 60 * 2);
  return mutexes[namespace][key];
}

export function acquireLock(
  key: string,
  namespace: string = DEFAULT_NAMESPACE,
): Promise<MutexInterface.Releaser> {
  return getMutex(key, namespace).acquire();
}
