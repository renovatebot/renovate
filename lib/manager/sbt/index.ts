import { VERSION_SCHEME_IVY } from '../../constants/version-schemes';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['\\.sbt$', 'project/[^/]*.scala$'],
  timeout: 300,
  versionScheme: VERSION_SCHEME_IVY,
};
