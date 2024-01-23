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
import type { PackageDependency, PackageFileContent } from '../types';

export async function extractAllPackageFiles(
  config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile<NpmManagerData>[]> {
  const pipReqFiles: PackageFile<NpmManagerData>[] = [];
  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    // istanbul ignore else
    if (content) {
      const deps = await extractRequirementsFile(content, packageFile, config);
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

  await postExtract(pipReqFiles);
  return pipReqFiles;
}
