import is from '@sindresorhus/is';
import { miscUtils, structUtils } from '@yarnpkg/core';
import { parseSyml } from '@yarnpkg/parsers';
import { logger } from '../../../../logger';
import {
  getSiblingFileName,
  localPathExists,
  readLocalFile,
} from '../../../../util/fs';
import type { LockFile } from './types';

export async function getYarnLock(filePath: string): Promise<LockFile> {
  // TODO #7154
  const yarnLockRaw = (await readLocalFile(filePath, 'utf8'))!;
  try {
    const parsed = parseSyml(yarnLockRaw);
    const lockedVersions: Record<string, string> = {};
    let lockfileVersion: number | undefined;

    for (const [key, val] of Object.entries(parsed)) {
      if (key === '__metadata') {
        // yarn 2
        lockfileVersion = parseInt(val.cacheKey, 10);
      } else {
        for (const entry of key.split(', ')) {
          try {
            const { scope, name, range } = structUtils.parseDescriptor(entry);
            const packageName = scope ? `@${scope}/${name}` : name;
            const { selector } = structUtils.parseRange(range);

            logger.trace({ entry, version: val.version });
            lockedVersions[packageName + '@' + selector] = parsed[key].version;
          } catch (err) {
            logger.debug(
              { entry, err },
              'Invalid descriptor or range found in yarn.lock'
            );
          }
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

export function getZeroInstallPaths(yarnrcYml: string): string[] {
  const conf = parseSyml(yarnrcYml);
  const paths = [
    conf.cacheFolder || './.yarn/cache',
    '.pnp.cjs',
    '.pnp.js',
    '.pnp.loader.mjs',
  ];
  if (miscUtils.tryParseOptionalBoolean(conf.pnpEnableInlining) === false) {
    paths.push(conf.pnpDataPath || './.pnp.data.json');
  }
  return paths;
}

export async function isZeroInstall(yarnrcYmlPath: string): Promise<boolean> {
  const yarnrcYml = await readLocalFile(yarnrcYmlPath, 'utf8');
  if (is.string(yarnrcYml)) {
    const paths = getZeroInstallPaths(yarnrcYml);
    for (const p of paths) {
      if (await localPathExists(getSiblingFileName(yarnrcYmlPath, p))) {
        logger.debug(`Detected Yarn zero-install in ${p}`);
        return true;
      }
    }
  }
  return false;
}
