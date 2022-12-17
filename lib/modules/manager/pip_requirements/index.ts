import type { ProgrammingLanguage } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { PypiDatasource } from '../../datasource/pypi';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'python';

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)requirements\\.(txt|pip)$'],
};

export const supportedDatasources = [PypiDatasource.id, GitTagsDatasource.id];
