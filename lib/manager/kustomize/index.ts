import { LANGUAGE_DOCKER } from '../../constants/languages';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

// export const language = LANGUAGE_DOCKER;

export const defaultConfig = {
  fileMatch: ['(^|/)kustomization.yaml'],
};
