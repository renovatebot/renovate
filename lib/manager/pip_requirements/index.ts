import { ProgrammingLanguage } from '../../constants';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';
export { getRangeStrategy } from './range';

export const language = ProgrammingLanguage.Python;

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)requirements\\.(txt|pip)$'],
};
