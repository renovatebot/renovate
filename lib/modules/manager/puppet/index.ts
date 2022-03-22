import { ProgrammingLanguage } from '../../../constants';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { PuppetDatasource } from '../../datasource/puppet';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Ruby;

export const defaultConfig = {
  fileMatch: ['^Puppetfile$'],
};

export const supportedDatasources = [PuppetDatasource.id, GitRefsDatasource.id];
