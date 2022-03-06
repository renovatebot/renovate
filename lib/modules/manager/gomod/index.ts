import { ProgrammingLanguage } from '../../../constants';
import { GoDatasource } from '../../datasource/go';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export const language = ProgrammingLanguage.Golang;
export { extractPackageFile, updateDependency, updateArtifacts };

export const defaultConfig = {
  fileMatch: ['(^|/)go.mod$'],
};

export const supportedDatasources = [GoDatasource.id];
