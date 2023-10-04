import {
  urls as helmUrls,
  api as baseApi,
  supportedRangeStrategies as helmStrategies,
} from '../helm';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'oci-helm';
export const displayName = 'OCI Helm';
export const urls = [
  ...helmUrls,
  'https://helm.sh/docs/topics/registries/#oci-feature-deprecation-and-behavior-changes-with-v380',
];
export const supportsRanges = true;
export const supportedRangeStrategies = helmStrategies;

function _oci2semver(value: string): string {
  return value.replaceAll('_', '+');
}

export const api: VersioningApi = {
  ...baseApi,
  isValid(input: string) {
    return baseApi.isValid(_oci2semver(input));
  },
  isVersion(input: string | null | undefined): boolean {
    if (!input) {
      return false;
    }
    return baseApi.isVersion(_oci2semver(input));
  },
  sortVersions(version: string, other: string): number {
    return baseApi.sortVersions(_oci2semver(version), _oci2semver(other));
  },
  matches(version: string, range: string): boolean {
    return baseApi.matches(_oci2semver(version), _oci2semver(range));
  },
  isGreaterThan(version: string, other: string): boolean {
    return baseApi.isGreaterThan(_oci2semver(version), _oci2semver(other));
  },
  isCompatible(version: string, current: string): boolean {
    return baseApi.isCompatible(_oci2semver(version), _oci2semver(current));
  },
  getMajor(version: string) {
    return baseApi.getMajor(_oci2semver(version));
  },
  getMinor(version: string) {
    return baseApi.getMinor(_oci2semver(version));
  },
  getPatch(version: string) {
    return baseApi.getPatch(_oci2semver(version));
  },
  getNewValue({
    currentValue,
    rangeStrategy,
    currentVersion,
    newVersion,
  }: NewValueConfig): string | null {
    return baseApi.getNewValue({
      currentValue,
      rangeStrategy,
      currentVersion,
      newVersion: _oci2semver(newVersion),
    });
  },
  valueToVersion(version: string): string {
    return _oci2semver(version);
  },
};

export default api;
