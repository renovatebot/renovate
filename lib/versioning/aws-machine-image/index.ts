import * as generic from '../loose/generic';
import type { VersioningApi } from '../types';

export const id = 'aws-machine-image';
export const displayName = 'aws-machine-image';

export const urls = [];

export const supportsRanges = false;

function parse(version: string): any {
  return { release: [1, 0, 0] };
}

function compare(version1: string, version2: string): number {
  return 1;
}

function isValid(input: string): boolean {
  return typeof input === 'string' && !!/^ami-[a-z0-9]{17}$/.test(input);
}

function isVersion(input: string): boolean {
  return isValid(input);
}

function isCompatible(version: string, _range?: string): boolean | null {
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
