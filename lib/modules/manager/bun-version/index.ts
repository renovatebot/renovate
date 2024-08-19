import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { isValid } from '../../versioning/pep440';
import * as semverVersioning from '../../versioning/semver-coerced';
import type { PackageDependency, PackageFileContent } from '../types';

export const supportedDatasources = [GithubReleasesDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.bun-version$'],
  versioning: semverVersioning.id,
};

export const categories: Category[] = ['js'];

export function extractPackageFile(content: string): PackageFileContent | null {
  if (!content.endsWith('\n')) {
    return null;
  }

  if (!content) {
    return null;
  }

  if (content.split('\n').length > 2) {
    return null;
  }

  const dep: PackageDependency = {
    depName: 'Bun',
    packageName: 'oven-sh/bun',
    currentValue: content.trim(),
    datasource: GithubReleasesDatasource.id,
    versioning: semverVersioning.id,
    extractVersion: '^bun-v(?<version>\\S+)',
  };

  if (!semverVersioning.isVersion(content.trim())) {
    dep.skipReason = 'invalid-version';
  }
  return { deps: [dep] };
}
