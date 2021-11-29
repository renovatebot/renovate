import * as ivyVersioning from '../../versioning/ivy';

export { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';

export const defaultConfig = {
  fileMatch: ['\\.sbt$', 'project/[^/]*.scala$'],
  versioning: ivyVersioning.id,
};
