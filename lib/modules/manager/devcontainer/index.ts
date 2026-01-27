import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GolangVersionDatasource } from '../../datasource/golang-version/index.ts';
import { NodeVersionDatasource } from '../../datasource/node-version/index.ts';
import { PythonVersionDatasource } from '../../datasource/python-version/index.ts';
import { RubyVersionDatasource } from '../../datasource/ruby-version/index.ts';
export { extractPackageFile } from './extract.ts';

export const name = 'Dev Container';
export const url =
  'https://code.visualstudio.com/docs/devcontainers/containers';
export const categories: Category[] = ['docker'];

export const defaultConfig = {
  managerFilePatterns: [
    '/^.devcontainer/devcontainer.json$/',
    '/^.devcontainer.json$/',
  ],
};

export const supportedDatasources = [
  DockerDatasource.id,
  GolangVersionDatasource.id,
  NodeVersionDatasource.id,
  PythonVersionDatasource.id,
  RubyVersionDatasource.id,
];
