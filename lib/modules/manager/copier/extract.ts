import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type { CopierDepType } from './dep-types.ts';
import { CopierAnswersFile } from './schema.ts';

const gitPrefixRegex = regEx(/^git\+/);

/**
 * Copier supports `git+https://` and `git+ssh://` URL prefixes,
 * but git itself does not understand them.
 * Strip the `git+` prefix so the URL can be used with git directly.
 */
function stripGitPrefix(url: string): string {
  return url.replace(gitPrefixRegex, '');
}

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

  const deps: PackageDependency<Record<string, any>, CopierDepType>[] = [
    {
      datasource: GitTagsDatasource.id,
      depName: parsed._src_path,
      packageName: stripGitPrefix(parsed._src_path),
      depType: 'template',
      currentValue: parsed._commit,
    },
  ];

  return {
    deps,
  };
}
