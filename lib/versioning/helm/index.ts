import { api as npm } from '../npm';
import type { VersioningApi } from '../types';

export const id = 'helm';
export const displayName = 'helm';
export const urls = [
  'https://semver.org/',
  'https://helm.sh/docs/chart_best_practices/dependencies/#versions',
  'https://github.com/Masterminds/semver#basic-comparisons',
];
export const supportsRanges = true;
export const supportedRangeStrategies = [
  'bump',
  'extend',
  'pin',
  'replace',
  'widen',
];

export const api: VersioningApi = {
  ...npm,
};
