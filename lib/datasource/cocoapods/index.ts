import crypto from 'crypto';
import { api } from '../../platform/github/gh-got-wrapper';
import { ReleaseResult, PkgReleaseConfig } from '../common';

function shardPart(lookupName) {
  return crypto
    .createHash('md5')
    .update(lookupName)
    .digest('hex')
    .slice(0, 3)
    .split('')
    .join('/');
}

function releasesUrl(lookupName, opts = {}) {
  const defaults = {
    useShard: true,
    account: 'CocoaPods',
    repo: 'Specs',
  };

  const { useShard, account, repo } = Object.assign(defaults, opts);
  const prefix = 'https://api.github.com/repos';
  const suffix = useShard
    ? `${shardPart(lookupName)}/${lookupName}`
    : lookupName;
  return `${prefix}/${account}/${repo}/contents/Specs/${suffix}`;
}

export async function getPkgReleases({
  lookupName,
}: Partial<PkgReleaseConfig>): Promise<ReleaseResult | null> {
  const url = releasesUrl(lookupName);
  const resp = await api.get(url);
  if (resp && resp.body) {
    const releases = resp.body.map(({ name }) => ({ version: name }));
    return { releases };
  }
  return null;
}
