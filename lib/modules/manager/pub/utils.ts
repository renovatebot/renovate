import { load } from 'js-yaml';
import { logger } from '../../../logger';
import { Lazy } from '../../../util/lazy';
import { PubspecLockSchema } from './schema';

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
  try {
    const data = load(fileContent, { json: true });
    const res = PubspecLockSchema.safeParse(data);
    if (res.success) {
      return res.data;
    } else {
      logger.debug(res.error, `Error parsing ${fileName} file`);
    }
  } catch (err) {
    logger.debug({ err }, `Error parsing ${fileName} file`);
  }
  return null;
}
