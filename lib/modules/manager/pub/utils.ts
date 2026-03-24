import { logger } from '../../../logger/index.ts';
import { Pubspec, PubspecLock } from './schema.ts';

export function parsePubspec(
  fileName: string,
  fileContent: string,
): Pubspec | null {
  const res = Pubspec.safeParse(fileContent);
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
): PubspecLock | null {
  const res = PubspecLock.safeParse(fileContent);
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
