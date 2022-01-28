import { ProgrammingLanguage } from '../../constants';
import { HexDatasource } from '../../datasource/hex';
import * as hexVersioning from '../../versioning/hex';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const language = ProgrammingLanguage.Elixir;

export const defaultConfig = {
  fileMatch: ['(^|/)mix\\.exs$'],
  versioning: hexVersioning.id,
};

export const supportedDatasources = [HexDatasource.id];
