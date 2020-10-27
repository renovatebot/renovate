import { LANGUAGE_DOT_NET } from '../../constants/languages';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const language = LANGUAGE_DOT_NET;

export const defaultConfig = {
  fileMatch: [
    '\\.(?:cs|fs|vb)proj$',
    '\\.(?:props|targets)$',
    '\\.config\\/dotnet-tools\\.json$',
  ],
};
