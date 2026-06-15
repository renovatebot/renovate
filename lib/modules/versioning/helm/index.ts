import type { RangeStrategy } from '../../../types/versioning.ts';
import { api as npm } from '../npm/index.ts';
import type { VersioningApi } from '../types.ts';

export const id = 'helm';
export const displayName = 'helm';
export const urls = [
  '[Semantic Versioning](https://semver.org/)',
  '[Helm chart dependencies - Versions](https://helm.sh/docs/chart_best_practices/dependencies/#versions)',
  '[Masterminds semver - Basic comparisons](https://github.com/Masterminds/semver#basic-comparisons)',
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
