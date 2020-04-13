import { LANGUAGE_DOT_NET } from '../../constants/languages';

export { extractPackageFile } from './extract';

export const autoReplace = true;

export const language = LANGUAGE_DOT_NET;

export const defaultConfig = {
  fileMatch: ['\\.(?:cs|fs|vb)proj$'],
};
