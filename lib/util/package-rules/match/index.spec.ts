// match.spec.ts

import { match } from '.';

describe('util/package-rules/match', () => {
  const data = {
    packageName: 'foo',
    isBreaking: true,
    depType: 'dependencies',
    updateType: 'patch',
    currentVersion: '1.0.0',
    newVersion: '1.0.1',
    newMajor: 1,
  };

  describe('simple matches', () => {
    it.each`
      input                            | expected
      ${'packageName = "foo"'}         | ${true}
      ${'packageName = "bar"'}         | ${false}
      ${'isBreaking = true'}           | ${true}
      ${'isBreaking = false'}          | ${false}
      ${'depType = "dependencies"'}    | ${true}
      ${'depType = "devDependencies"'} | ${false}
      ${'updateType = "patch"'}        | ${true}
      ${'updateType = "minor"'}        | ${false}
      ${'currentVersion = "1.0.0"'}    | ${true}
      ${'currentVersion = "1.0.1"'}    | ${false}
      ${'newMajor = 1'}                | ${true}
      ${'newMajor = 2'}                | ${false}
      ${'newMajor < 2'}                | ${true}
      ${'newMajor > 1'}                | ${false}
      ${'newMajor >= 1'}               | ${true}
    `('match($input, data) = $expected', ({ input, expected }) => {
      expect(match(input, data)).toBe(expected);
    });
  });
});
