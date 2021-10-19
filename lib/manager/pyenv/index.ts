import { ProgrammingLanguage } from '../../constants';
import * as dockerVersioning from '../../versioning/docker';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Python;

export const defaultConfig = {
  fileMatch: ['(^|/).python-version$'],
  versioning: dockerVersioning.id,
};
