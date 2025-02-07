import type { Category } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HexDatasource } from '../../datasource/hex';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { getRangeStrategy } from './range';

export const url = 'https://hexdocs.pm/mix/Mix.html';
export const categories: Category[] = ['elixir'];

export const defaultConfig = {
  fileMatch: ['(^|/)mix\\.exs$'],
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitTagsDatasource.id,
  HexDatasource.id,
];
