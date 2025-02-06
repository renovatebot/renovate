import { logger } from '../../../logger';
import type { PubspecLockSchema, PubspecSchema } from './schema';
import { PubspecLockYaml, PubspecYaml } from './schema';

export function parsePubspec(
  fileName: string,
  fileContent: string,
): PubspecSchema | null {
  const res = PubspecYaml.safeParse(fileContent);
  if (res.success) {
    return res.data;
  } else {
    logger.debug({ err: res.error, fileName }, 'Error parsing pubspec.');
  }
  return null;
}

export function parsePubspecLock(
  fileName: string,
  fileContent: string,
): PubspecLockSchema | null {
  const res = PubspecLockYaml.safeParse(fileContent);
  if (res.success) {
    return res.data;
  } else {
    logger.debug(
      { err: res.error, fileName },
      'Error parsing pubspec lockfile.',
    );
  }
  return null;
}
