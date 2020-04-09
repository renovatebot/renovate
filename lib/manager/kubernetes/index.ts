import { LANGUAGE_DOCKER } from '../../constants/languages';

export { extractPackageFile } from './extract';

export const language = LANGUAGE_DOCKER;

export const autoReplace = true;

export const defaultConfig = {
  fileMatch: [],
};
