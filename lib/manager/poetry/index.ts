import { LANGUAGE_PYTHON } from '../../constants/languages';
import * as poetryVersioning from '../../versioning/poetry';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';
export { updateArtifacts } from './artifacts';

export const language = LANGUAGE_PYTHON;
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  versioning: poetryVersioning.id,
  fileMatch: ['(^|/)pyproject\\.toml$'],
};
