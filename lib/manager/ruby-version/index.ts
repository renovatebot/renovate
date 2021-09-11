import { ProgrammingLanguage } from '../../constants/programming-language';
import * as rubyVersioning from '../../versioning/ruby';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Ruby;

export const defaultConfig = {
  fileMatch: ['(^|/)\\.ruby-version$'],
  versioning: rubyVersioning.id,
};
