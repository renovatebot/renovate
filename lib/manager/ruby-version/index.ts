import { LANGUAGE_RUBY } from '../../constants/languages';
import * as rubyVersioning from '../../versioning/ruby';

export { extractPackageFile } from './extract';

export const language = LANGUAGE_RUBY;

export const defaultConfig = {
  fileMatch: ['(^|/)\\.ruby-version$'],
  versioning: rubyVersioning.id,
};
