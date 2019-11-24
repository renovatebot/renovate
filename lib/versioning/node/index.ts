import npm, { isVersion, isValid } from '../npm';
import { RangeStrategy, VersioningApi } from '../common';

function getNewValue(
  currentValue: string,
  rangeStrategy: RangeStrategy,
  fromVersion: string,
  toVersion: string
): string {
  const res = npm.getNewValue(
    currentValue,
    rangeStrategy,
    fromVersion,
    toVersion
  );
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
