import { structUtils } from '@yarnpkg/core';
import { parseSyml } from '@yarnpkg/parsers';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import type { LockFile } from './types';

export async function getYarnLock(filePath: string): Promise<LockFile> {
  const yarnLockRaw = await readLocalFile(filePath, 'utf8');
  try {
    const parsed = parseSyml(yarnLockRaw);
    const lockedVersions: Record<string, string> = {};
    let lockfileVersion: number;

    for (const [key, val] of Object.entries(parsed)) {
      if (key === '__metadata') {
        // yarn 2
        lockfileVersion = parseInt(val.cacheKey, 10);
      } else {
        for (const entry of key.split(', ')) {
          const { scope, name, range } = structUtils.parseDescriptor(entry);
          const packageName = scope ? `@${scope}/${name}` : name;
          const { selector } = structUtils.parseRange(range);

          logger.trace({ entry, version: val.version });
          lockedVersions[packageName + '@' + selector] = parsed[key].version;
        }
      }
    }
    return {
      isYarn1: !('__metadata' in parsed),
      lockfileVersion,
      lockedVersions,
    };
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing yarn.lock');
    return { isYarn1: true, lockedVersions: {} };
  }
}
