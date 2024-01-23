import { RANGE_PATTERN } from '@renovatebot/pep440';
import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { isSkipComment } from '../../../util/ignore';
import { newlineRegex, regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PypiDatasource } from '../../datasource/pypi';
import { extractPackageFile as extractRequirementsFile } from '../pip_requirements/extract';
import type { ExtractConfig, PackageFile } from '../types';
import { extractHeaderCommand } from './common';

export async function extractAllPackageFiles(
  config: ExtractConfig, // NOTE(not7cd): ignore, useless in this use-case
  packageFiles: string[],
): Promise<PackageFile[]> {
  const pipReqFiles: PackageFile[] = [];
  for (const packageFile of packageFiles) {
    logger.debug({ packageFile }, 'READING FILE');
    const content = await readLocalFile(packageFile, 'utf8');
    // istanbul ignore else
    if (content) {
      // TODO(not7cd): extract based on manager: setup.py, pep621, pip_requirements
      const pipCompileArgs = extractHeaderCommand(content, packageFile);
      const deps = extractRequirementsFile(content);
      if (deps) {
        pipReqFiles.push({
          ...deps,
          packageFile,
        });
      }
    } else {
      logger.debug({ packageFile }, `No content found`);
    }
  }

  // TODO(not7cd): in post extract there is mono repo detection and "get locked versions"
  // await postExtract(pipReqFiles);
  return pipReqFiles;
}
