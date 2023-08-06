import { logger } from '../../../logger';
import { PubspecLockSchema, PubspecLockYaml } from './schema';

export function parsePubspecLock(
  fileName: string,
  fileContent: string
): PubspecLockSchema | null {
  const res = PubspecLockYaml.safeParse(fileContent);
  if (res.success) {
    return res.data;
  } else {
    logger.debug(
      { err: res.error, fileName },
      `Error parsing pubspec lockfile.`
    );
  }
  return null;
}
