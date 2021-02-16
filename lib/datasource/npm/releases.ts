import { GetReleasesConfig, ReleaseResult } from '../common';
import { getDependency } from './get';
import { setNpmrc } from './npmrc';

export async function getReleases({
  lookupName,
  npmrc,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  if (npmrc) {
    setNpmrc(npmrc);
  }
  const res = await getDependency(lookupName);
  if (res) {
    res.releaseTags = res['dist-tags'];
    delete res['dist-tags'];
    delete res['renovate-config'];
  }
  return res;
}
