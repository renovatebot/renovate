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

  it.each`
    a          | b          | exp
    ${'1.2.3'} | ${'1.2.3'} | ${true}
    ${'1.2.3'} | ${'1.2.4'} | ${false}
  `('equals($a, $b)', ({ a, b, exp }) => {
    expect(bzlmod.equals(a, b)).toBe(exp);
    // The following are currently aliases for equals.
    expect(bzlmod.matches(a, b)).toBe(exp);
  });

  it.each`
    a          | b          | exp
    ${'1.2.4'} | ${'1.2.3'} | ${true}
    ${'1.2.3'} | ${'1.2.3'} | ${false}
    ${'1.2.2'} | ${'1.2.3'} | ${false}
  `('isGreaterThan($a, $b)', ({ a, b, exp }) => {
    expect(bzlmod.isGreaterThan(a, b)).toBe(exp);
  });

  it.each`
    a          | b          | exp
    ${'1.2.4'} | ${'1.2.3'} | ${false}
    ${'1.2.3'} | ${'1.2.3'} | ${false}
    ${'1.2.2'} | ${'1.2.3'} | ${true}
  `('isLessThanRange($a, $b)', ({ a, b, exp }) => {
    expect(bzlmod.isLessThanRange!(a, b)).toBe(exp);
  });

  it.each`
    vers                           | rng        | exp
    ${[]}                          | ${'1.2.3'} | ${null}
    ${['1.1.0', '1.2.0', '2.0.0']} | ${'1.2.0'} | ${'1.2.0'}
    ${['1.1.0', '1.2.0', '2.0.0']} | ${'1.2.3'} | ${null}
  `('getSatisfyingVersion(vers, rng)', ({ vers, rng, exp }) => {
    expect(bzlmod.getSatisfyingVersion(vers, rng)).toBe(exp);
    // The following are currently aliases for getSatisfyingVersion.
    expect(bzlmod.minSatisfyingVersion(vers, rng)).toBe(exp);
  });

  it.each`
    a          | b          | exp
    ${'1.2.3'} | ${'1.2.3'} | ${0}
    ${'1.2.3'} | ${'1.2.4'} | ${-1}
    ${'1.2.4'} | ${'1.2.3'} | ${1}
  `('sortVersions($a, $b)', ({ a, b, exp }) => {
    expect(bzlmod.sortVersions(a, b)).toBe(exp);
  });

  it.each`
    a                | exp
    ${'1.2.3'}       | ${true}
    ${'1.2.3-pre'}   | ${false}
    ${'1.2.3+build'} | ${true}
  `('isStable', ({ a, exp }) => {
    expect(bzlmod.isStable(a)).toBe(exp);
  });

  it.each`
    a                    | exp
    ${'1.2.3'}           | ${true}
    ${'1.2.3-pre'}       | ${true}
    ${'1.2.3+build'}     | ${true}
    ${'1.2.3-pre+build'} | ${true}
    ${'1.2.3-pre+build'} | ${true}
    ${'-abc'}            | ${false}
    ${'1_2'}             | ${false}
  `('isValid($a)', ({ a, exp }) => {
    expect(bzlmod.isValid(a)).toBe(exp);
    // The following are currently aliases for isValid.
    expect(bzlmod.isCompatible(a)).toBe(exp);
    expect(bzlmod.isSingleVersion(a)).toBe(exp);
  });

  it.each`
    a            | exp
    ${'1.2.3'}   | ${true}
    ${'-abc'}    | ${false}
    ${null}      | ${false}
    ${undefined} | ${false}
  `('isVersion($a)', ({ a, exp }) => {
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
