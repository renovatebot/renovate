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

export const api: VersioningApi = {
  ...npm,
  getNewValue,
};
export default api;
