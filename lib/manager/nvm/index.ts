import { ProgrammingLanguage } from '../../constants';
import * as nodeVersioning from '../../versioning/node';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.NodeJS;

export const defaultConfig = {
  fileMatch: ['(^|/)\\.nvmrc$'],
  versioning: nodeVersioning.id,
  pinDigests: false,
};
