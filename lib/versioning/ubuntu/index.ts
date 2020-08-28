import { NewValueConfig, VersioningApi } from '../common';

export const id = 'ubuntu';
export const displayName = 'Ubuntu';
export const urls = ['https://changelogs.ubuntu.com/meta-release'];
export const supportsRanges = false;

interface UbuntuRelease {
  name: string;
  value: string;
  stable?: boolean;
}

const ubuntuReleases: UbuntuRelease[] = [
  {
    name: 'warty',
    value: '04.10',
  },
  {
    name: 'hoary',
    value: '05.04',
  },
  {
    name: 'breezy',
    value: '05.10',
  },
  {
    name: 'dapper',
    value: '6.06',
    stable: true,
  },
  {
    name: 'edgy',
    value: '6.10',
  },
  {
    name: 'feisty',
    value: '7.04',
  },
  {
    name: 'gutsy',
    value: '7.10',
  },
  {
    name: 'hardy',
    value: '8.04',
    stable: true,
  },
  {
    name: 'intrepid',
    value: '8.10',
  },
  {
    name: 'jaunty',
    value: '9.04',
  },
  {
    name: 'karmic',
    value: '9.10',
  },
  {
    name: 'lucid',
    value: '10.04.4',
    stable: true,
  },
  {
    name: 'maverick',
    value: '10.10',
  },
  {
    name: 'natty',
    value: '11.04',
  },
  {
    name: 'oneiric',
    value: '11.10',
  },
  {
    name: 'precise',
    value: '12.04.5',
    stable: true,
  },
  {
    name: 'quantal',
    value: '12.10',
  },
  {
    name: 'raring',
    value: '13.04',
  },
  {
    name: 'saucy',
    value: '13.10',
  },
  {
    name: 'trusty',
    value: '14.04.6',
    stable: true,
  },
  {
    name: 'utopic',
    value: '14.10',
  },
  {
    name: 'vivid',
    value: '15.04',
  },
  {
    name: 'wily',
    value: '15.10',
  },
  {
    name: 'xenial',
    value: '16.04.7',
    stable: true,
  },
  {
    name: 'yakkety',
    value: '16.10',
  },
  {
    name: 'zesty',
    value: '17.04',
  },
  {
    name: 'artful',
    value: '17.10',
  },
  {
    name: 'bionic',
    value: '18.04.5',
    stable: true,
  },
  {
    name: 'cosmic',
    value: '18.10',
  },
  {
    name: 'disco',
    value: '19.04',
  },
  {
    name: 'eoan',
    value: '19.10',
  },
  {
    name: 'focal',
    value: '20.04',
    stable: true,
  },
];

function find(input: string): UbuntuRelease | null {
  const version = input?.trim().toLowerCase() || null;
  const release = ubuntuReleases.find(
    ({ name, value }) => name === version || value === version
  );
  return release || null;
}

function findIndex(input: string): number | null {
  const version = input?.trim() || null;
  const index = ubuntuReleases.findIndex(
    ({ name, value }) => name === version || value === version
  );
  return index !== -1 ? index : null;
}

function eql(one: string, another: string): string | boolean | null {
  const x = find(one);
  const y = find(another);
  return x && y ? x.name === y.name : null;
}

// validation

function isCompatible(
  version: string,
  range?: string
): string | boolean | null {
  const x = find(version);
  if (x) {
    if (!range) {
      return true;
    }
    return eql(version, range);
  }
  return false;
}

function isSingleVersion(version: string): string | boolean | null {
  return find(version) ? true : null;
}

function isStable(version: string): boolean {
  const { stable = false } = find(version) || {};
  return stable;
}

function isValid(input: string): string | boolean | null {
  return !!find(input);
}

function isVersion(input: string): string | boolean | null {
  return !!find(input);
}

// digestion of version

function getMajor(version: string): null | number {
  const { value } = find(version) || {};
  const [major] = value?.split('.') || [];
  return major ? parseInt(major, 10) : null;
}

function getMinor(version: string): null | number {
  const { value } = find(version) || {};
  const [, minor] = value?.split('.') || [];
  return minor ? parseInt(minor, 10) : null;
}

function getPatch(version: string): null | number {
  const { value } = find(version) || {};
  const [, , patch] = value?.split('.') || [];
  return patch ? parseInt(patch, 10) : null;
}

// comparison

function equals(version: string, other: string): boolean {
  return !!eql(version, other);
}

function isGreaterThan(version: string, other: string): boolean {
  const x = findIndex(version);
  const y = findIndex(other);
  if (x === null || y === null) {
    return false;
  }
  return x > y;
}

function maxSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return versions.find((version) => eql(version, range)) ? range : null;
}

function minSatisfyingVersion(
  versions: string[],
  range: string
): string | null {
  return maxSatisfyingVersion(versions, range);
}

function getNewValue(newValueConfig: NewValueConfig): string {
  return newValueConfig.toVersion;
}

function sortVersions(version: string, other: string): number {
  const x = findIndex(version);
  const y = findIndex(other);
  return x - y;
}

function matches(version: string, range: string): boolean {
  return !!eql(version, range);
}

export const api: VersioningApi = {
  isCompatible,
  isSingleVersion,
  isStable,
  isValid,
  isVersion,

  getMajor,
  getMinor,
  getPatch,

  equals,
  isGreaterThan,
  maxSatisfyingVersion,
  minSatisfyingVersion,
  getNewValue,
  sortVersions,

  matches,
};

export default api;
