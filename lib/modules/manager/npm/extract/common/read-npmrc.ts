import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../../../config/global';
import { logger } from '../../../../../logger';
import { getSiblingFileName, readLocalFile } from '../../../../../util/fs';
import { newlineRegex } from '../../../../../util/regex';
import type { ExtractConfig } from '../../../types';

export async function readNpmrc(
  packageFile: string,
  config: ExtractConfig,
): Promise<string | undefined> {
  const npmrcFileName = getSiblingFileName(packageFile, '.npmrc');
  const repoNpmrc = await readLocalFile(npmrcFileName, 'utf8');
  const haveRepoNpmrc = is.string(repoNpmrc);
  const haveConfigNpmrc = is.string(config.npmrc);
  const exposeAllEnv = GlobalConfig.get('exposeAllEnv');

  const formatNpmrc = (
    ...npmrcs: (string | undefined | null)[]
  ): string | undefined => {
    const lines = npmrcs
      .filter((npmrc) => is.string(npmrc))
      .flatMap((npmrc) => npmrc.split(newlineRegex))
      .filter((line) => {
        if (line.includes('package-lock')) {
          logger.debug('Stripping package-lock setting from .npmrc');
          return false;
        }
        if (!exposeAllEnv && line.includes('=${')) {
          logger.debug(
            { npmrcFileName },
            'Stripping .npmrc file of lines with variables',
          );
          return false;
        }
        return Boolean(line.trim());
      });

    if (!lines.length) {
      return undefined;
    }

    let txt = lines.join('\n');
    if (!txt.endsWith('\n')) {
      txt += '\n';
    }
    return txt;
  };

  if (haveConfigNpmrc && haveRepoNpmrc) {
    if (config.npmrcMerge) {
      return formatNpmrc(config.npmrc, repoNpmrc);
    }
    logger.debug(
      { npmrcFileName },
      'Repo .npmrc file is ignored due to config.npmrc with config.npmrcMerge=false',
    );
    return config.npmrc;
  }
  if (haveConfigNpmrc) {
    return config.npmrc;
  }
  if (haveRepoNpmrc) {
    return formatNpmrc(repoNpmrc);
  }
  return undefined;
}
