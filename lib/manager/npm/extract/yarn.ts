import { parseSyml } from '@yarnpkg/parsers';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { LockFileEntry } from './common';

export type YarnLock = Record<string, string>;

interface ParseRangeReturnType {
  protocol: string | null;
  source: string | null;
  selector: string | null;
  params: string | null;
}

// https:// github.com/yarnpkg/berry/blob/b128988379a1f257b2406ebf5058b67861403bd4/packages/yarnpkg-core/sources/structUtils.ts#L260-L303
/* istanbul ignore next */
export function parseRange(range: string): ParseRangeReturnType {
  const match = /^([^#:]*:)?((?:(?!::)[^#])*)(?:#((?:(?!::).)*))?(?:::(.*))?$/.exec(
    range
  );
  if (match === null) {
    throw new Error(`Invalid range (${range})`);
  }

  const protocol = typeof match[1] !== `undefined` ? match[1] : null;

  const source =
    typeof match[3] !== `undefined` ? decodeURIComponent(match[2]) : null;

  const rawSelector =
    typeof match[3] !== `undefined`
      ? decodeURIComponent(match[3])
      : decodeURIComponent(match[2]);

  const selector = rawSelector;

  const params = typeof match[4] !== `undefined` ? match[4] : null;

  return {
    protocol,
    source,
    selector,
    params,
  };
}

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
        // https:// github.com/yarnpkg/berry/blob/b128988379a1f257b2406ebf5058b67861403bd4/packages/yarnpkg-core/sources/structUtils.ts#L193-L214
        const [
          ,
          packageName,
          range,
        ] = /^((?:(?:@[^/]+?)\/)?(?:[^/]+?))@(.+)$/i.exec(entry);

        const { selector } = parseRange(range);

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
