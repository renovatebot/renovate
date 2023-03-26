import { CpanDatasource } from '../../datasource/cpan';
import * as perlVersioning from '../../versioning/perl';

export { extractPackageFile } from './extract';

export const displayName = 'cpanfile';
export const url =
  'https://metacpan.org/dist/Module-CPANfile/view/lib/cpanfile.pod';

export const defaultConfig = {
  fileMatch: ['(^|/)cpanfile$'],
  versioning: perlVersioning.id,
};

export const supportedDatasources = [CpanDatasource.id];
