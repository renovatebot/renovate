import { sortNugetVersions } from './v3';

describe('modules/datasource/nuget/v3', () => {
  it.each<{ version: string; other: string; result: number }>`
    version         | other           | result
    ${'invalid1'}   | ${'invalid2'}   | ${0}
    ${'invalid'}    | ${'1.0.0'}      | ${-1}
    ${'1.0.0'}      | ${'invalid'}    | ${1}
    ${'1.0.0-rc.1'} | ${'1.0.0'}      | ${-1}
    ${'1.0.0'}      | ${'1.0.0-rc.1'} | ${1}
    ${'1.0.0'}      | ${'1.0.0'}      | ${0}
  `(
    'sortNugetVersions("$version", "$other") === $result',
    ({ version, other, result }) => {
      const res = sortNugetVersions(version, other);
      expect(res).toBe(result);
    },
  );
});
