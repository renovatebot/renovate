import npm, { isVersion, isValid } from '../npm';
import { NewValueConfig, VersioningApi } from '../common';

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
