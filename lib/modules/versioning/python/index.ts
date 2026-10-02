import { api as poetry } from '../poetry/index.ts';
import type { VersioningApi } from '../types.ts';

export const id = 'python';
export const displayName = 'Python';
export const urls = [];
export const supportsRanges = false;

export function isBreaking(current: string, version: string): boolean {
  const currentMajor = poetry.getMajor(current);
  const currentMinor = poetry.getMinor(current);
  const newMajor = poetry.getMajor(version);
  const newMinor = poetry.getMinor(version);
  return !(currentMajor === newMajor && currentMinor === newMinor);
}

export const api: VersioningApi = {
  ...poetry,
  isBreaking,
};
export default api;
