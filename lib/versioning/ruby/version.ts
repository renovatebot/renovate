import last from 'lodash/last';
import {
  create,
  SegmentElement,
} from '@renovatebot/ruby-semver/dist/ruby/version';
import {
  diff,
  major,
  minor,
  patch,
  prerelease,
} from '@renovatebot/ruby-semver';

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

const adapt = (left: string, right: string): string =>
  left
    .split('.')
    .slice(0, right.split('.').length)
    .join('.');

const floor = (version: string) => {
  return [...releaseSegments(version).slice(0, -1), 0].join('.');
};

// istanbul ignore next
const incrementLastSegment = (version: string): string => {
  const segments = releaseSegments(version);
  const nextLast = parseInt(last(segments) as string, 10) + 1;
  return [...segments.slice(0, -1), nextLast].join('.');
};

// istanbul ignore next
const incrementMajor = (
  maj: number,
  min: number,
  ptch: number,
  pre: string[]
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
  switch (diff(from, adapt(to, from))) {
    case 'major':
      nextVersion = [incrementMajor(maj, min, ptch, pre || []), 0, 0].join('.');
      break;
    case 'minor':
      nextVersion = [maj, incrementMinor(min, ptch, pre || []), 0].join('.');
      break;
    case 'patch':
      nextVersion = [maj, min, incrementPatch(ptch, pre || [])].join('.');
      break;
    case 'prerelease':
      nextVersion = [maj, min, ptch].join('.');
      break;
    default:
      return incrementLastSegment(from);
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
        index: number
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
      []
    );

  return nextSegments.reverse().join('.');
};

export { parse, floor, increment, decrement };
