import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const url =
  'https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html';
export const categories: Category[] = ['docker'];

export const defaultConfig = {
  managerFilePatterns: ['/.+\\.container$/', '/.+\\.image$/', '/.+\\.volume$/'],
};

export const supportedDatasources = [DockerDatasource.id];
