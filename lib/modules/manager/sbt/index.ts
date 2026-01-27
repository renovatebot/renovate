import type { Category } from '../../../constants/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import { SbtPackageDatasource } from '../../datasource/sbt-package/index.ts';
import { SbtPluginDatasource } from '../../datasource/sbt-plugin/index.ts';
import * as ivyVersioning from '../../versioning/ivy/index.ts';

export { extractAllPackageFiles, extractPackageFile } from './extract.ts';
export { bumpPackageVersion } from './update.ts';

export const displayName = 'sbt';
export const url = 'https://www.scala-sbt.org';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: [
    '/\\.sbt$/',
    '/project/[^/]*\\.scala$/',
    '/project/build\\.properties$/',
    '/(^|/)repositories$/',
  ],
  versioning: ivyVersioning.id,
};

export const supportedDatasources = [
  MavenDatasource.id,
  SbtPackageDatasource.id,
  SbtPluginDatasource.id,
  GithubReleasesDatasource.id, // For sbt itself
];
