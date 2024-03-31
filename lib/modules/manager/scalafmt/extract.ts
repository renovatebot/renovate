import { logger } from '../../../logger';
import { readLocalFile } from '../../../util/fs';
import { regEx } from '../../../util/regex';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as semverVersioning from '../../versioning/semver';
import type {
  ExtractConfig,
  PackageDependency,
  PackageFile,
  PackageFileContent,
} from '../types';

const scalafmtVersionRegex = regEx(
  'version *= *(?<version>\\d+\\.\\d+\\.\\d+)',
);

export function extractPackageFile(
  content: string,
  packageFile: string,
): PackageFileContent | null {
  const regexResult = scalafmtVersionRegex.exec(content);
  const scalafmtVersion = regexResult?.groups?.version;
  const matchString = regexResult?.[0];
  if (scalafmtVersion) {
    const scalafmtDependency: PackageDependency = {
      datasource: GithubReleasesDatasource.id,
      depName: 'scalameta/scalafmt',
      packageName: 'scalameta/scalafmt',
      versioning: semverVersioning.id,
      currentValue: scalafmtVersion,
      replaceString: matchString,
      extractVersion: '^v(?<version>\\S+)',
      registryUrls: [],
    };

    return {
      deps: [scalafmtDependency],
    };
  } else {
    return null;
  }
}

export async function extractAllPackageFiles(
  _config: ExtractConfig,
  packageFiles: string[],
): Promise<PackageFile[]> {
  const packages: PackageFile[] = [];

  for (const packageFile of packageFiles) {
    const content = await readLocalFile(packageFile, 'utf8');
    if (!content) {
      logger.debug({ packageFile }, 'packageFile has no content');
      continue;
    }

    const pkg = extractPackageFile(content, packageFile);
    if (pkg) {
      packages.push({ deps: pkg.deps, packageFile });
    }
  }

  return packages;
}
