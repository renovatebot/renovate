import { LANGUAGE_PYTHON } from '../../constants/languages';

export { extractPackageFile } from '../pip_requirements/extract';
export { updateArtifacts } from './artifacts';

export const language = LANGUAGE_PYTHON;

export const defaultConfig = {
  fileMatch: [],
};
