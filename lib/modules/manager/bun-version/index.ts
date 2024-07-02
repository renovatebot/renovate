import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as semverVersioning from '../../versioning/semver';
import type { PackageDependency, PackageFileContent } from '../types';

export const supportedDatasources = [GithubReleasesDatasource.id];

export const defaultConfig = {
  fileMatch: ['^.bun-version$'],
  versioning: semverVersioning.id,
};

export const categories: Category[] = ['js'];

export function extractPackageFile(content: string): PackageFileContent {
  const dep: PackageDependency = {
    depName: 'bun',
    packageName: 'oven-sh/bun',
    commitMessageTopic: 'Bun',
    currentValue: content.trim(),
    datasource: GithubReleasesDatasource.id,
    versioning: semverVersioning.id,
    extractVersion: '^bun-v(?<version>\\S+)',
  };
  return { deps: [dep] };
}
