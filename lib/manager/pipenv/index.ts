import { ProgrammingLanguage } from '../../constants/programming-language';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const language = ProgrammingLanguage.Python;
export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)Pipfile$'],
};
