import { VersioningApi } from '../common';
import * as generic from '../loose/generic';

export const id = 'git';
export const displayName = 'git';
export const urls = ['https://git-scm.com/'];
export const supportsRanges = false;

const parse = (version: string): any => ({ release: version });

const isCompatible = (version: string, range: string): boolean => true;

const compare = (version1: string, version2: string): number =>
  version1 === version2 ? 0 : 1;
const valueToVersion = (value: string): string => value;

const getMajor = (version: string): string => version;
const getMinor = (version: string): null => null;
const getPatch = (version: string): null => null;

export const api: VersioningApi = {
  ...generic.create({
    parse,
    compare,
  }),
  isCompatible,
  valueToVersion,
  getMajor,
  getMinor,
  getPatch,
};

export default api;
