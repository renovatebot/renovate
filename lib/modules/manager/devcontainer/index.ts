import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { GolangVersionDatasource } from '../../datasource/golang-version';
import { NodeVersionDatasource } from '../../datasource/node-version';
import { PythonVersionDatasource } from '../../datasource/python-version';
import { RubyVersionDatasource } from '../../datasource/ruby-version';
export { extractPackageFile } from './extract';

export const name = 'Dev Container';
export const url =
  'https://code.visualstudio.com/docs/devcontainers/containers';
export const categories: Category[] = ['docker'];

export const defaultConfig = {
  fileMatch: ['^.devcontainer/devcontainer.json$', '^.devcontainer.json$'],
};

export const supportedDatasources = [
  DockerDatasource.id,
  GolangVersionDatasource.id,
  NodeVersionDatasource.id,
  PythonVersionDatasource.id,
  RubyVersionDatasource.id,
];
