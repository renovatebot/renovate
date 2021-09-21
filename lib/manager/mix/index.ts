import { LANGUAGE_ELIXIR } from '../../constants/languages';
import * as hexVersioning from '../../versioning/hex';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const language = LANGUAGE_ELIXIR;

export const defaultConfig = {
  fileMatch: ['(^|/)mix\\.exs$'],
  versioning: hexVersioning.id,
};
