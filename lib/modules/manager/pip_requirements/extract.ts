// based on https://www.python.org/dev/peps/pep-0508/#names
import { RANGE_PATTERN } from '@renovatebot/pep440';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { isSkipComment } from '../../../util/ignore';
import { newlineRegex, regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PypiDatasource } from '../../datasource/pypi';
import { normalizePythonDepName } from '../../datasource/pypi/common';
import type { PackageDependency, PackageFileContent } from '../types';
import { extractPackageFileFlags } from './common';
import type { PipRequirementsManagerData } from './types';

export const packagePattern =
  '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
export const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';
const packageGitRegex = regEx(
  /(?<source>(?:git\+)(?<protocol>git|ssh|https):\/\/(?<gitUrl>(?:(?<user>[^@]+)@)?(?<hostname>[\w.-]+)(?<delimiter>\/)(?<scmPath>.*\/(?<depName>[\w/-]+))(\.git)?(?:@(?<version>.*))))/,
);

const rangePattern: string = RANGE_PATTERN;
const specifierPartPattern = `\\s*${rangePattern.replace(
  regEx(/\?<\w+>/g),
  '?:',
)}`;
const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;
export const dependencyPattern = `(${packagePattern})(${extrasPattern})(${specifierPattern})`;

export function extractPackageFile(
  content: string,
): PackageFileContent<PipRequirementsManagerData> | null {
  logger.trace('pip_requirements.extractPackageFile()');

  const pkgRegex = regEx(`^(${packagePattern})$`);
  const pkgValRegex = regEx(`^${dependencyPattern}$`);
  const deps = content
    .split(newlineRegex)
    .map((rawline) => {
      let dep: PackageDependency = {};
      const [line, comment] = rawline.split('#').map((part) => part.trim());
      if (isSkipComment(comment)) {
        dep.skipReason = 'ignored';
      }
      const [lineNoEnvMarkers] = line.split(';').map((part) => part.trim());
      const lineNoHashes = lineNoEnvMarkers.split(' \\')[0];
      const packageMatches =
        pkgValRegex.exec(lineNoHashes) ?? pkgRegex.exec(lineNoHashes);
      const gitPackageMatches = packageGitRegex.exec(lineNoHashes);
      if (!packageMatches && !gitPackageMatches) {
        return null;
      }
      if (gitPackageMatches?.groups) {
        const currentVersion = gitPackageMatches.groups.version;
        const depName = gitPackageMatches.groups.depName;
        let packageName: string;
        if (gitPackageMatches.groups.protocol === 'https') {
          packageName = 'https://'
            .concat(gitPackageMatches.groups.gitUrl)
            .replace(`@${currentVersion}`, '');
        } else {
          // we need to replace the / with a :
          const scmPath = gitPackageMatches.groups.scmPath;
          const delimiter = gitPackageMatches.groups.delimiter;
          packageName = gitPackageMatches.groups.gitUrl
            .replace(`${delimiter}${scmPath}`, `:${scmPath}`)
            .replace(`@${currentVersion}`, '');
        }
        dep = {
          ...dep,
          depName,
          currentValue: currentVersion,
          currentVersion,
          packageName,
          datasource: GitTagsDatasource.id,
        };
        return dep;
      }

      // validated above
      const [, depName, , currVal] = packageMatches!;
      const currentValue = currVal?.trim();
      dep = {
        ...dep,
        depName,
        packageName: normalizePythonDepName(depName),
        currentValue,
        datasource: PypiDatasource.id,
      };
      if (currentValue?.startsWith('==')) {
        dep.currentVersion = currentValue.replace(/^==\s*/, '');
      }
      return dep;
    })
    .filter(is.truthy);

  const res = extractPackageFileFlags(content);
  res.deps = deps;

  if (
    !res.deps.length &&
    !res.registryUrls?.length &&
    !res.additionalRegistryUrls?.length &&
    !res.managerData?.requirementsFiles?.length &&
    !res.managerData?.constraintsFiles?.length
  ) {
    return null;
  }
  return res;
}
