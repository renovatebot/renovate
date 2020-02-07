import { LANGUAGE_ELIXIR } from '../../constants/languages';
import { VERSION_SCHEME_HEX } from '../../constants/version-schemes';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';
export { updateArtifacts } from './artifacts';

export const language = LANGUAGE_ELIXIR;

export const defaultConfig = {
  fileMatch: ['(^|/)mix\\.exs$'],
  versionScheme: VERSION_SCHEME_HEX,
};
