import * as datasourceMaven from '../../datasource/maven';
import * as datasourceSbtPackage from '../../datasource/sbt-package';
import * as datasourceSbtPlugin from '../../datasource/sbt-plugin';
import * as ivyVersioning from '../../versioning/ivy';

export { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';

export const supportedDatasources = [
  datasourceMaven.id,
  datasourceSbtPackage.id,
  datasourceSbtPlugin.id,
];

export const defaultConfig = {
  fileMatch: ['\\.sbt$', 'project/[^/]*.scala$'],
  versioning: ivyVersioning.id,
};
