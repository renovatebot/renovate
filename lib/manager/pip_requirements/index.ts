import { ProgrammingLanguage } from '../../constants';
import { PypiDatasource } from '../../datasource/pypi';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';
export { getRangeStrategy } from './range';

export const language = ProgrammingLanguage.Python;

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)requirements\\.(txt|pip)$'],
};

export const supportedDatasources = [PypiDatasource.id];
