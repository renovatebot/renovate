import is from '@sindresorhus/is';
import { regEx } from '../../../../util/regex';
import { GoDatasource } from '../../../datasource/go';
import type { PackageDependency } from '../../types';
import type { Target } from '../types';

export function goDependency({
  rule: depType,
  name: depName,
  tag: currentValue,
  commit: currentDigest,
  importpath: packageName,
  remote,
}: Target): PackageDependency | null {
  let dep: PackageDependency | null = null;

  if (
    depType === 'go_repository' &&
    is.string(depName) &&
    (is.string(currentValue) || is.string(currentDigest)) &&
    is.string(packageName)
  ) {
    dep = {
      datasource: GoDatasource.id,
      depType,
      depName,
      packageName,
    };

    if (is.string(currentValue)) {
      dep.currentValue = currentValue;
    }

    if (is.string(currentDigest)) {
      dep.currentValue = 'v0.0.0';
      dep.currentDigest = currentDigest;
      dep.currentDigestShort = currentDigest.substring(0, 7);
      dep.digestOneAndOnly = true;
    }

    if (is.string(remote)) {
      const remoteMatch = regEx(
        /https:\/\/github\.com(?:.*\/)(([a-zA-Z]+)([-])?([a-zA-Z]+))/
      ).exec(remote);
      if (remoteMatch && remoteMatch[0].length === remote.length) {
        dep.packageName = remote.replace('https://', '');
      } else {
        dep.skipReason = 'unsupported-remote';
      }
    }
  }

  return dep;
}
