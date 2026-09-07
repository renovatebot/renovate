import { isTruthy } from '@sindresorhus/is';
import { logger } from '../../../logger/index.ts';
import { isSkipComment } from '../../../util/ignore.ts';
import {
  dependencyPattern,
  packagePattern,
  pypiDependency,
} from '../../../util/pep508.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import { extractPackageFileFlags } from './common.ts';
import type { PipRequirementsManagerData } from './types.ts';

const packageGitRegex = regEx(
  /(?<source>(?:git\+)(?<protocol>git|ssh|https):\/\/(?<gitUrl>(?:(?<user>[^@]+)@)?(?<hostname>[\w.-]+)(?<delimiter>\/)(?<scmPath>.*\/(?<depName>[\w/-]+))(?:\.git)?(?:@(?<version>.*))))/,
);

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
      return { ...dep, ...pypiDependency(depName, currVal?.trim()) };
    })
    .filter(isTruthy);

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
