import { satisfies } from '@renovatebot/ruby-semver';
import bump from './bump';

function reduceOnePrecision(version: string): string {
  const versionParts = version.split('.');
  // istanbul ignore if
  if (versionParts.length === 1) {
    return version;
  }
  versionParts.pop();
  return versionParts.join('.');
}

export function matchPrecision(existing: string, next: string): string {
  let res = next;
  while (res.split('.').length > existing.split('.').length) {
    res = reduceOnePrecision(res);
  }
  return res;
}

export default ({ to, range }: { range: string; to: string }): string => {
  if (satisfies(to, range)) {
    return range;
  }
  return bump({ to, range, keepLowerBound: true });
};
