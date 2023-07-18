import { Lazy } from '../../../util/lazy';
import { PubspecLockSchema } from './schema';

export function lazyParsePubspeckLock(
  fileContent: string
): Lazy<PubspecLockSchema | undefined> {
  return new Lazy(() => parsePubspecLock(fileContent));
}

function parsePubspecLock(fileContent: string): PubspecLockSchema | undefined {
  const res = PubspecLockSchema.safeParse(fileContent);
  if (res.success) {
    return res.data;
  }
  return;
}
