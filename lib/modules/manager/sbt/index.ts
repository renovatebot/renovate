import { MavenDatasource } from '../../datasource/maven';
import { SbtPackageDatasource } from '../../datasource/sbt-package';
import { SbtPluginDatasource } from '../../datasource/sbt-plugin';
import * as ivyVersioning from '../../versioning/ivy';

export { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';

export const supportedDatasources = [
  MavenDatasource.id,
  SbtPackageDatasource.id,
  SbtPluginDatasource.id,
];

export const defaultConfig = {
  fileMatch: ['\\.sbt$', 'project/[^/]*.scala$'],
  versioning: ivyVersioning.id,
};
