import { ProgrammingLanguage } from '../../constants';
import { id as versioning } from '../../versioning/pep440';

export { extractPackageFile } from './extract';
export { getRangeStrategy } from './range';

export const language = ProgrammingLanguage.Python;

export const defaultConfig = {
  fileMatch: ['(^|/)setup\\.cfg$'],
  versioning,
};
