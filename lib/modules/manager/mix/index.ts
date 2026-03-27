import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { HexDatasource } from '../../datasource/hex/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { getRangeStrategy } from './range.ts';

export const url = 'https://hexdocs.pm/mix/Mix.html';
export const categories: Category[] = ['elixir'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)mix\\.exs$/'],
};

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['mix.lock'];
export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitTagsDatasource.id,
  HexDatasource.id,
];
