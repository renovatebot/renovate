import type { ProgrammingLanguage } from '../../../constants';
import { GoDatasource } from '../../datasource/go';
import { GolangVersionDatasource } from '../../datasource/golang-version';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export { extractPackageFile, updateDependency, updateArtifacts };

export const displayName = 'Go Modules';
export const url = 'https://go.dev/ref/mod';

export const language: ProgrammingLanguage = 'golang';

export const defaultConfig = {
  fileMatch: ['(^|/)go\\.mod$'],
  pinDigests: false,
};

export const supportedDatasources = [
  GoDatasource.id,
  GolangVersionDatasource.id,
];
