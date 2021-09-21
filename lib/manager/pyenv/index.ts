import { LANGUAGE_PYTHON } from '../../constants/languages';
import * as dockerVersioning from '../../versioning/docker';

export { extractPackageFile } from './extract';

export const language = LANGUAGE_PYTHON;

export const defaultConfig = {
  fileMatch: ['(^|/).python-version$'],
  versioning: dockerVersioning.id,
};
