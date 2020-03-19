import { LANGUAGE_NODE } from '../../constants/languages';
import * as nodeVersioning from '../../versioning/node';

export { extractPackageFile } from './extract';
export { getPackageUpdates } from './package';
export { updateDependency } from './update';

export const language = LANGUAGE_NODE;

export const defaultConfig = {
  fileMatch: ['^.travis.yml$'],
  versioning: nodeVersioning.id,
};
