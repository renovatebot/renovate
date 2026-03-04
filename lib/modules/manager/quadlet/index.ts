import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';

export { extractPackageFile } from './extract.ts';

export const url =
  'https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html';
export const categories: Category[] = ['docker'];

export const defaultConfig = {
  managerFilePatterns: ['/.+\\.container$/', '/.+\\.image$/', '/.+\\.volume$/'],
};

export const supportedDatasources = [DockerDatasource.id];
