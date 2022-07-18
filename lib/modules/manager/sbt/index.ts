import { MavenDatasource } from '../../datasource/maven';
import { SbtPackageDatasource } from '../../datasource/sbt-package';
import { SbtPluginDatasource } from '../../datasource/sbt-plugin';
import * as ivyVersioning from '../../versioning/ivy';

// extractPackageFile is used only for test and within extractAllPackageFiles FN
// extractAllPackageFiles has more higher priority
// lib/workers/repository/extract/manager-files.ts:32:0
export { extractPackageFile, extractAllPackageFiles } from './extract';
export { bumpPackageVersion, updateDependency } from './update';

export const supportedDatasources = [
  MavenDatasource.id,
  SbtPackageDatasource.id,
  SbtPluginDatasource.id,
];

export const defaultConfig = {
  fileMatch: ['project/.*\\.scala$', '\\.sbt$', 'project/[^/]*.scala$'],
  versioning: ivyVersioning.id,
};
