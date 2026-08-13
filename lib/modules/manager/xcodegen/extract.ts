import { logger } from '../../../logger/index.ts';
import { detectPlatform } from '../../../util/common.ts';
import { parseGitUrl } from '../../../util/git/url.ts';
import { coerceString } from '../../../util/string.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import type { PackageDependency, PackageFileContent } from '../types.ts';
import type { XcodeGenSwiftPackage } from './schema.ts';
import { XcodeGenProjectFile } from './schema.ts';

function resolvePackageUrl(pkg: XcodeGenSwiftPackage): string | null {
  if (pkg.url) {
    return pkg.url;
  }

  if (pkg.github) {
    return `https://github.com/${pkg.github}`;
  }

  return null;
}

function resolveGitDep(
  url: string,
): Pick<PackageDependency, 'datasource' | 'packageName' | 'registryUrls'> {
  const platform = detectPlatform(url);

  switch (platform) {
    case 'github': {
      const { full_name, host, protocol } = parseGitUrl(url);
      return {
        datasource: GithubTagsDatasource.id,
        packageName: full_name,
        ...(host !== 'github.com' && {
          registryUrls: [`${protocol}://${host}`],
        }),
      };
    }
    case 'gitlab': {
      const { full_name, host, protocol } = parseGitUrl(url);
      return {
        datasource: GitlabTagsDatasource.id,
        packageName: full_name,
        ...(host !== 'gitlab.com' && {
          registryUrls: [`${protocol}://${host}`],
        }),
      };
    }
    default:
      return { datasource: GitTagsDatasource.id, packageName: url };
  }
}

function resolveCurrentValue(
  pkg: XcodeGenSwiftPackage,
): { currentValue: string; depType: string } | null {
  if (pkg.from) {
    return { currentValue: pkg.from, depType: 'from' };
  }

  if (pkg.majorVersion) {
    return { currentValue: pkg.majorVersion, depType: 'majorVersion' };
  }

  if (pkg.minorVersion) {
    return { currentValue: pkg.minorVersion, depType: 'minorVersion' };
  }

  if (pkg.exactVersion) {
    return { currentValue: pkg.exactVersion, depType: 'exactVersion' };
  }

  if (pkg.version) {
    return { currentValue: pkg.version, depType: 'version' };
  }

  return null;
}

export function extractPackageFile(
  content: string,
  packageFile?: string,
): PackageFileContent | null {
  let parsed: XcodeGenProjectFile;
  try {
    parsed = XcodeGenProjectFile.parse(content);
  } catch (err) {
    logger.debug({ err, packageFile }, 'Parsing XcodeGen project YAML failed');
    return null;
  }

  if (!parsed.packages) {
    logger.trace({ packageFile }, 'XcodeGen project file has no packages');
    return null;
  }

  const deps: PackageDependency[] = [];

  for (const [depName, pkg] of Object.entries(parsed.packages)) {
    // Skip local packages
    if (pkg.path) {
      deps.push({
        depName,
        skipReason: 'path-dependency',
      });
      continue;
    }

    const resolvedUrl = resolvePackageUrl(pkg);
    if (!resolvedUrl) {
      deps.push({
        depName,
        skipReason: 'invalid-url',
      });
      continue;
    }

    // Skip branch/revision references
    if (pkg.branch) {
      deps.push({
        depName,
        skipReason: 'unversioned-reference',
        currentValue: pkg.branch,
      });
      continue;
    }

    if (pkg.revision) {
      deps.push({
        depName,
        skipReason: 'unversioned-reference',
        currentValue: pkg.revision,
      });
      continue;
    }

    // Skip minVersion/maxVersion range constraints
    if (pkg.minVersion !== undefined || pkg.maxVersion !== undefined) {
      deps.push({
        depName,
        skipReason: 'unsupported-version',
        currentValue:
          `${coerceString(pkg.minVersion)} - ${coerceString(pkg.maxVersion)}`.trim(),
      });
      continue;
    }

    const versionInfo = resolveCurrentValue(pkg);
    if (!versionInfo) {
      deps.push({
        depName,
        skipReason: 'unspecified-version',
      });
      continue;
    }

    const { datasource, packageName, registryUrls } =
      resolveGitDep(resolvedUrl);

    deps.push({
      depName,
      packageName,
      datasource,
      ...(registryUrls && { registryUrls }),
      currentValue: versionInfo.currentValue,
      depType: versionInfo.depType,
    });
  }

  if (deps.length === 0) {
    return null;
  }

  return { deps };
}
