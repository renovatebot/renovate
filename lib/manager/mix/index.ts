import { ProgrammingLanguage } from '../../constants/programming-language';
import * as hexVersioning from '../../versioning/hex';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const language = ProgrammingLanguage.Elixir;

export const defaultConfig = {
  fileMatch: ['(^|/)mix\\.exs$'],
  versioning: hexVersioning.id,
};
