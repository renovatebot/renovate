import type { Category } from '../../../constants/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { HexDatasource } from '../../datasource/hex/index.ts';
import * as hexVersioning from '../../versioning/hex/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const url = 'https://rebar3.org';
export const categories: Category[] = ['erlang'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)rebar\\.config$/'],
  versioning: hexVersioning.id,
};

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['rebar.lock'];
export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitTagsDatasource.id,
  HexDatasource.id,
];
