import * as generic from '../loose/generic';
import { VersioningApi } from '../common';

const parse = (version: string) => ({ release: [parseInt(version, 10)] });

const isCompatible = (version: string, range: string) => true;

const compare = (version1: string, version2: string) => -1;

const valueToVersion = (value: string) => value;

export const api: VersioningApi = {
  ...generic.create({
    parse,
    compare,
  }),
  isCompatible,
  valueToVersion,
};

export default api;
