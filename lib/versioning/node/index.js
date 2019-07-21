import npm, { isVersion, isValid } from '../npm';

function getNewValue(currentValue, rangeStrategy, fromVersion, toVersion) {
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

export const api = {
  ...npm,
  getNewValue,
};
export default api;
