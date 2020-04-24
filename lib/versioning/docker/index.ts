import { is } from 'semver-stable';
import * as generic from '../loose/generic';
import { VersioningApi } from '../common';

export const id = 'docker';
export const displayName = 'Docker';
export const urls = [
  'https://docs.docker.com/engine/reference/commandline/tag/',
];
export const supportsRanges = false;

// const numberRe = /^(?:0|[1-9]+)$/;
// function toNumber(str: string): number {
//   return numberRe.test(str) ? Number(str) : Number.NaN;
// }

function parse(version: string): any {
  const versionPieces = version.replace(/^v/, '').split('-');
  const prefix = versionPieces.shift();
  const suffix = versionPieces.join('-');
  const release = prefix.split('.').map(Number);
  // eslint-disable-next-line @typescript-eslint/unbound-method
  if (release.some(Number.isNaN)) {
    return null;
  }
  return { release, suffix };
}

function valueToVersion(value: string): string {
  // Remove any suffix after '-', e.g. '-alpine'
  return value ? value.split('-')[0] : value;
}

function compare(version1: string, vervion2: string): number {
  const parsed1 = parse(version1);
  const parsed2 = parse(vervion2);
  // istanbul ignore if
  if (!(parsed1 && parsed2)) {
    return 1;
  }
  const length = Math.max(parsed1.release.length, parsed2.release.length);
  for (let i = 0; i < length; i += 1) {
    const part1 = parsed1.release[i];
    const part2 = parsed2.release[i];
    // shorter is bigger 2.1 > 2.1.1
    if (part1 === undefined) {
      return 1;
    }
    if (part2 === undefined) {
      return -1;
    }
    if (part1 !== part2) {
      return part1 - part2;
    }
  }
  // equals
  return parsed2.suffix.localeCompare(parsed1.suffix);
}

function isCompatible(version: string, range: string): boolean {
  const parsed1 = parse(version);
  const parsed2 = parse(range);
  return (
    parsed1.suffix === parsed2.suffix &&
    parsed1.release.length === parsed2.release.length
  );
}

const stableRe = /^(?:\d+(?:\.\d+)*)$/;

function isStable(version: string): boolean {
  return stableRe.test(valueToVersion(version));
}

export const api: VersioningApi = {
  ...generic.create({
    parse,
    compare,
  }),
  isCompatible,
  isStable,
  valueToVersion,
};

export default api;
