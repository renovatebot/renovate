import { ProgrammingLanguage } from '../../constants';
import * as datasourceNuget from '../../datasource/nuget';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const language = ProgrammingLanguage.NET;

export const defaultConfig = {
  fileMatch: [
    '\\.(?:cs|fs|vb)proj$',
    '\\.(?:props|targets)$',
    '(^|\\/)dotnet-tools\\.json$',
    '(^|\\/)global\\.json$',
  ],
};

export const supportedDatasources = [datasourceNuget.id];
