import * as ivyVersioning from '../../versioning/ivy';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['\\.sbt$', 'project/[^/]*.scala$'],
  versioning: ivyVersioning.id,
};
