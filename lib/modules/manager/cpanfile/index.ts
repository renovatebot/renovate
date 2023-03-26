import { CpanDatasource } from '../../datasource/cpan';

export { extractPackageFile } from './extract';

export const displayName = 'cpanfile';
export const url =
  'https://metacpan.org/dist/Module-CPANfile/view/lib/cpanfile.pod';

export const defaultConfig = {
  fileMatch: ['(^|/)cpanfile$'],
};

export const supportedDatasources = [CpanDatasource.id];
