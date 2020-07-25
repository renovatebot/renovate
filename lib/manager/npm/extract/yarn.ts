import { structUtils } from '@yarnpkg/core';
import { parseSyml } from '@yarnpkg/parsers';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';

export async function getYarnLock(
  filePath: string
): Promise<{ isYarn1: boolean; lockedVersions: Record<string, string> }> {
  const yarnLockRaw = await readLocalFile(filePath, 'utf8');
  try {
    const parsed = parseSyml(yarnLockRaw);
    const lockFile: Record<string, string> = {};

    for (const [key, val] of Object.entries(parsed)) {
      if (key === '__metadata') {
        // yarn 2
      } else {
        for (const entry of key.split(', ')) {
          const { scope, name, range } = structUtils.parseDescriptor(entry);
          const packageName = scope ? `${scope}/${name}` : name;
          const { selector } = structUtils.parseRange(range);

          logger.trace({ entry, version: val.version });
          lockFile[packageName + '@' + selector] = parsed[key].version;
        }
      }
    }
    return {
      isYarn1: !('__metadata' in parsed),
      lockedVersions: lockFile,
    };
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing yarn.lock');
    return { isYarn1: true, lockedVersions: {} };
  }
}
