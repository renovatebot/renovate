import { logger } from '../../../logger/index.ts';
import { getHttpUrl } from '../../../util/git/url.ts';
import { regEx } from '../../../util/regex.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { CopierAnswersFile } from './schema.ts';

const gitPrefixRegex = regEx(/^git\+/);
const httpProtocolRegex = regEx(/^https?:\/\//);

/**
 * Copier supports `git+https://` and `git+ssh://` URL prefixes,
 * but git itself does not understand them.
 * Strip the `git+` prefix so the URL can be used with git directly.
 */
function stripGitPrefix(url: string): string {
  return url.replace(gitPrefixRegex, '');
}

/**
 * Convert SSH-style template URLs to their HTTPS equivalent for the
 * datasource lookup, like the git-submodules manager does.
 * This way the lookup can be authenticated via `hostRules` on bots
 * which access the Git host over HTTPS only.
 * The answers file itself keeps the original URL.
 */
function getPackageName(srcPath: string): string {
  const url = stripGitPrefix(srcPath);
  if (httpProtocolRegex.test(url)) {
    return url;
  }
  try {
    return getHttpUrl(url);
  } catch (err) {
    logger.debug(
      { err, url },
      'Failed to convert copier _src_path to an HTTP(S) URL',
    );
    return url;
  }
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

  const deps: PackageDependency[] = [
    {
      datasource: GitTagsDatasource.id,
      depName: parsed._src_path,
      packageName: getPackageName(parsed._src_path),
      depType: 'template',
      currentValue: parsed._commit,
    },
  ];

  return {
    deps,
  };
}
