import { getDependency } from './get';
import { setNpmrc } from './npmrc';
import { GetReleasesConfig, ReleaseResult } from '../common';

export async function getPkgReleases({
  lookupName,
  npmrc,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  if (npmrc) {
    setNpmrc(npmrc);
  }
  const res: ReleaseResult = await getDependency(lookupName);
  if (res) {
    res.tags = res['dist-tags'];
    delete res['dist-tags'];
    delete res['renovate-config'];
  }
  return res;
}
