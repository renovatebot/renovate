import type { NewValueConfig } from '../types';
import { api as bzlmod } from '.';

describe('modules/versioning/bazel-module/index', () => {
  it('getMajor()', () => {
    expect(bzlmod.getMajor('1.2.3')).toBe(1);
  });

  it('getMinor()', () => {
    expect(bzlmod.getMinor('1.2.3')).toBe(2);
  });

  it('getPatch()', () => {
    expect(bzlmod.getPatch('1.2.3')).toBe(3);
  });

  it.each([
    { a: '1.2.3', b: '1.2.3', exp: true },
    { a: '1.2.3', b: '1.2.4', exp: false },
  ])('equals($a, $b)', ({ a, b, exp }) => {
    expect(bzlmod.equals(a, b)).toBe(exp);
    // The following are currently aliases for equals.
    expect(bzlmod.matches(a, b)).toBe(exp);
  });

  it.each([
    { a: '1.2.4', b: '1.2.3', exp: true },
    { a: '1.2.3', b: '1.2.3', exp: false },
    { a: '1.2.2', b: '1.2.3', exp: false },
  ])('isGreaterThan($a, $b)', ({ a, b, exp }) => {
    expect(bzlmod.isGreaterThan(a, b)).toBe(exp);
  });

  it.each([
    { a: '1.2.4', b: '1.2.3', exp: false },
    { a: '1.2.3', b: '1.2.3', exp: false },
    { a: '1.2.2', b: '1.2.3', exp: true },
  ])('isLessThanRange($a, $b)', ({ a, b, exp }) => {
    expect(bzlmod.isLessThanRange!(a, b)).toBe(exp);
  });

  it.each([
    { vers: [], rng: '1.2.3', exp: null },
    { vers: ['1.1.0', '1.2.0', '2.0.0'], rng: '1.2.0', exp: '1.2.0' },
    { vers: ['1.1.0', '1.2.0', '2.0.0'], rng: '1.2.3', exp: null },
  ])('getSatisfyingVersion(vers, rng)', ({ vers, rng, exp }) => {
    expect(bzlmod.getSatisfyingVersion(vers, rng)).toBe(exp);
  });

  it.each([
    { a: '1.2.3', b: '1.2.3', exp: 0 },
    { a: '1.2.3', b: '1.2.4', exp: -1 },
    { a: '1.2.4', b: '1.2.3', exp: 1 },
  ])('sortVersions($a, $b)', ({ a, b, exp }) => {
    expect(bzlmod.sortVersions(a, b)).toBe(exp);
  });

  it.each([
    { a: '1.2.3', exp: true },
    { a: '1.2.3-pre', exp: false },
    { a: '1.2.3+build', exp: true },
  ])('isStable', ({ a, exp }) => {
    expect(bzlmod.isStable(a)).toBe(exp);
  });

  it.each([
    { a: '1.2.3', exp: true },
    { a: '1.2.3-pre', exp: true },
    { a: '1.2.3+build', exp: true },
    { a: '1.2.3-pre+build', exp: true },
    { a: '1.2.3-pre+build', exp: true },
    { a: '-abc', exp: false },
    { a: '1_2', exp: false },
  ])('isValid($a)', ({ a, exp }) => {
    expect(bzlmod.isValid(a)).toBe(exp);
    // The following are currently aliases for isValid.
    expect(bzlmod.isCompatible(a)).toBe(exp);
    expect(bzlmod.isSingleVersion(a)).toBe(exp);
  });

  it.each([
    { a: '1.2.3', exp: true },
    { a: '-abc', exp: false },
    { a: null, exp: false },
    { a: undefined, exp: false },
  ])('isVersion($a)', ({ a, exp }) => {
    expect(bzlmod.isVersion(a)).toBe(exp);
  });

  it('getNewValue()', () => {
    const config: NewValueConfig = {
      currentValue: '1.0.0',
      rangeStrategy: 'auto',
      newVersion: '1.0.1',
    };
    expect(bzlmod.getNewValue(config)).toBe('1.0.1');
  });
});
