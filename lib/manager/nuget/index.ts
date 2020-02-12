import { LANGUAGE_DOT_NET } from '../../constants/languages';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const language = LANGUAGE_DOT_NET;

export const defaultConfig = {
  fileMatch: ['\\.(?:cs|fs|vb)proj$'],
};
