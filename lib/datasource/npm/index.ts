import is from '@sindresorhus/is';
import * as npmVersioning from '../../versioning/npm';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { id } from './common';
import { getDependency } from './get';
import { setNpmrc } from './npmrc';

export { resetMemCache, resetCache } from './get';
export { setNpmrc } from './npmrc';

export const customRegistrySupport = false;

export class NpmDatasource extends Datasource {
  static readonly id = id;

  override readonly customRegistrySupport = false;

  override readonly defaultVersioning = npmVersioning.id;

  constructor() {
    super(NpmDatasource.id);
  }

  async getReleases({
    lookupName,
    npmrc,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    if (is.string(npmrc)) {
      setNpmrc(npmrc);
    }
    const res = await getDependency(this.http, lookupName);
    if (res) {
      res.tags = res['dist-tags'];
      delete res['dist-tags'];
    }
    return res;
  }
}
