import type { ProgrammingLanguage } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const language: ProgrammingLanguage = 'python';
export const supportsLockFileMaintenance = true;

export const supportedDatasources = [PypiDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)Pipfile$'],
};
