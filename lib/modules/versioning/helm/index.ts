import type { RangeStrategy } from '../../../types/versioning';
import { api as npm } from '../npm';
import type { VersioningApi } from '../types';

export const id = 'helm';
export const displayName = 'helm';
export const urls = [
  '[Semantic Versioning (SemVer) - Official Website](https://semver.org)',
  '[Helm Chart Dependencies Versioning Best Practices](https://helm.sh/docs/chart_best_practices/dependencies/#versions)',
  '[Masterminds Semver Library - Basic Comparisons](https://github.com/Masterminds/semver#basic-comparisons)',
];

export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'widen',
  'pin',
  'replace',
  'widen',
];

export const api: VersioningApi = {
  ...npm,
};
