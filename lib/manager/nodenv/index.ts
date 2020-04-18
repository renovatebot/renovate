import { LANGUAGE_NODE } from '../../constants/languages';
import * as nodeVersioning from '../../versioning/node';

export { extractPackageFile } from './extract';

export const language = LANGUAGE_NODE;

export const defaultConfig = {
  fileMatch: ['^.node-version$'],
  versioning: nodeVersioning.id,
};
