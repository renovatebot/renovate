import { ProgrammingLanguage } from '../../constants/programming-language';
import * as nodeVersioning from '../../versioning/node';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.NodeJS;

export const defaultConfig = {
  fileMatch: ['^.travis.yml$'],
  major: {
    enabled: false,
  },
  versioning: nodeVersioning.id,
};
