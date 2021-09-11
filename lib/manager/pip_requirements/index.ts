import { ProgrammingLanguage } from '../../constants/programming-language';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';
export { getRangeStrategy } from './range';

export const language = ProgrammingLanguage.Python;

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)requirements\\.(txt|pip)$'],
};
