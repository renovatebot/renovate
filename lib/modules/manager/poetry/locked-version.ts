import { parse } from '@iarna/toml';
import { logger } from '../../../logger';
import type { PoetryLock } from './types';

export function extractLockFileEntries(
  lockFileContent: string
): Record<string, string> {
  let poetryLockfile: PoetryLock = {};
  try {
    poetryLockfile = parse(lockFileContent);
  } catch (err) {
    logger.debug({ err }, 'Error parsing poetry.lock file');
  }

  const lockfileMapping: Record<string, string> = {};
  if (poetryLockfile?.package) {
    // Create a package->version mapping
    for (const poetryPackage of poetryLockfile.package) {
      if (poetryPackage.name && poetryPackage.version) {
        lockfileMapping[poetryPackage.name] = poetryPackage.version;
      }
    }
  }
  return lockfileMapping;
}
