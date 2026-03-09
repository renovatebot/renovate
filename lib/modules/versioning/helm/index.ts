import type { RangeStrategy } from '../../../types/versioning.ts';
import { api as npm } from '../npm/index.ts';
import type { VersioningApi } from '../types.ts';

export const id = 'helm';
export const displayName = 'helm';
export const urls = [
  'https://semver.org/',
  'https://helm.sh/docs/chart_best_practices/dependencies/#versions',
  'https://github.com/Masterminds/semver#basic-comparisons',
];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'replace',
  'widen',
];

export const api: VersioningApi = {
  ...npm,
};
