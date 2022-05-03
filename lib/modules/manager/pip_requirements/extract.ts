// based on https://www.python.org/dev/peps/pep-0508/#names
import { RANGE_PATTERN } from '@renovatebot/pep440';
import is from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import { isSkipComment } from '../../../util/ignore';
import { newlineRegex, regEx } from '../../../util/regex';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PypiDatasource } from '../../datasource/pypi';
import * as looseVersioning from '../../versioning/loose';
import * as pep440Versioning from '../../versioning/pep440';
import type { ExtractConfig, PackageDependency, PackageFile } from '../types';

export const packagePattern =
  '[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]';
const extrasPattern = '(?:\\s*\\[[^\\]]+\\])?';
const packageGitRegex = regEx(
  /(?<source>(?:git\+)(?<protocol>git|ssh|https):\/\/(?<gitUrl>(?:(?<user>[^@]+)@)?(?<hostname>[\w.-]+)(?<delimiter>\/)(?<scmPath>.*\/(?<depName>[\w/-]+))(\.git)?(?:@(?<version>.*))))/
);

const rangePattern: string = RANGE_PATTERN;
const specifierPartPattern = `\\s*${rangePattern.replace(
  regEx(/\?<\w+>/g),
  '?:'
)}`;
const specifierPattern = `${specifierPartPattern}(?:\\s*,${specifierPartPattern})*`;
export const dependencyPattern = `(${packagePattern})(${extrasPattern})(${specifierPattern})`;

export function extractPackageFile(
  content: string,
  _: string,
  config: ExtractConfig
): PackageFile | null {
  logger.trace('pip_requirements.extractPackageFile()');

  let indexUrl: string | undefined;
  const extraUrls: string[] = [];
  content.split(newlineRegex).forEach((line) => {
    if (line.startsWith('--index-url ')) {
      indexUrl = line.substring('--index-url '.length).split(' ')[0];
    }
    if (line.startsWith('--extra-index-url ')) {
      const extraUrl = line
        .substring('--extra-index-url '.length)
        .split(' ')[0];
      extraUrls.push(extraUrl);
    }
  });
  let registryUrls: string[] = [];
  if (indexUrl) {
    // index url in file takes precedence
    registryUrls.push(indexUrl);
  } else if (config.registryUrls?.length) {
    // configured registryURls takes next precedence
    registryUrls = registryUrls.concat(config.registryUrls);
  } else if (extraUrls.length) {
    // Use default registry first if extra URLs are present and index URL is not
    registryUrls.push(process.env.PIP_INDEX_URL || 'https://pypi.org/pypi/');
  }
  registryUrls = registryUrls.concat(extraUrls);

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
        pkgValRegex.exec(lineNoHashes) || pkgRegex.exec(lineNoHashes);
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
          versioning: looseVersioning.id,
        };
        return dep;
      }

      // validated above
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      const [, depName, , currVal] = packageMatches!;
      const currentValue = currVal?.trim();
      dep = {
        ...dep,
        depName,
        currentValue,
        datasource: PypiDatasource.id,
        versioning: pep440Versioning.id,
      };
      if (currentValue?.startsWith('==')) {
        dep.currentVersion = currentValue.replace(/^==\s*/, '');
      }
      return dep;
    })
    .filter(is.truthy);
  if (!deps.length) {
    return null;
  }
  const res: PackageFile = { deps };
  if (registryUrls.length > 0) {
    res.registryUrls = registryUrls.map((url) => {
      // handle the optional quotes in eg. `--extra-index-url "https://foo.bar"`
      const cleaned = url.replace(regEx(/^"/), '').replace(regEx(/"$/), '');
      if (!GlobalConfig.get('exposeAllEnv')) {
        return cleaned;
      }
      // interpolate any environment variables
      return cleaned.replace(
        regEx(/(\$[A-Za-z\d_]+)|(\${[A-Za-z\d_]+})/g),
        (match) => {
          const envvar = match
            .substring(1)
            .replace(regEx(/^{/), '')
            .replace(regEx(/}$/), '');
          const sub = process.env[envvar];
          return sub || match;
        }
      );
    });
  }
  return res;
}
