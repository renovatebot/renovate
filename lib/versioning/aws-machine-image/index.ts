import * as generic from '../loose/generic';
import type { VersioningApi } from '../types';

export const id = 'aws-machine-image';
export const displayName = 'aws-machine-image';
// export const urls = ['https://git-scm.com/'];
export const supportsRanges = false;

const parse = (version: string): any => ({ release: [parseInt(version, 10)] });

const compare = (version1: string, version2: string): number => -1;

function isValid(input: string): string | boolean | null {
  return typeof input === 'string' && /^ami-[a-z0-9]{17}$/.test(input);
}

function isVersion(input: string): string | boolean | null {
  return isValid(input);
}

function isCompatible(
  version: string,
  _range?: string
): string | boolean | null {
  return isValid(version);
}

export const api: VersioningApi = {
  ...generic.create({
    parse,
    compare,
  }),
  isValid,
  isVersion,
  isCompatible,
};

export default api;
