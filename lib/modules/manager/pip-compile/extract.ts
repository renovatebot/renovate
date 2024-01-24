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
  const result: PackageFile[] = [];
  for (const lockFile of packageFiles) {
    logger.debug({ packageFile: lockFile }, 'READING FILE');
    const content = await readLocalFile(lockFile, 'utf8');
    // istanbul ignore else
    if (content) {
      // TODO(not7cd): extract based on manager: setup.py, pep621, pip_requirements
      const pipCompileArgs = extractHeaderCommand(content, lockFile);
      const lockedDeps = extractRequirementsFile(content);
      for (const sourceFile of pipCompileArgs.sourceFiles) {
        // TODO(not7cd): if sourceFile ends with .txt
        const content = await readLocalFile(sourceFile, 'utf8');
        if (content) {
          const deps = extractRequirementsFile(content);
          if (deps) {
            result.push({
              ...deps,
              lockFiles: [lockFile],
              packageFile: sourceFile,
            });
          }
        }
      }
    } else {
      logger.debug({ packageFile: lockFile }, `No content found`);
    }
  }

  // TODO(not7cd): in post extract there is mono repo detection and "get locked versions"
  // await postExtract(pipReqFiles);
  return result;
}
