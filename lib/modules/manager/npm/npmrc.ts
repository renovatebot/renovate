import { isString } from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import {
  findLocalSiblingOrParent,
  readLocalFile,
} from '../../../util/fs/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';

export interface NpmrcResult {
  npmrc: string | undefined;
  npmrcFileName: string | null;
}

export async function resolveNpmrc(
  packageFile: string,
  config: { npmrc?: string; npmrcMerge?: boolean },
): Promise<NpmrcResult> {
  let npmrc: string | undefined;
  const npmrcFileName = await findLocalSiblingOrParent(packageFile, '.npmrc');
  if (npmrcFileName) {
    let repoNpmrc = await readLocalFile(npmrcFileName, 'utf8');
    if (isString(repoNpmrc)) {
      if (isString(config.npmrc) && !config.npmrcMerge) {
        logger.debug(
          { npmrcFileName },
          'Repo .npmrc file is ignored due to config.npmrc with config.npmrcMerge=false',
        );
        npmrc = config.npmrc;
      } else {
        npmrc = config.npmrc ?? '';
        if (npmrc.length) {
          if (!npmrc.endsWith('\n')) {
            npmrc += '\n';
          }
        }
        if (repoNpmrc?.includes('package-lock')) {
          logger.debug('Stripping package-lock setting from .npmrc');
          repoNpmrc = repoNpmrc.replace(
            regEx(/(^|\n)package-lock.*?(\n|$)/g),
            '\n',
          );
        }
        if (repoNpmrc.includes('=${') && !GlobalConfig.get('exposeAllEnv')) {
          logger.debug(
            { npmrcFileName },
            'Stripping .npmrc file of lines with variables',
          );
          repoNpmrc = repoNpmrc
            .split(newlineRegex)
            .filter((line) => !line.includes('=${'))
            .join('\n');
        }
        npmrc += repoNpmrc;
      }
    }
  } else if (isString(config.npmrc)) {
    npmrc = config.npmrc;
  }
  return { npmrc, npmrcFileName };
}
