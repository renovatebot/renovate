import is from '@sindresorhus/is';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { getDependency } from './get';
import { setNpmrc } from './npmrc';

export async function getReleases({
  lookupName,
  npmrc,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  if (is.string(npmrc)) {
    setNpmrc(npmrc);
  }
  const res = await getDependency(lookupName);
  if (res) {
    res.tags = res['dist-tags'];
    delete res['dist-tags'];
  }
  return res;
}
