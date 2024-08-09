import { logger } from '../../../logger';
import { GitTagsDatasource } from '../../datasource/git-tags';
import type { PackageDependency, PackageFileContent } from '../types';
import { CopierAnswersFile } from './schema';

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  let parsed: CopierAnswersFile;
  try {
    parsed = CopierAnswersFile.parse(content);
  } catch (err) {
    logger.debug({ err, packageFile }, `Parsing Copier answers YAML failed`);
    return null;
  }

  const deps: PackageDependency[] = [
    {
      datasource: GitTagsDatasource.id,
      depName: parsed._src_path,
      packageName: parsed._src_path,
      depType: 'template',
      currentValue: parsed._commit,
    },
  ];

  return {
    deps,
  };
}
