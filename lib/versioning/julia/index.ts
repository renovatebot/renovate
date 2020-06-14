import { VersioningApi } from '../common';
import { api as npm } from '../npm';

export const id = 'julia';
export const displayName = 'Julia';
export const urls = [
  'https://julialang.github.io/Pkg.jl/stable/compatibility/#Version-specifier-format-1',
];
export const supportsRanges = true;
export const supportedRangeStrategies = ['bump', 'extend', 'pin', 'replace'];

export const api: VersioningApi = {
  ...npm,
};

export const { isVersion } = api;

export default api;
