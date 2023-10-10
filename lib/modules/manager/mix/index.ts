import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HexDatasource } from '../../datasource/hex';
import * as hexVersioning from '../../versioning/hex';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/)mix\\.exs$'],
  versioning: hexVersioning.id,
};

export const categories: Category[] = ['elixir'];

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitTagsDatasource.id,
  HexDatasource.id,
];
