const last = require('lodash/last');
const GemVersion = require('@snyk/ruby-semver/lib/ruby/gem-version');
const { diff, major, minor, patch, prerelease } = require('@snyk/ruby-semver');

const parse = version => ({
  major: major(version),
  minor: minor(version),
  patch: patch(version),
  prerelease: prerelease(version),
});

const adapt = (left, right) =>
  left
    .split('.')
    .slice(0, right.split('.').length)
    .join('.');

const floor = version =>
  [
    ...GemVersion.create(version)
      .release()
      .getSegments()
      .slice(0, -1),
    0,
  ].join('.');

// istanbul ignore next
const incrementLastSegment = version => {
  const segments = GemVersion.create(version)
    .release()
    .getSegments();
  const nextLast = parseInt(last(segments), 10) + 1;

  return [...segments.slice(0, -1), nextLast].join('.');
};

// istanbul ignore next
const incrementMajor = (maj, min, ptch, pre) =>
  min === 0 || ptch === 0 || pre.length === 0 ? maj + 1 : maj;

// istanbul ignore next
const incrementMinor = (min, ptch, pre) =>
  ptch === 0 || pre.length === 0 ? min + 1 : min;

// istanbul ignore next
const incrementPatch = (ptch, pre) => (pre.length === 0 ? ptch + 1 : ptch);

// istanbul ignore next
const increment = (from, to) => {
  const { major: maj, minor: min, patch: ptch, pre } = parse(from);

  let nextVersion;
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
const decrement = version => {
  const segments = GemVersion.create(version)
    .release()
    .getSegments();
  const nextSegments = segments
    .reverse()
    .reduce((accumulator, segment, index) => {
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

module.exports = {
  parse,
  floor,
  increment,
  decrement,
};
