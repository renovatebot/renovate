import { LANGUAGE_PYTHON } from '../../constants/languages';
import { VERSION_SCHEME_POETRY } from '../../constants/version-schemes';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';
export { updateArtifacts } from './artifacts';

export const language = LANGUAGE_PYTHON;
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  versionScheme: VERSION_SCHEME_POETRY,
  fileMatch: ['(^|/)pyproject\\.toml$'],
};
