import { load } from 'js-yaml';
import { Lazy } from '../../../util/lazy';
import { PubspecLockSchema } from './schema';

export function lazyParsePubspeckLock(
  fileContent: string
): Lazy<PubspecLockSchema | null> {
  return new Lazy(() => parsePubspecLock(fileContent));
}

function parsePubspecLock(fileContent: string): PubspecLockSchema | null {
  try {
    const data = load(fileContent, { json: true });
    const res = PubspecLockSchema.safeParse(data);
    if (res.success) {
      return res.data;
    }
  } catch {
    // Do nothing
  }
  return null;
}
