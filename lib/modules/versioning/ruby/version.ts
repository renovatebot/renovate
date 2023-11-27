import { eq, major, minor, patch, prerelease } from '@renovatebot/ruby-semver';
import {
  SegmentElement,
  create,
} from '@renovatebot/ruby-semver/dist/ruby/version.js';
import { regEx } from '../../../util/regex';

interface RubyVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[] | null;
}

function releaseSegments(version: string): SegmentElement[] {
  const v = create(version);
  if (v) {
    return v.release().getSegments();
  }
  /* istanbul ignore next */
  return [];
}

const parse = (version: string): RubyVersion => ({
  major: major(version),
  minor: minor(version),
  patch: patch(version),
  prerelease: prerelease(version),
});

const floor = (version: string): string => {
  const segments = releaseSegments(version);
  if (segments.length <= 1) {
    // '~> 2' is equivalent to '~> 2.0', thus no need to floor
    return segments.join('.');
  }
  return [...segments.slice(0, -1), 0].join('.');
};

const adapt = (left: string, right: string): string =>
  left.split('.').slice(0, right.split('.').length).join('.');

const trimZeroes = (version: string): string => {
  const segments = version.split('.');
  while (segments.length > 0 && segments[segments.length - 1] === '0') {
    segments.pop();
  }
  return segments.join('.');
};

// Returns the upper bound of `~>` operator.
const pgteUpperBound = (version: string): string => {
  const segments = releaseSegments(version);
  if (segments.length > 1) {
    segments.pop();
  }
  return incrementLastSegment(segments.join('.'));
};

// istanbul ignore next
const incrementLastSegment = (version: string): string => {
  const segments = releaseSegments(version);
  const nextLast = parseInt(segments.pop() as string, 10) + 1;

  return [...segments, nextLast].join('.');
};

// istanbul ignore next
const incrementMajor = (
  maj: number,
  min: number,
  ptch: number,
  pre: string[],
): number => (min === 0 || ptch === 0 || pre.length === 0 ? maj + 1 : maj);

// istanbul ignore next
const incrementMinor = (min: number, ptch: number, pre: string[]): number =>
  ptch === 0 || pre.length === 0 ? min + 1 : min;

// istanbul ignore next
const incrementPatch = (ptch: number, pre: string[]): number =>
  pre.length === 0 ? ptch + 1 : ptch;

// istanbul ignore next
const increment = (from: string, to: string): string => {
  const parsed = parse(from);
  const { major: maj, prerelease: pre } = parsed;
  let { minor: min, patch: ptch } = parsed;
  min = min || 0;
  ptch = ptch || 0;

  let nextVersion: string;
  const adapted = adapt(to, from);
  if (eq(from, adapted)) {
    return incrementLastSegment(from);
  }

  const isStable = (x: string): boolean => regEx(/^[0-9.-/]+$/).test(x);
  if (major(from) !== major(adapted)) {
    nextVersion = [incrementMajor(maj, min, ptch, pre ?? []), 0, 0].join('.');
  } else if (minor(from) !== minor(adapted)) {
    nextVersion = [maj, incrementMinor(min, ptch, pre ?? []), 0].join('.');
  } else if (patch(from) !== patch(adapted)) {
    nextVersion = [maj, min, incrementPatch(ptch, pre ?? [])].join('.');
  } else if (isStable(from) && isStable(adapted)) {
    nextVersion = [maj, min, incrementPatch(ptch, pre ?? [])].join('.');
  } else {
    nextVersion = [maj, min, ptch].join('.');
  }

  return increment(nextVersion, to);
};

// istanbul ignore next
const decrement = (version: string): string => {
  const segments = releaseSegments(version);
  const nextSegments = segments
    .reverse()
    .reduce(
      (
        accumulator: number[],
        segment: SegmentElement,
        index: number,
      ): number[] => {
        if (index === 0) {
          return [(segment as number) - 1];
        }

        if (accumulator[index - 1] === -1) {
          return [
            ...accumulator.slice(0, index - 1),
            0,
            (segment as number) - 1,
          ];
        }

        return [...accumulator, segment as number];
      },
      [],
    );

  return nextSegments.reverse().join('.');
};

export {
  parse,
  adapt,
  floor,
  trimZeroes,
  pgteUpperBound,
  increment,
  decrement,
};
