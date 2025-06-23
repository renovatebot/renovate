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
  // TODO #22198
  const yarnLockRaw = (await readLocalFile(filePath, 'utf8'))!;
  try {
    const parsed = parseSyml(yarnLockRaw);
    const lockedVersions: Record<string, string> = {};
    let lockfileVersion: number | undefined;

    for (const [key, val] of Object.entries(parsed)) {
      if (key === '__metadata') {
        // yarn 2
        lockfileVersion = parseInt(val.cacheKey, 10);
        logger.once.debug(
          `yarn.lock ${filePath} has __metadata.cacheKey=${lockfileVersion}`,
        );
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
              'Invalid descriptor or range found in yarn.lock',
            );
          }
        }
      }
    }
    const isYarn1 = !('__metadata' in parsed);
    if (isYarn1) {
      logger.once.debug(
        `yarn.lock ${filePath} is has no __metadata so is yarn 1`,
      );
    } else {
      logger.once.debug(
        `yarn.lock ${filePath} is has __metadata so is yarn 2+`,
      );
    }
    return {
      isYarn1,
      lockfileVersion,
      lockedVersions,
    };
  } catch (err) {
    logger.debug({ filePath, err }, 'Warning: Exception parsing yarn.lock');
    return { isYarn1: true, lockedVersions: {} };
  }
}

export function getZeroInstallPaths(yarnrcYml: string): string[] {
  let conf: any;
  try {
    conf = parseSyml(yarnrcYml);
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error parsing .yarnrc.yml');
  }
  const paths = [
    conf?.cacheFolder || './.yarn/cache',
    '.pnp.cjs',
    '.pnp.js',
    '.pnp.loader.mjs',
  ];
  if (
    conf &&
    miscUtils.tryParseOptionalBoolean(conf.pnpEnableInlining) === false
  ) {
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

export function getYarnVersionFromLock(lockfile: LockFile): string {
  const { lockfileVersion, isYarn1 } = lockfile;
  if (isYarn1) {
    return '^1.22.18';
  }
  if (lockfileVersion && lockfileVersion >= 12) {
    // This will probably be v5
    return '>=4.0.0';
  }
  if (lockfileVersion && lockfileVersion >= 10) {
    return '^4.0.0';
  }
  if (lockfileVersion && lockfileVersion >= 8) {
    // https://github.com/yarnpkg/berry/commit/9bcd27ae34aee77a567dd104947407532fa179b3
    return '^3.0.0';
  } else if (lockfileVersion && lockfileVersion >= 6) {
    // https://github.com/yarnpkg/berry/commit/f753790380cbda5b55d028ea84b199445129f9ba
    return '^2.2.0';
  }

  return '^2.0.0';
}
