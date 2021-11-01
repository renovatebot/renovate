import { ProgrammingLanguage } from '../../constants';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const language = ProgrammingLanguage.NET;

export const defaultConfig = {
  fileMatch: [
    '\\.(?:cs|fs|vb)proj$',
    '\\.(?:props|targets)$',
    '\\.config\\/dotnet-tools\\.json$',
    '(^|//)global\\.json$',
  ],
};
