import { structUtils } from '@yarnpkg/core';
import { parseSyml } from '@yarnpkg/parsers';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { LockFileEntry } from './common';

export type YarnLock = Record<string, string>;

export async function getYarnLock(filePath: string): Promise<YarnLock> {
  const yarnLockRaw = await readLocalFile(filePath, 'utf8');
  try {
    const parsed = parseSyml(yarnLockRaw);
    const lockFile: YarnLock = {};

    Object.keys(parsed).forEach((key) => {
      if (key === '__metadata') {
        return;
      }

      const val: LockFileEntry = parsed[key];

      key.split(', ').forEach((entry) => {
        const { scope, name, range } = structUtils.parseDescriptor(entry);
        const packageName = scope ? `${scope}/${name}` : name;
        const { selector } = structUtils.parseRange(range);

        logger.trace({ entry, version: val.version });
        lockFile[packageName + '@' + selector] = parsed[key].version;
      });

      // istanbul ignore if
      if (val.integrity) {
        lockFile['@renovate_yarn_integrity'] = true;
      }
    });
    return lockFile;
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing yarn.lock');
    return {};
  }
}
