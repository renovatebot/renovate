import { getDependency } from './get';
import { setNpmrc } from './npmrc';
import { PkgReleaseConfig, ReleaseResult } from '../common';

export async function getPkgReleases({
  lookupName,
  npmrc,
}: PkgReleaseConfig): Promise<ReleaseResult> {
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
