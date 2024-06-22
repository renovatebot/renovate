import { isSemVerXRange } from './common';

describe('modules/versioning/semver/common', () => {
  it.each`
    range      | expected
    ${'*'}     | ${true}
    ${'x'}     | ${true}
    ${'X'}     | ${true}
    ${''}      | ${true}
    ${'1'}     | ${false}
    ${'1.2'}   | ${false}
    ${'1.2.3'} | ${false}
  `('isSemVerXRange("range") === $expected', ({ range, expected }) => {
    expect(isSemVerXRange(range)).toBe(expected);
  });
});
