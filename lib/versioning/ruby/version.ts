import last from 'lodash/last';
import { create } from '@snyk/ruby-semver/lib/ruby/gem-version';
import { diff, major, minor, patch, prerelease } from '@snyk/ruby-semver';

interface RubyVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
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

const floor = (version: string): string =>
  [
    ...create(version)
      .release()
      .getSegments()
      .slice(0, -1),
    0,
  ].join('.');

// istanbul ignore next
const incrementLastSegment = (version: string): string => {
  const segments = create(version)
    .release()
    .getSegments();
  const nextLast = parseInt(last(segments), 10) + 1;

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
  const { major: maj, minor: min, patch: ptch, prerelease: pre } = parse(from);

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
  const segments = create(version)
    .release()
    .getSegments();
  const nextSegments = segments
    .reverse()
    .reduce((accumulator: number[], segment: number, index: number) => {
      if (index === 0) {
        return [segment - 1];
      }

      if (accumulator[index - 1] === -1) {
        return [...accumulator.slice(0, index - 1), 0, segment - 1];
      }

      return [...accumulator, segment];
    }, []);

  return nextSegments.reverse().join('.');
};

export { parse, floor, increment, decrement };
