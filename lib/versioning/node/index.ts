import { NewValueConfig, VersioningApi } from '../common';
import npm, { isValid, isVersion } from '../npm';

export const id = 'node';
export const displayName = 'Node.js';
export const urls = [];
export const supportsRanges = false;

function getNewValue({
  currentValue,
  rangeStrategy,
  fromVersion,
  toVersion,
}: NewValueConfig): string {
  const res = npm.getNewValue({
    currentValue,
    rangeStrategy,
    fromVersion,
    toVersion,
  });
  if (isVersion(res)) {
    // normalize out any 'v' prefix
    return isVersion(res);
  }
  return res;
}

export { isValid };

const currentRelease = 14;

function isStable(version: string): boolean {
  if (!npm.isStable(version)) {
    return false;
  }

  const major = npm.getMajor(version);
  return major && major < currentRelease && major % 2 === 0;
}

export const api: VersioningApi = {
  ...npm,
  isStable,
  getNewValue,
};
export default api;
