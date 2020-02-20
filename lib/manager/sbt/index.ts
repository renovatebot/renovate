import * as ivyVersioning from '../../versioning/ivy';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['\\.sbt$', 'project/[^/]*.scala$'],
  timeout: 300,
  versioning: ivyVersioning.id,
};
