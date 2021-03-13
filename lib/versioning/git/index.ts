import * as generic from '../loose/generic';
import type { VersioningApi } from '../types';

export const id = 'git';
export const displayName = 'git';
export const urls = ['https://git-scm.com/'];
export const supportsRanges = false;

const parse = (version: string): any => ({ release: [parseInt(version, 10)] });

const isCompatible = (version: string, range: string): boolean => true;

const compare = (version1: string, version2: string): number => -1;

const valueToVersion = (value: string): string => value;

export const api: VersioningApi = {
  ...generic.create({
    parse,
    compare,
  }),
  isCompatible,
  valueToVersion,
};

export default api;
