import { logger } from '../../../logger';
import { Lazy } from '../../../util/lazy';
import { PubspecLockSchema, PubspecLockYaml } from './schema';

export function lazyParsePubspeckLock(
  fileName: string,
  fileContent: string
): Lazy<PubspecLockSchema | null> {
  return new Lazy(() => parsePubspecLock(fileName, fileContent));
}

function parsePubspecLock(
  fileName: string,
  fileContent: string
): PubspecLockSchema | null {
  const res = PubspecLockYaml.safeParse(fileContent);
  if (res.success) {
    return res.data;
  } else {
    logger.debug(res.error, `Error parsing ${fileName} file`);
  }
  return null;
}
